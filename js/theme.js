/**
 * Light/dark theme management. Persists to localStorage.
 * Default is light for new visitors; stored choice always wins.
 *
 * Toggle uses the View Transitions API circular reveal (MDN/W3C pattern):
 * startViewTransition → on ready, WAAPI animates clip-path on
 * ::view-transition-new(root) from 0 to the farthest-corner radius.
 */
import { LS_THEME } from "./config.js";
import { getById } from "./utils.js";

/** Shared with theme-toggle.css — keep CSS and JS durations identical. */
const REVEAL_MS = 600;
const REVEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Read the stored theme, defaulting to light. */
export function currentTheme() {
  return document.documentElement.getAttribute("data-theme") || localStorage.getItem(LS_THEME) || "light";
}

/** Apply a theme to <html> and sync the toggle button state. */
export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(LS_THEME, theme);
  const btn = getById("wg-theme-toggle");
  if (btn) btn.setAttribute("aria-pressed", String(theme === "light"));
}

/**
 * Flip between dark and light with a circular reveal from the toggle button.
 * Fallbacks: no View Transitions API → instant swap; reduced motion → instant.
 */
export function toggleTheme() {
  const root = document.documentElement;
  // Ignore rapid re-clicks while a reveal is in flight.
  if (root.classList.contains("wg-vt-theme")) return;

  const next = currentTheme() === "dark" ? "light" : "dark";
  const btn = getById("wg-theme-toggle");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const supportsVT = typeof document.startViewTransition === "function";

  // Origin: button center, else viewport center.
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (btn) {
    const r = btn.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }

  // Exact radius to the farthest viewport corner (MDN recipe — 150% is imprecise).
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  if (reduced || !supportsVT) {
    applyTheme(next);
    return;
  }

  root.classList.add("wg-vt-theme");
  root.style.setProperty("--wg-vt-x", `${x}px`);
  root.style.setProperty("--wg-vt-y", `${y}px`);
  root.style.setProperty("--wg-vt-r", `${endRadius}px`);
  root.style.setProperty("--wg-vt-ms", `${REVEAL_MS}ms`);
  root.style.setProperty("--wg-vt-ease", REVEAL_EASING);

  // Keep the whole VT tree alive for the full reveal — otherwise
  // transition.finished (default ~250ms CSS) tears down mid-WAAPI
  // and the circle freezes near the button (top-right).
  let resolveHold;
  const hold = new Promise((resolve) => { resolveHold = resolve; });

  const transition = document.startViewTransition(() => {
    applyTheme(next);
  });

  transition.ready
    .then(() => {
      const anim = root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: REVEAL_MS,
          easing: REVEAL_EASING,
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      );
      anim.finished.catch(() => {}).finally(() => resolveHold());
    })
    .catch(() => {
      resolveHold();
    });

  // Delay VT teardown until our reveal has fully played.
  transition.waitUntil?.(hold);

  transition.finished
    .catch(() => {})
    .finally(() => {
      root.classList.remove("wg-vt-theme");
      root.style.removeProperty("--wg-vt-x");
      root.style.removeProperty("--wg-vt-y");
      root.style.removeProperty("--wg-vt-r");
      root.style.removeProperty("--wg-vt-ms");
      root.style.removeProperty("--wg-vt-ease");
    });
}

/** Initialise from storage (or light default) and wire the toggle button. */
export function initTheme() {
  applyTheme(localStorage.getItem(LS_THEME) || "light");
  getById("wg-theme-toggle")?.addEventListener("click", toggleTheme);
}
