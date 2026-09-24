/**
 * Internationalisation: lazy JSON loading with cache, DOM translation,
 * and toast-safe string lookup.
 */
import { SUPPORTED_LANGS } from "./config.js";
import { $, $$, getById } from "./utils.js";

const cache = {};
let dict = {};
let lang = localStorage.getItem("lang") || detectBrowserLang();

/** Current language code. */
export function currentLang() { return lang; }

/**
 * Dictionary lookup with {param} interpolation and an English fallback
 * chain (active dict → cached English → raw key), so partially translated
 * languages never render blank strings.
 * @param {string} key dictionary key.
 * @param {object} [params={}] {placeholder} interpolations.
 * @returns {string} translated (or fallback) string.
 */
export function t(key, params = {}) {
  let str = dict[key] ?? cache.en?.[key] ?? key;
  for (const [k, v] of Object.entries(params)) str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  return str;
}

/** Detect browser language, falling back to English. */
export function detectBrowserLang() {
  const code = (navigator.language || "en").slice(0, 2);
  return SUPPORTED_LANGS.includes(code) ? code : "en";
}

/**
 * Load a language file and translate the page.
 * Caches dictionaries; also pre-caches English as the t() fallback and
 * emits "wg:lang" so dynamic regions re-render in the new language.
 * @param {string} next language code (e.g. "fa").
 * @param {object} [opts] options.
 * @param {boolean} [opts.persist=true] write to localStorage (false for
 *   the first-visit preview before the user confirms a language).
 */
export async function loadLanguage(next, { persist = true } = {}) {
  try {
    if (!cache[next]) {
      const res = await fetch(`./lang/${next}.json?v=2.0`);
      if (!res.ok) throw new Error(`Language file not found: ${next}`);
      cache[next] = await res.json();
    }
    dict = cache[next];
    lang = next;
    // Ensure the English fallback is cached for partially translated languages.
    if (next !== "en" && !cache.en) {
      try {
        const res = await fetch("./lang/en.json?v=2.0");
        if (res.ok) cache.en = await res.json();
      } catch { /* fallback stays empty — t() returns the key */ }
    }
    if (persist) localStorage.setItem("lang", next);
    document.documentElement.lang = next;
    document.body.classList.remove("wg-lang-fa", "wg-lang-zh");
    document.body.classList.add(`wg-lang-${next}`);
    document.body.dir = next === "fa" ? "rtl" : "ltr";
    translatePage();
    updateLangMenu();
    // Let dynamic regions (e.g. validation) re-render in the new language.
    document.dispatchEvent(new CustomEvent("wg:lang", { detail: { lang: next } }));
  } catch (err) {
    console.error("Failed to load language:", err);
  }
}

/**
 * Apply the dictionary to every [data-i18n] node.
 * Runs on each language switch; dynamically rendered regions (validation,
 * stepper) re-render separately via the "wg:lang" event.
 */
function translatePage() {
  $$("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
  $$("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.placeholder = dict[key];
  });
  $$("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    const txt = dict[key] ?? cache.en?.[key];
    if (txt) el.setAttribute("aria-label", txt);
  });
  if (dict.title) document.title = dict.title;
}

/**
 * Sync the language menu's active item and label.
 * The trigger button shows the 2-letter code; full names live in the menu.
 */
function updateLangMenu() {
  const current = getById("wg-lang-current");
  $$("#wg-lang-list .wg-menu__item").forEach((btn) => {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle("wg-menu__item--active", active);
    if (active && current) current.textContent = btn.dataset.lang.toUpperCase();
  });
}

/** Wire the language dropdown (open, select, outside-click, Escape). */
export function initLangMenu() {
  const menu = getById("wg-lang-menu");
  const button = getById("wg-lang-button");
  if (!menu || !button) return;
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle("wg-menu--open");
    button.setAttribute("aria-expanded", String(open));
  });
  $$("#wg-lang-list .wg-menu__item").forEach((item) => {
    item.addEventListener("click", () => {
      menu.classList.remove("wg-menu--open");
      button.setAttribute("aria-expanded", "false");
      if (item.dataset.lang !== lang) loadLanguage(item.dataset.lang);
    });
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) {
      menu.classList.remove("wg-menu--open");
      button.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") menu.classList.remove("wg-menu--open");
  });
}

/**
 * Refresh the dropzone/file-meta label after language or file changes.
 * @param {number} count attached files (0 shows the "select files" prompt).
 */
export function refreshFileLabel(count) {
  const label = getById("wg-dropzone-text");
  const meta = getById("wg-file-meta");
  const text = count === 0 ? t("select_files") : t("files_selected_label", { count });
  if (label) label.textContent = text;
  if (meta) meta.textContent = count === 0 ? t("no_files") : text;
}
