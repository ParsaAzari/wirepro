/**
 * Four-step wizard controller: step visibility, stepper state,
 * per-step guards, and format-dependent settings panels.
 */
import { store, readFormat, readSettings } from "./store.js";
import { $, $$, getById } from "./utils.js";
import { parseMultipleWGConfigs } from "./converters.js";
import { validateWGConfig, hasErrors } from "./validation.js";
import { t } from "./i18n.js";

/** Number of wizard steps (must match the step sections in index.html). */
export const TOTAL_STEPS = 4;

/**
 * Show step n, hide the rest, and sync the stepper.
 * Backward moves animate from the opposite side (see .wg-step--back).
 * @param {number} n target step (clamped to 1..TOTAL_STEPS).
 */
export function goToStep(n) {
  const step = Math.min(Math.max(n, 1), TOTAL_STEPS);
  const backward = step < store.currentStep;
  $$(".wg-step").forEach((el) => {
    const active = Number(el.dataset.step) === step;
    el.classList.toggle("wg-step--active", active);
    el.classList.toggle("wg-step--back", active && backward);
    el.hidden = !active;
  });
  let activeLabel = "";
  $$("#wg-stepper .wg-stepper__item").forEach((el) => {
    const s = Number(el.dataset.stepLink);
    el.classList.toggle("wg-stepper__item--active", s === step);
    el.classList.toggle("wg-stepper__item--done", s < step);
    el.classList.toggle("wg-stepper__item--clickable", s < step);
    if (s === step) {
      el.setAttribute("aria-current", "step");
      el.setAttribute("aria-label", t("step_counter", { n: step, total: TOTAL_STEPS }));
      activeLabel = el.querySelector(".wg-stepper__label")?.textContent?.trim() ?? "";
    } else {
      el.removeAttribute("aria-current");
      el.removeAttribute("aria-label");
    }
  });
  const caption = getById("wg-stepper-caption");
  if (caption) caption.textContent = `${t("step_counter", { n: step, total: TOTAL_STEPS })} · ${activeLabel}`;
  store.setStep(step);
  $(`.wg-step--active`)?.querySelector("textarea, input, button")?.focus({ preventScroll: true });
}

/** Re-render the stepper caption (e.g. after a language switch). No focus steal. */
export function refreshStepperCaption() {
  const step = store.currentStep;
  const active = document.querySelector(`#wg-stepper .wg-stepper__item[data-step-link="${step}"]`);
  const label = active?.querySelector(".wg-stepper__label")?.textContent?.trim() ?? "";
  const caption = getById("wg-stepper-caption");
  if (caption) caption.textContent = `${t("step_counter", { n: step, total: TOTAL_STEPS })} · ${label}`;
}

/** Count parseable configs in the step-1 textarea (0 when empty). */
export function countInputConfigs() {
  const text = getById("wg-input-text")?.value?.trim();
  if (!text) return 0;
  try {
    return parseMultipleWGConfigs(text).length;
  } catch {
    return 0;
  }
}

/**
 * Gate for the 1→2 transition: non-empty input with zero validation errors.
 * Shows a toast reason when blocked.
 * @param {Function} showToast toast renderer injected to avoid an
 *   import cycle with ui.js.
 * @returns {boolean} true when navigation may proceed.
 */
export function canLeaveStep1(showToast) {
  const text = getById("wg-input-text")?.value?.trim();
  if (!text) {
    showToast(t("select_files_alert"), "error");
    return false;
  }
  try {
    const configs = parseMultipleWGConfigs(text);
    const issues = configs.flatMap((cfg, i) =>
      validateWGConfig(cfg, configs.length === 1 ? "Config" : `Config ${i + 1}`));
    if (hasErrors(issues)) {
      showToast(t("could_not_process_files"), "error");
      return false;
    }
    return true;
  } catch {
    showToast(t("could_not_process_files"), "error");
    return false;
  }
}

/**
 * Gate for the 3→4 transition: Wiresock requires a masking Id.
 * @param {Function} showToast toast renderer (see canLeaveStep1 for why injected).
 * @returns {boolean} true when conversion may start.
 */
export function canConvert(showToast) {
  if (readFormat() === "wiresocket" && !readSettings().ws.id.trim()) {
    showToast("Id field is required for Wiresocket", "error");
    return false;
  }
  return true;
}

/** Toggle Amnezia vs Wiresock settings blocks based on the format. */
export function syncSettingsVisibility() {
  const isWs = readFormat() === "wiresocket";
  const amz = getById("wg-settings-amnezia");
  const ws = getById("wg-settings-wiresock");
  if (amz) amz.hidden = isWs;
  if (ws) ws.hidden = !isWs;
}

/** Toggle conditional sub-panels inside step 3. */
export function syncConditionalPanels() {
  const show = (id, visible) => { const el = getById(id); if (el) el.hidden = !visible; };
  show("wg-amnezia15-panel", getById("wg-amnezia15-enabled")?.checked);
  show("wg-advanced-panel", getById("wg-advanced-enabled")?.checked);
  const dnsOn = getById("wg-dns-enabled")?.checked;
  show("wg-dns-panel", dnsOn);
  show("wg-dns-custom-row", dnsOn && getById("wg-dns-provider")?.value === "custom");
  show("wg-mtu-panel", getById("wg-mtu-enabled")?.checked);
}

/**
 * Wire stepper clicks, back/next buttons, and settings toggles.
 * @param {object} handlers owned by ui.js (wizard never touches toasts/DOM beyond its own).
 * @param {Function} handlers.onNextFromStep step-gated forward navigation.
 * @param {Function} handlers.onConvert conversion entry point.
 */
export function initWizard({ onNextFromStep, onConvert }) {
  $$("#wg-stepper .wg-stepper__item").forEach((el) => {
    el.addEventListener("click", () => {
      const s = Number(el.dataset.stepLink);
      if (s < store.currentStep) goToStep(s);
    });
  });
  getById("wg-next-1")?.addEventListener("click", () => onNextFromStep(1));
  getById("wg-next-2")?.addEventListener("click", () => onNextFromStep(2));
  $$("[data-wg-back]").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(store.currentStep - 1));
  });
  getById("wg-convert-btn")?.addEventListener("click", onConvert);

  $$('input[name="wg-format"]').forEach((r) => {
    r.addEventListener("change", () => {
      store.setFormat(readFormat());
      syncSettingsVisibility();
    });
  });
  ["wg-amnezia15-enabled", "wg-advanced-enabled", "wg-dns-enabled", "wg-mtu-enabled"].forEach((id) => {
    getById(id)?.addEventListener("change", syncConditionalPanels);
  });
  getById("wg-dns-provider")?.addEventListener("change", syncConditionalPanels);

  store.setFormat(readFormat());
  syncSettingsVisibility();
  syncConditionalPanels();
}
