/**
 * Pure DOM and misc helpers. No application state lives here.
 */

/**
 * Query a single element.
 * @param {string} selector CSS selector.
 * @param {ParentNode} [root=document] scope.
 * @returns {Element|null} first match.
 */
export const $ = (selector, root = document) => root.querySelector(selector);

/**
 * Query all matching elements as an array.
 * @param {string} selector CSS selector.
 * @param {ParentNode} [root=document] scope.
 * @returns {Element[]} all matches.
 */
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const byIdCache = new Map();

/**
 * Cached getElementById for hot paths (tabs, validation).
 * Re-resolves automatically if the cached node left the DOM.
 * @param {string} id element id.
 * @returns {HTMLElement|null} the element (or null when absent).
 */
export function getById(id) {
  if (!byIdCache.has(id)) byIdCache.set(id, document.getElementById(id));
  const el = byIdCache.get(id);
  // Re-resolve if the node was replaced (e.g. tabs re-render).
  if (el && !el.isConnected) {
    byIdCache.set(id, document.getElementById(id));
    return byIdCache.get(id);
  }
  return el;
}

/** Drop the id cache (call after large DOM rewrites). */
export function clearIdCache() {
  byIdCache.clear();
}

/** Random integer in [min, max]. */
export const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Escape HTML special chars before injecting user text.
 * @param {string} str raw user-controlled text.
 * @returns {string} safe for innerHTML interpolation.
 */
export function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Debounce a function.
 * @param {Function} fn function to delay.
 * @param {number} delay quiet period in milliseconds.
 * @returns {Function} debounced wrapper preserving arguments.
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Trigger a text file download in the browser.
 * Uses a temporary object URL + anchor click, revoked after 100ms so
 * repeated downloads never leak object URLs.
 * @param {string} content file text (UTF-8).
 * @param {string} fileName download name incl. extension.
 */
export function downloadText(content, fileName) {
  const blob = new Blob([content], { type: "text/plain; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "config.conf";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Copy text with a clipboard-API-first strategy and legacy fallback.
 * @param {string} text content to copy (blank input fails fast).
 * @returns {Promise<boolean>} true on success.
 */
export async function copyText(text) {
  if (!text?.trim()) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }
}
