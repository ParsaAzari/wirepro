/**
 * DOM layer: toasts, file intake, live validation, settings actions,
 * result tabs, modals, and downloads. Pure rendering + event wiring;
 * conversion itself lives in converters.js.
 */
import { wgIcon } from "./icons.js";
import { $$, getById, clearIdCache, debounce, downloadText, copyText, getRandomInt, escapeHtml } from "./utils.js";
import { store, subscribe as subscribeStore, readFormat, readSettings, persistSettings } from "./store.js";
import { t, refreshFileLabel } from "./i18n.js";
import { parseWGConfig, parseMultipleWGConfigs, convertToProxy, inferConfigName, FORMAT_REGISTRY } from "./converters.js";
import { validateWGConfig, renderValidation, hasErrors } from "./validation.js";
import { goToStep, canLeaveStep1, canConvert, countInputConfigs, refreshStepperCaption } from "./wizard.js";
import {
  registerDirectAccount,
  resolveProxies,
} from "./warp-direct.js";
import { OS_ORDER, INSTALL_APPS } from "./install-apps.js";

/**
 * Show a small toast notification (success/error/info with SVG icon).
 * Only one toast exists at a time — a new call replaces the previous one
 * so rapid actions never stack notifications.
 * @param {string} message text already translated by the caller.
 * @param {"success"|"error"|"info"} [type="success"] visual style + icon.
 */
export function showToast(message, type = "success") {
  $$(".wg-toast").forEach((el) => el.remove());
  const el = document.createElement("div");
  el.className = `wg-toast wg-toast--${type}`;
  const icon = type === "error" ? "error" : type === "info" ? "warn" : "check";
  el.innerHTML = `${wgIcon(icon)}<span></span>`;
  el.lastChild.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("wg-toast--visible"));
  setTimeout(() => {
    el.classList.remove("wg-toast--visible");
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/**
 * Update detected-count badge + dropzone label from current input.
 * File count wins over pasted text because chosen files lock the
 * textarea (see handleFiles), making them the source of truth.
 */
function refreshInputMeta() {
  const files = getById("wg-files")?.files?.length || 0;
  const pasted = getById("wg-input-text")?.value?.trim() ? countInputConfigs() : 0;
  const count = files > 0 ? files : pasted;
  const badge = getById("wg-detected");
  if (badge) badge.hidden = count === 0;
  const n = getById("wg-detected-count");
  if (n) n.textContent = String(count);
  const empty = getById("wg-empty");
  if (empty) empty.hidden = count !== 0;
  refreshFileLabel(files);
}

/**
 * Briefly morph a copy control into a success check (micro-feedback).
 * The dataset.morph guard prevents overlapping timers when users
 * double-click faster than the 1400ms restore delay.
 * @param {HTMLElement} btn copy button in either style (row or plain).
 */
function flashCopied(btn) {
  if (!btn || btn.dataset.morph) return;
  btn.dataset.morph = "1";
  btn.classList.add("is-success");
  const iconBox = btn.querySelector(".wg-act__icon");
  if (iconBox) {
    // Settings-cell row: swap just the tinted icon box to a green check.
    const original = iconBox.innerHTML;
    iconBox.innerHTML = wgIcon("check");
    setTimeout(() => {
      btn.classList.remove("is-success");
      iconBox.innerHTML = original;
      delete btn.dataset.morph;
    }, 1400);
  } else {
    const original = btn.innerHTML;
    btn.innerHTML = `${wgIcon("check")}<span>${escapeHtml(t("config_copied"))}</span>`;
    setTimeout(() => {
      btn.classList.remove("is-success");
      btn.innerHTML = original;
      delete btn.dataset.morph;
    }, 1400);
  }
}

/**
 * Live validation for the step-1 textarea (debounced by caller).
 * Also gates the Next button so users learn about blockers before
 * clicking instead of after (see syncNextState).
 */
function runLiveValidation() {
  const text = getById("wg-input-text")?.value?.trim();
  if (!text) {
    renderValidation([], t);
    syncNextState(false);
    return;
  }
  try {
    const configs = parseMultipleWGConfigs(text);
    const issues = configs.flatMap((cfg, i) =>
      validateWGConfig(cfg, configs.length === 1 ? "Config" : `Config ${i + 1}`));
    renderValidation(issues, t, { total: configs.length });
    syncNextState(hasErrors(issues));
  } catch {
    renderValidation([], t);
    syncNextState(false);
  }
}

/**
 * Visually gate the step-1 Next button on validation errors.
 * The panel header already explains what to fix, so no toast is needed.
 */
function syncNextState(blocked) {
  const next = getById("wg-next-1");
  if (!next) return;
  next.disabled = blocked;
  next.title = blocked ? t("validation_fix_to_continue") : "";
}

/**
 * Load chosen files into the textarea.
 * Editing locks while files are attached so the textarea always mirrors
 * exactly what Convert will process; clearing the input unlocks it.
 * @param {FileList|File[]} files selected .conf files.
 */
function handleFiles(files) {
  const input = getById("wg-input-text");
  if (!files.length) {
    input.value = "";
    input.disabled = false;
    refreshInputMeta();
    renderValidation([], t);
    syncNextState(false);
    return;
  }
  let loaded = 0;
  let combined = "";
  [...files].forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      combined += `${String(reader.result).trim()}\n\n`;
      if (++loaded === files.length) {
        input.value = combined.trim();
        input.disabled = true;
        runLiveValidation();
        refreshInputMeta();
      }
    };
    reader.readAsText(file);
  });
  refreshInputMeta();
}

/**
 * Shared drag&drop for the dropzone label and the textarea.
 * Dropped files go through the real file input (DataTransfer) when
 * possible so downstream code sees one consistent source; the fallback
 * reads them directly for browsers that block input.files assignment.
 */
function initDragAndDrop() {
  const zone = getById("wg-dropzone");
  const area = getById("wg-input-text");
  const accept = (files) => [...files].filter((f) =>
    f.name.endsWith(".conf") || f.type === "" || f.type === "text/plain");

  [zone, area].forEach((el) => {
    if (!el) return;
    ["dragenter", "dragover"].forEach((evt) => el.addEventListener(evt, (e) => {
      e.preventDefault();
      el.classList.add("wg-dropzone--over");
    }));
    ["dragleave", "drop"].forEach((evt) => el.addEventListener(evt, (e) => {
      e.preventDefault();
      el.classList.remove("wg-dropzone--over");
    }));
  });
  zone?.addEventListener("drop", (e) => {
    const files = accept(e.dataTransfer.files);
    if (!files.length) return showToast("Please drop .conf files only", "error");
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    getById("wg-files").files = dt.files;
    handleFiles(dt.files);
  });
  area?.addEventListener("drop", (e) => {
    const files = accept(e.dataTransfer.files);
    if (!files.length) return;
    let loaded = 0;
    let combined = "";
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        combined += `${String(reader.result).trim()}\n\n`;
        if (++loaded === files.length) {
          area.value = combined.trim();
          area.disabled = false;
          runLiveValidation();
          refreshInputMeta();
        }
      };
      reader.readAsText(file);
    });
  });
}

/**
 * Fill junk fields with valid random values (jmax always above jmin).
 * @param {string} prefix input id prefix ("wg" or "wg-ws").
 */
function randomizeJunk(prefix) {
  const jc = getRandomInt(1, 128);
  const jmin = getRandomInt(1, 1279);
  const jmax = getRandomInt(jmin + 1, 1280);
  getById(`${prefix}-jc`) && (getById(`${prefix}-jc`).value = jc);
  getById(`${prefix}-jmin`) && (getById(`${prefix}-jmin`).value = jmin);
  getById(`${prefix}-jmax`) && (getById(`${prefix}-jmax`).value = jmax);
}

/**
 * Current card contents in render order.
 * Reads the hidden source textareas (not the previews) so modal edits
 * and downloads always use the latest user-modified text.
 * @returns {string[]} one entry per rendered card.
 */
function cardTexts() {
  return $$("#wg-results .wg-result-card").map((card) => card.querySelector("textarea")?.value ?? "");
}

/**
 * Card currently open in the edit modal (null when closed).
 * Stored as {card, onAfterSave} so saving can refresh card-derived UI
 * such as the file-size label without re-rendering the whole list.
 */
let editingCard = null;

/**
 * Shorten full config text to a few preview lines.
 * @param {string} full complete config text.
 * @returns {string} first 5 lines plus an ellipsis marker when truncated.
 */
function previewText(full) {
  const lines = String(full).split("\n").slice(0, 5);
  return lines.join("\n") + (String(full).split("\n").length > 5 ? "\n…" : "");
}

/**
 * Refresh a card's preview from its hidden source textarea.
 * @param {HTMLElement} card rendered result card.
 */
function refreshPreview(card) {
  const ta = card.querySelector("textarea");
  const pre = card.querySelector(".wg-result-card__preview");
  if (ta && pre) pre.textContent = previewText(ta.value);
}

/**
 * Open the edit modal for a card.
 * @param {HTMLElement} card rendered result card holding the source textarea.
 * @param {string} title config name shown in the modal header.
 * @param {Function|null} [onAfterSave=null] callback run after a successful
 *   save (e.g. refresh the file-size label).
 */
function openEditor(card, title, onAfterSave = null) {
  const modal = getById("wg-edit-modal");
  const box = getById("wg-edit-text");
  const titleEl = getById("wg-edit-title");
  if (!modal || !box) return;
  editingCard = { card, onAfterSave };
  box.value = card.querySelector("textarea")?.value ?? "";
  if (titleEl) titleEl.textContent = title;
  modal.hidden = false;
  box.focus();
}

/** Close the edit modal without saving. */
function closeEditor() {
  getById("wg-edit-modal").hidden = true;
  editingCard = null;
}

/**
 * Human file size for result headers.
 * @param {string} text config content (measured as UTF-8 bytes).
 * @returns {string} e.g. "842 B" or "1.2 KB".
 */
function fileSize(text) {
  const bytes = new Blob([text]).size;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

const FORMAT_LABELS = { clash: "Clash", awg: "AmneziaWG / WG Tunnel", wiresocket: "Wiresock" };

/**
 * Render the success banner + one grouped card per config with cell actions.
 * Each card owns a hidden source textarea (single source of truth) plus a
 * read-only preview; all actions read the textarea so modal edits apply
 * to copy, download, QR and ZIP without extra syncing.
 */
function renderResults() {
  const list = getById("wg-results");
  const summary = getById("wg-result-summary");
  const proxies = store.proxies;
  const format = store.format;
  const reg = FORMAT_REGISTRY[format] || FORMAT_REGISTRY.awg;
  clearIdCache();

  if (!proxies.length) {
    list.hidden = true;
    summary.hidden = true;
    return;
  }
  list.hidden = false;
  summary.hidden = false;
  list.innerHTML = "";

  getById("wg-result-summary-title").textContent = t("result_ready", { n: proxies.length });
  getById("wg-result-summary-sub").textContent = FORMAT_LABELS[format] || format;
  const zipBtn = getById("wg-download-zip");
  zipBtn.hidden = proxies.length < 2;
  zipBtn.onclick = () => downloadZip();

  // QR only makes sense for AWG mobile clients without the huge I1 blob.
  const showQR = reg.showQR && !getById("wg-amnezia15-enabled")?.checked;

  // Unique file names per card (same endpoint twice must not collide on disk).
  const outNames = dedupeFileNames(proxies, reg);
  const uniqueFileName = (proxy, idx) => outNames[idx];

  proxies.forEach((proxy, idx) => {
    const title = proxy.originalName || `Config ${idx + 1}`;
    const content = reg.single(proxy, idx);
    const outName = uniqueFileName(proxy, idx);
    const card = document.createElement("div");
    card.className = "wg-result-card";

    const head = document.createElement("div");
    head.className = "wg-result-card__head";
    const name = document.createElement("span");
    name.className = "wg-result-card__name";
    name.textContent = title;
    name.title = title;
    const size = document.createElement("span");
    size.className = "wg-result-card__size";
    size.textContent = fileSize(content);
    head.appendChild(name);
    head.appendChild(size);
    card.appendChild(head);

    // Compact read-only preview; full editable text lives in the modal.
    const pre = document.createElement("pre");
    pre.className = "wg-result-card__preview";
    card.appendChild(pre);
    const ta = document.createElement("textarea");
    ta.value = content;
    ta.hidden = true;
    ta.setAttribute("aria-label", title);
    card.appendChild(ta);
    refreshPreview(card);

    // iOS Settings-style action rows with tinted icon boxes.
    const actions = document.createElement("div");
    actions.className = "wg-result-card__actions";
    actions.innerHTML =
      `<button type="button" class="wg-act" data-act="cp"><span class="wg-act__icon wg-act__icon--copy">${wgIcon("copy")}</span><span>${escapeHtml(t("copy"))}</span></button>` +
      `<button type="button" class="wg-act" data-act="dl"><span class="wg-act__icon wg-act__icon--download">${wgIcon("download")}</span><span>${escapeHtml(t("download"))}</span></button>` +
      `<button type="button" class="wg-act" data-act="ed"><span class="wg-act__icon wg-act__icon--edit">${wgIcon("edit")}</span><span>${escapeHtml(t("edit"))}</span></button>` +
      (showQR ? `<button type="button" class="wg-act" data-act="qr"><span class="wg-act__icon wg-act__icon--qr">${wgIcon("qr")}</span><span>${escapeHtml(t("qr_code"))}</span></button>` : "");
    card.appendChild(actions);
    list.appendChild(card);

    const syncSize = () => { size.textContent = fileSize(ta.value); };
    actions.querySelector('[data-act="cp"]')?.addEventListener("click", async (e) => {
      const ok = await copyText(ta.value);
      showToast(ok ? t("config_copied") : t("copy_failed"), ok ? "success" : "error");
      if (ok) flashCopied(e.currentTarget);
    });
    actions.querySelector('[data-act="dl"]')?.addEventListener("click", () =>
      downloadText(ta.value, outName));
    actions.querySelector('[data-act="ed"]')?.addEventListener("click", () => openEditor(card, title, syncSize));
    actions.querySelector('[data-act="qr"]')?.addEventListener("click", () => openQR(ta.value, title));
  });
  clearIdCache();
}

/**
 * Dedupe output names with -2, -3 suffixes so downloads never collide.
 * @param {object[]} proxies converted proxy models in render order.
 * @param {object} reg active FORMAT_REGISTRY entry (provides fileName).
 * @returns {string[]} unique file name per proxy, same order.
 */
function dedupeFileNames(proxies, reg) {
  const seen = new Map();
  return proxies.map((proxy, idx) => {
    const base = reg.fileName(proxy, idx);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : base.replace(/(\.[^.]+)?$/, `-${n}$1`);
  });
}

/**
 * Download all configs as one ZIP.
 * Prefers the (possibly user-edited) card contents over stored models.
 * Requires the JSZip CDN; degrades to an error toast when offline.
 */
async function downloadZip() {
  const proxies = store.proxies;
  const reg = FORMAT_REGISTRY[store.format] || FORMAT_REGISTRY.awg;
  if (!proxies.length) return;
  const edited = cardTexts();
  const textOf = (idx) => edited[idx] ?? reg.single(proxies[idx], idx);
  if (typeof JSZip === "undefined") return showToast("JSZip library not loaded", "error");
  const zip = new JSZip();
  // Computed once: recomputing per card would be O(n²).
  const outNames = dedupeFileNames(proxies, reg);
  proxies.forEach((proxy, idx) => {
    try {
      zip.file(outNames[idx], textOf(idx));
    } catch (err) {
      console.error(`ZIP: skipping config ${idx + 1}:`, err);
    }
  });
  try {
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reg.zipName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    showToast(`Downloaded ${proxies.length} configs as ZIP`);
  } catch (err) {
    showToast(`Failed to create ZIP: ${err.message}`, "error");
  }
}

/**
 * Open the QR modal for one config text.
 * Large configs (notably with Amnezia I1) can exceed QR capacity — that
 * case renders an explanatory message instead of throwing.
 * @param {string} configText exact text to encode (already user-edited).
 * @param {string} title config name shown in the modal header.
 */
function openQR(configText, title) {
  const modal = getById("wg-qr-modal");
  const box = getById("wg-qr-box");
  const titleEl = getById("wg-qr-title");
  if (!modal || !box || typeof QRCode === "undefined") {
    return showToast("QRCode library not loaded", "error");
  }
  box.innerHTML = "";
  titleEl.textContent = title || t("qr_code");
  try {
    new QRCode(box, {
      text: String(configText).replace(/\r\n/g, "\n").trim(),
      width: 256, height: 256, colorDark: "#000000", colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.L,
    });
  } catch (err) {
    console.error("QR error:", err);
    box.innerHTML = `<p style="font-size:.85rem;max-width:240px">Config is too large for a QR code. Use Download instead.</p>`;
  }
  modal.hidden = false;
}

/**
 * Show the install-guide FAB only while step 4 is active.
 * @param {number} step new wizard step (1..4).
 */
function syncInstallFab(step) {
  const fab = getById("wg-install-fab");
  if (fab) fab.hidden = step !== 4;
}

/** Active install-guide screen: "os" picker or selected OS key ("windows", …). */
let installScreen = "os";

/** Reset install modal to the OS list (called on open and language switch). */
function renderInstallOsList() {
  const sub = getById("wg-install-sub");
  const list = getById("wg-install-list");
  installScreen = "os";
  if (!list) return;
  if (sub) sub.textContent = t("install_pick_os");
  list.innerHTML = OS_ORDER.map((os) => `
    <button type="button" class="wg-install-os" data-os="${os}">
      <svg class="wg-icon" aria-hidden="true"><use href="assets/icons.svg#i-download" /></svg>
      <span>${escapeHtml(t(`install_os_${os}`))}</span>
    </button>`).join("");
}

/**
 * Show official client download rows for one OS.
 * Apps matching the current output format sort first with a chip.
 * @param {string} os key from INSTALL_APPS / OS_ORDER.
 */
function renderInstallApps(os) {
  const sub = getById("wg-install-sub");
  const list = getById("wg-install-list");
  const apps = INSTALL_APPS[os] || [];
  const format = store.format || "awg";
  installScreen = os;
  if (sub) sub.textContent = t("install_choose_app", { os: t(`install_os_${os}`) });
  if (!list) return;

  const hasMatch = apps.some((a) => a.formats.includes(format));
  const note = !hasMatch && apps.length
    ? `<p class="wg-install-note">${escapeHtml(t("install_no_match"))}</p>`
    : "";

  const sorted = [...apps].sort((a, b) => {
    const am = a.formats.includes(format) ? 0 : 1;
    const bm = b.formats.includes(format) ? 0 : 1;
    return am - bm;
  });

  list.innerHTML = `
    <button type="button" class="wg-install-back" id="wg-install-back">
      <svg class="wg-icon wg-icon--dir" aria-hidden="true"><use href="assets/icons.svg#i-arrow-left" /></svg>
      <span>${escapeHtml(t("install_back"))}</span>
    </button>
    ${note}
    ${sorted.map((app) => {
      const fits = app.formats.includes(format);
      return `
      <a class="wg-install-app" href="${escapeHtml(app.url)}" target="_blank" rel="noopener noreferrer">
        <span class="wg-install-app__meta">
          <span class="wg-install-app__name">${escapeHtml(app.name)}</span>
          <span class="wg-install-app__hint">${escapeHtml(t(app.hintKey))}</span>
        </span>
        ${fits ? `<span class="wg-install-chip">${escapeHtml(t("install_fits_format"))}</span>` : ""}
        <svg class="wg-icon wg-icon--ext" aria-hidden="true"><use href="assets/icons.svg#i-external" /></svg>
      </a>`;
    }).join("")}
  `;
}

/** Close the install modal if open. */
function closeInstallGuide() {
  const modal = getById("wg-install-modal");
  if (modal) modal.hidden = true;
}

/**
 * Open the install-guide modal on the OS picker.
 * FAB is only visible on step 4; modal follows the same close/Escape
 * pattern as the QR and validation dialogs.
 */
function openInstallGuide() {
  const modal = getById("wg-install-modal");
  if (!modal) return;
  installScreen = "os";
  renderInstallOsList();
  modal.hidden = false;
}

/**
 * Core conversion entry point (wired to the step-3 Convert button).
 * Validates inputs, maps each config to a proxy model, renders results
 * and advances to step 4. File input wins over pasted text; configs with
 * blocking errors are skipped with a toast while valid ones still convert.
 */
export function runConversion() {
  if (!canConvert(showToast)) return;
  const format = readFormat();
  const settings = readSettings();
  const files = getById("wg-files")?.files;
  const textInput = getById("wg-input-text")?.value?.trim();

  if ((!files?.length) && !textInput) {
    return showToast(t("select_files_alert"), "error");
  }
  const convertBtn = getById("wg-convert-btn");
  convertBtn?.classList.add("is-loading");
  const proxies = [];
  const issues = [];
  const randomPC = settings.randomPerConfig;
  const target = format === "wiresocket" ? "wiresocket" : format;
  let ingested = 0;

  const ingest = (wgConfig, label, fileName) => {
    ingested++;
    const found = validateWGConfig(wgConfig, label);
    issues.push(...found);
    if (hasErrors(found)) {
      showToast(`Skipped ${label}: validation errors`, "error");
      return;
    }
    // Clash and AWG share the proxy model; Clash rendering differs only.
    const modelFormat = target === "clash" ? "awg" : target;
    proxies.push(convertToProxy(wgConfig, fileName, settings, modelFormat, randomPC));
  };

  const finish = () => {
    getById("wg-convert-btn")?.classList.remove("is-loading");
    renderValidation(issues, t, { total: ingested });
    if (!proxies.length) return showToast(t("could_not_process_files"), "error");
    const reg = FORMAT_REGISTRY[target] || FORMAT_REGISTRY.awg;
    store.setFormat(target);
    store.setProxies(proxies, reg.combined(proxies));
    persistSettings();
    renderResults();
    goToStep(4);
  };

  if (files?.length) {
    let done = 0;
    [...files].forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          ingest(parseWGConfig(reader.result), file.name, file.name);
        } catch (err) {
          showToast(t("error_in_file", { file: file.name, msg: err.message }), "error");
        } finally {
          if (++done === files.length) finish();
        }
      };
      reader.onerror = () => {
        showToast(t("error_reading_file", { file: file.name }), "error");
        if (++done === files.length) finish();
      };
      reader.readAsText(file);
    });
  } else {
    try {
      const configs = parseMultipleWGConfigs(textInput);
      configs.forEach((cfg, i) =>
        ingest(cfg, configs.length === 1 ? "Config" : `Config ${i + 1}`, inferConfigName(cfg, i)));
      finish();
    } catch (err) {
      getById("wg-convert-btn")?.classList.remove("is-loading");
      showToast(t("error_in_file", { file: "pasted.conf", msg: err.message }), "error");
    }
  }
}

/**
 * Clear inputs, results, and validation; back to step 1.
 * Also releases the one-per-run auto-generate quota so a fresh run
 * can generate again.
 */
function clearAll() {
  const input = getById("wg-input-text");
  input.value = "";
  input.disabled = false;
  autoGenerated = false;
  syncAutoButton(false);
  getById("wg-files").value = "";
  store.clearProxies();
  renderValidation([], t);
  syncNextState(false);
  getById("wg-results").hidden = true;
  getById("wg-result-summary").hidden = true;
  refreshInputMeta();
  goToStep(1);
}

/**
 * One auto-generated config per workflow run. The flag flips on success
 * and resets only on Clear (a new run); errors never consume the quota.
 */
let autoGenerated = false;

/**
 * Lock/unlock the Auto Generate button with an explanatory tooltip.
 * @param {boolean} locked true after a successful generation (one per run).
 */
function syncAutoButton(locked) {
  const btn = getById("wg-auto-btn");
  if (!btn) return;
  btn.disabled = locked;
  btn.title = locked ? t("gen_one_per_run") : "";
}

/**
 * Auto Generate: register a brand-new WARP account (unique keys per click,
 * like warp-register.sh — no pool, no repeats by construction) and feed it
 * through the exact same pipeline as manual input (append on top of
 * existing text, like file drops do — never destructive).
 */
async function handleAutoGenerate() {
  const btn = getById("wg-auto-btn");
  const input = getById("wg-input-text");
  if (!btn || btn.disabled) return;
  if (autoGenerated) {
    showToast(t("gen_one_per_run"), "info");
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    showToast(t("gen_offline"), "error");
    input.focus();
    return;
  }
  btn.disabled = true;
  btn.classList.add("is-loading");
  const serveText = (fileName, text) => {
    const current = input.value.trim();
    input.value = current ? `${current}\n\n${text}` : text;
    input.disabled = false;
    autoGenerated = true;
    syncAutoButton(true);
    runLiveValidation();
    refreshInputMeta();
    showToast(t("gen_ready", { file: fileName }));
  };
  // Fresh per-user account — unique keys by construction, so no two
  // users can ever receive the same config. No pool, no repeats.
  // Relay chain lives in warp-direct.js: worker → corsproxy.dev →
  // Corsfix SDK (first success wins); visitors never configure a proxy.
  try {
    const { profile } = await registerDirectAccount({
      proxies: resolveProxies(),
      timeoutMs: 15000,
    });
    const parsed = parseMultipleWGConfigs(profile);
    const bad = parsed.flatMap((cfg, i) =>
      validateWGConfig(cfg, parsed.length === 1 ? "Config" : `Config ${i + 1}`),
    );
    if (!parsed.length || hasErrors(bad)) throw new Error("direct: invalid profile");
    serveText(`warp-${Date.now().toString(36)}.conf`, profile.trim());
  } catch (err) {
    // no_relay = owner hasn't configured a relay yet (setup hint);
    // unreachable = own network/proxy blocked (e.g. filtered network);
    // rejected = a server answered but said no. Different guidance each.
    const key = { no_relay: "gen_no_relay", unreachable: "gen_unreachable", rejected: "gen_rejected" }[err?.code] || "gen_failed";
    showToast(t(key), "error");
    input.focus();
  } finally {
    // Stay locked after success (one per run); reopen on failure.
    btn.disabled = autoGenerated;
    btn.classList.remove("is-loading");
  }
}

/** Wire every UI control. Called once from app.js init. */
export function initUI() {
  initDragAndDrop();

  getById("wg-files")?.addEventListener("change", (e) => handleFiles(e.target.files));
  getById("wg-input-text")?.addEventListener("input", debounce(() => {
    runLiveValidation();
    refreshInputMeta();
  }, 500));
  getById("wg-clear-btn")?.addEventListener("click", clearAll);
  getById("wg-again-btn")?.addEventListener("click", clearAll);
  getById("wg-auto-btn")?.addEventListener("click", handleAutoGenerate);

  // Settings quick actions.
  getById("wg-junk-random")?.addEventListener("click", () => {
    randomizeJunk("wg");
    const custom = document.querySelector('input[name="wg-junk"][value="custom"]');
    if (custom) custom.checked = true;
    persistSettings();
  });
  getById("wg-junk-reset")?.addEventListener("click", () => {
    ["wg-jc", "wg-jmin", "wg-jmax"].forEach((id) => { getById(id).value = ""; });
    document.querySelector('input[name="wg-junk"][value="light"]').checked = true;
    getById("wg-random-per-config").checked = false;
    persistSettings();
    showToast("Junk settings reset", "info");
  });
  getById("wg-ws-random")?.addEventListener("click", () => {
    randomizeJunk("wg-ws");
    document.querySelector('input[name="wg-ws-junk"][value="custom"]').checked = true;
  });
  getById("wg-adv-random")?.addEventListener("click", () => {
    const range = (lo, hi) => {
      const a = getRandomInt(lo, Math.floor((lo + hi) / 2));
      const b = getRandomInt(a, hi);
      return a === b ? `${a}` : `${a}-${b}`;
    };
    getById("wg-adv-padding").value = `0-${getRandomInt(4, 128)}`;
    getById("wg-adv-rekey-after").value = range(90, 150);
    getById("wg-adv-rekey-timeout").value = range(3, 10);
    getById("wg-adv-reject-after").value = range(150, 210);
    getById("wg-adv-keepalive").value = range(5, 15);
    getById("wg-adv-handshake").value = range(5, 18);
    persistSettings();
  });
  getById("wg-adv-reset")?.addEventListener("click", () => {
    ["wg-adv-padding", "wg-adv-rekey-after", "wg-adv-rekey-timeout",
      "wg-adv-reject-after", "wg-adv-keepalive", "wg-adv-handshake"].forEach((id) => { getById(id).value = ""; });
    getById("wg-adv-cookies").checked = false;
    persistSettings();
    showToast("Advanced settings cleared", "info");
  });

  // iOS-stepper −/+ buttons with valid-range clamps.
  const STEPPER_LIMITS = { jc: [1, 128], jmin: [1, 1279], jmax: [2, 1280] };
  $$(".wg-num__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = getById(btn.dataset.target);
      if (!input) return;
      const [lo, hi] = STEPPER_LIMITS[btn.dataset.limit] || [0, 9999];
      const dir = Number(btn.dataset.dir) || 1;
      const cur = parseInt(input.value, 10);
      const next = Number.isNaN(cur) ? (dir > 0 ? lo : hi) : Math.min(hi, Math.max(lo, cur + dir));
      input.value = next;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      // Manual tweaks imply the Custom preset (mirrors Generate Random behavior).
      const group = btn.dataset.target.startsWith("wg-ws-") ? "wg-ws-junk" : "wg-junk";
      const customRadio = document.querySelector(`input[name="${group}"][value="custom"]`);
      if (customRadio) customRadio.checked = true;
    });
  });

  // Persist settings on any change.
  $$("#wg-step-3 input, #wg-step-3 select").forEach((el) => {
    el.addEventListener("change", persistSettings);
    if (el.tagName === "INPUT" && el.type === "text") el.addEventListener("input", debounce(persistSettings, 800));
  });

  // Apple-style help popovers (?): toggle without flipping the parent choice.
  const closeAllHelp = () => {
    $$(".wg-help--open").forEach((el) => {
      el.classList.remove("wg-help--open");
      el.querySelector(".wg-help")?.setAttribute("aria-expanded", "false");
    });
  };
  $$(".wg-help").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest(".wg-choice, .wg-panel");
      const willOpen = card && !card.classList.contains("wg-help--open");
      closeAllHelp();
      if (card && willOpen) {
        card.classList.add("wg-help--open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
  document.addEventListener("click", closeAllHelp);

  // Global Escape closes any open modal.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      getById("wg-qr-modal").hidden = true;
      getById("wg-val-modal").hidden = true;
      closeInstallGuide();
      closeAllHelp();
      closeEditor();
    }
  });

  // QR + validation modals.
  getById("wg-val-close")?.addEventListener("click", () => { getById("wg-val-modal").hidden = true; });
  getById("wg-val-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "wg-val-modal") e.currentTarget.hidden = true;
  });
  getById("wg-qr-close")?.addEventListener("click", () => { getById("wg-qr-modal").hidden = true; });
  getById("wg-qr-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "wg-qr-modal") e.currentTarget.hidden = true;
  });

  // Install guide: FAB → OS list → official app links.
  getById("wg-install-fab")?.addEventListener("click", openInstallGuide);
  getById("wg-install-close")?.addEventListener("click", closeInstallGuide);
  getById("wg-install-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "wg-install-modal") closeInstallGuide();
  });
  getById("wg-install-list")?.addEventListener("click", (e) => {
    const osBtn = e.target.closest("[data-os]");
    if (osBtn) {
      renderInstallApps(osBtn.dataset.os);
      return;
    }
    if (e.target.closest("#wg-install-back")) renderInstallOsList();
  });
  // FAB visibility follows the wizard step (shown only on Result).
  subscribeStore((change) => {
    if (change?.type === "step") syncInstallFab(change.step);
  });
  syncInstallFab(store.currentStep);

  // Edit modal: save writes back to the card, copy duplicates modal text.
  getById("wg-edit-close")?.addEventListener("click", closeEditor);
  getById("wg-edit-cancel")?.addEventListener("click", closeEditor);
  getById("wg-edit-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "wg-edit-modal") closeEditor();
  });
  getById("wg-edit-save")?.addEventListener("click", () => {
    if (!editingCard) return closeEditor();
    const box = getById("wg-edit-text");
    const ta = editingCard.card.querySelector("textarea");
    if (ta && box) ta.value = box.value;
    refreshPreview(editingCard.card);
    editingCard.onAfterSave?.();
    closeEditor();
    showToast(t("save"), "success");
  });
  getById("wg-edit-copy")?.addEventListener("click", async (e) => {
    const ok = await copyText(getById("wg-edit-text")?.value ?? "");
    showToast(ok ? t("config_copied") : t("copy_failed"), ok ? "success" : "error");
    if (ok) flashCopied(e.currentTarget);
  });

  // Re-render language-dependent regions (validation, stepper) on language switch.
  document.addEventListener("wg:lang", () => {
    runLiveValidation();
    refreshInputMeta();
    refreshStepperCaption();
    syncAutoButton(autoGenerated);
    // Refresh install modal copy if it is open.
    const installModal = getById("wg-install-modal");
    if (installModal && !installModal.hidden) {
      if (installScreen === "os") renderInstallOsList();
      else renderInstallApps(installScreen);
    }
  });

  refreshInputMeta();
}

/**
 * Step-gated "next" handler used by the wizard controller.
 * @param {number} step the step being left (only step 1 has a gate).
 */
export function handleNextFromStep(step) {
  if (step === 1 && !canLeaveStep1(showToast)) return;
  goToStep(step + 1);
}
