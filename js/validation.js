/**
 * WireGuard config validation. Pure checks + DOM panel rendering.
 * Icons come from the SVG sprite (no emoji).
 */
import { wgIcon, VALIDATION_ICONS, STATUS_ICONS } from "./icons.js";
import { escapeHtml, getById } from "./utils.js";

const WG_KEY_RE = /^[A-Za-z0-9+/]{43}=$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
const IPV6_RE = /^[0-9a-fA-F:]+\/\d{1,3}$/;

/** A 44-char base64 key check. */
export function isValidWGKey(key) {
  return !!key && WG_KEY_RE.test(key);
}

/** Loose IPv4/IPv6 (with optional CIDR) check. */
export function isValidIP(ip) {
  const v = String(ip).trim();
  return IPV4_RE.test(v) || IPV6_RE.test(v);
}

/** host:port check, including [ipv6]:port. */
export function isValidEndpoint(ep) {
  if (!ep) return false;
  if (ep.startsWith("[")) return /^\[(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\]:\d+$/.test(ep);
  const parts = ep.split(":");
  return parts.length === 2 && !!parts[1] && !Number.isNaN(parseInt(parts[1], 10));
}

/**
 * Validate one parsed config.
 * Each issue is {level, code, label, detail}: `code` is a stable key for
 * friendly localized title/hint strings, `label` identifies the config,
 * and `detail` carries values like the offending endpoint. Errors block
 * conversion; warnings do not.
 * @param {object} wgConfig parsed config ({interface, peers}).
 * @param {string} label human config label used in messages and groups.
 * @returns {{level: "error"|"warning", code: string, label: string, detail?: string}[]} issues.
 */
export function validateWGConfig(wgConfig, label) {
  const issues = [];
  const iface = wgConfig.interface || {};
  const peer = wgConfig.peers?.[0] || {};

  if (!iface.privatekey) {
    issues.push({ level: "error", code: "missing-privatekey", label });
  } else if (!isValidWGKey(iface.privatekey)) {
    issues.push({ level: "error", code: "malformed-privatekey", label });
  }
  if (!peer.publickey) {
    issues.push({ level: "error", code: "missing-publickey", label });
  } else if (!isValidWGKey(peer.publickey)) {
    issues.push({ level: "error", code: "malformed-publickey", label });
  }
  if (!peer.endpoint) {
    issues.push({ level: "error", code: "missing-endpoint", label });
  } else if (!isValidEndpoint(peer.endpoint)) {
    issues.push({ level: "error", code: "malformed-endpoint", label, detail: peer.endpoint });
  }
  if (!peer.allowedips) {
    issues.push({ level: "warning", code: "missing-allowedips", label });
  } else {
    const bad = peer.allowedips.split(",").map((s) => s.trim()).filter((ip) => ip && !isValidIP(ip));
    if (bad.length) issues.push({ level: "warning", code: "malformed-allowedips", label, detail: bad.join(", ") });
  }
  if (!iface.address) {
    issues.push({ level: "warning", code: "missing-address", label });
  }
  if (peer.presharedKey && !isValidWGKey(peer.presharedKey)) {
    issues.push({ level: "warning", code: "malformed-preshared", label });
  }
  return issues;
}

/** True when no issue has level "error". */
export const hasErrors = (issues) => issues.some((i) => i.level === "error");

/**
 * Group issues by config label, preserving first-seen order.
 * @param {object[]} issues flat issue list.
 * @returns {[string, object[]][]} [label, issues] pairs for rendering.
 */
function groupByLabel(issues) {
  const groups = new Map();
  for (const issue of issues) {
    if (!groups.has(issue.label)) groups.set(issue.label, []);
    groups.get(issue.label).push(issue);
  }
  return [...groups.entries()];
}

/**
 * Localized title/hint for one issue (EN fallback handled by t()).
 * @param {object} issue single issue ({code, label, detail}).
 * @param {Function} t translator (injected to avoid an i18n import cycle).
 * @returns {{title: string, hint: string}} display strings.
 */
function issueText(issue, t) {
  const params = { label: issue.label, detail: issue.detail ?? "" };
  return {
    title: t(`val_${issue.code}_title`, params),
    hint: t(`val_${issue.code}_hint`, params),
  };
}

/**
 * Render the validation panel as a compact summary row (status icon,
 * counts, badges) with an eye button that opens the full per-config
 * breakdown in a modal. Also renders an all-clear state.
 * @param {Array} issues
 * @param {Function} t translator (avoids a hard i18n dependency)
 * @param {{total: number|null}} opts total configs parsed (enables the ok state)
 */
export function renderValidation(issues, t, { total = null } = {}) {
  const panel = getById("wg-validation");
  if (!panel) return;
  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.filter((i) => i.level === "warning").length;

  if (!issues.length) {
    if (total === null) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    panel.hidden = false;
    panel.className = "wg-validation wg-validation--ok";
    panel.innerHTML = `
      <div class="wg-validation__header">
        <span class="wg-validation__status">${wgIcon(STATUS_ICONS.ok)}</span>
        <span class="wg-validation__summary">${escapeHtml(t("validation_ok", { n: total }))}</span>
      </div>`;
    return;
  }

  const status = errors > 0 ? "error" : "warning";
  const summary = errors > 0 && warnings > 0
    ? t("validation_summary_both", { e: errors, w: warnings })
    : errors > 0
      ? t("validation_summary_errors", { e: errors })
      : t("validation_summary_warnings", { w: warnings });
  const count = errors + warnings;
  const badgeCls = errors > 0 ? "wg-vbadge--error" : "wg-vbadge--warning";
  const groups = groupByLabel(issues);
  const showGroupTitles = groups.length > 1;
  const groupsHtml = groups.map(([label, items]) => `
    <div class="wg-validation__group">
      ${showGroupTitles ? `<div class="wg-validation__group-title">${escapeHtml(label)}</div>` : ""}
      ${items.map((issue) => {
        const { title, hint } = issueText(issue, t);
        return `
        <div class="wg-validation__item wg-validation__item--${issue.level}">
          ${wgIcon(VALIDATION_ICONS[issue.level])}
          <div class="wg-validation__body">
            <div class="wg-validation__title">${escapeHtml(title)}</div>
            <div class="wg-validation__hint">${escapeHtml(hint)}</div>
          </div>
        </div>`;
      }).join("")}
    </div>`).join("");

  panel.hidden = false;
  panel.className = `wg-validation wg-validation--${status}`;
  panel.innerHTML = `
    <div class="wg-validation__header">
      <span class="wg-validation__status">${wgIcon(STATUS_ICONS[status])}</span>
      <span class="wg-validation__summary">${escapeHtml(summary)}</span>
      <span class="wg-validation__meta">
        <button type="button" class="wg-validation__view" aria-label="${escapeHtml(summary)} — ${escapeHtml(t("view_details"))}">${wgIcon("eye")}<span>${escapeHtml(t("view_details"))}</span><span class="wg-vbadge ${badgeCls}">${count}</span></button>
      </span>
      ${errors > 0 ? `<span class="wg-validation__fix">${escapeHtml(t("validation_fix_to_continue"))}</span>` : ""}
    </div>`;

  panel.querySelector(".wg-validation__view")?.addEventListener("click", () => {
    const modal = getById("wg-val-modal");
    const box = getById("wg-val-groups");
    const titleEl = getById("wg-val-title");
    if (!modal || !box) return;
    if (titleEl) titleEl.textContent = summary;
    box.innerHTML = groupsHtml;
    modal.hidden = false;
  });
}
