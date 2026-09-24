/**
 * Application bootstrap. Ordered, dependency-safe init:
 *  1. theme (light default) → 2. i18n (async) → first-visit language modal
 *  3. settings restore → 4. wizard → 5. UI listeners → 6. initial step.
 */
import { initTheme } from "./theme.js";
import { loadLanguage, initLangMenu, currentLang, detectBrowserLang } from "./i18n.js";
import { restoreSettings } from "./store.js";
import { initWizard, goToStep, syncSettingsVisibility, syncConditionalPanels } from "./wizard.js";
import { initUI, handleNextFromStep, runConversion } from "./ui.js";
import { getById } from "./utils.js";

/** True when the visitor has never chosen a language (first visit). */
function needsLangPick() {
  try {
    return !localStorage.getItem("lang");
  } catch {
    return false; // storage blocked — fall back to browser language
  }
}

/**
 * Open the first-visit language modal. Choice is required (no close/Escape);
 * picking a language loads it, persists `lang`, and continues init.
 * @returns {Promise<void>} resolves after the language is applied.
 */
function promptLanguage() {
  return new Promise((resolve) => {
    const modal = getById("wg-lang-modal");
    const list = getById("wg-lang-welcome-list");
    if (!modal || !list) {
      resolve();
      return;
    }
    // Pre-highlight the browser language as a visual hint (still needs a click).
    const suggested = detectBrowserLang();
    list.querySelectorAll("[data-lang-pick]").forEach((btn) => {
      btn.classList.toggle("wg-install-os--suggested", btn.dataset.langPick === suggested);
    });
    const onPick = async (e) => {
      const btn = e.target.closest("[data-lang-pick]");
      if (!btn) return;
      list.removeEventListener("click", onPick);
      modal.hidden = true;
      await loadLanguage(btn.dataset.langPick);
      resolve();
    };
    list.addEventListener("click", onPick);
    // Intentionally no backdrop/Escape dismiss — the user must pick once.
    modal.hidden = false;
    list.querySelector(`[data-lang-pick="${suggested}"]`)?.focus({ preventScroll: true });
  });
}

async function init() {
  initTheme();
  initLangMenu();
  if (needsLangPick()) {
    // Preview in browser language without persisting — user must confirm.
    await loadLanguage(detectBrowserLang(), { persist: false });
    await promptLanguage();
  } else {
    await loadLanguage(currentLang());
  }
  restoreSettings();
  initWizard({ onNextFromStep: handleNextFromStep, onConvert: runConversion });
  syncSettingsVisibility();
  syncConditionalPanels();
  initUI();
  goToStep(1);
}

document.addEventListener("DOMContentLoaded", init);
