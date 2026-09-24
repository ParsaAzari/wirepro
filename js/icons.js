/**
 * Single entry point for SVG icons.
 * All artwork lives in assets/icons.svg as <symbol> elements;
 * callers never inline raw SVG paths.
 */

const SPRITE = "assets/icons.svg";

/**
 * Build an inline SVG referencing the sprite.
 * @param {string} name icon id without the "i-" prefix
 * @param {string} [cls] extra CSS class
 * @returns {string} HTML string
 */
export function wgIcon(name, cls = "wg-icon") {
  return `<svg class="${cls}" aria-hidden="true"><use href="${SPRITE}#i-${name}"/></svg>`;
}

/** Map validation levels to sprite icon names. */
export const VALIDATION_ICONS = {
  error: "error",
  warning: "warn",
  ok: "check",
};

/** Filled semantic marks for status boxes (iOS-banner look). */
export const STATUS_ICONS = {
  error: "err-fill",
  warning: "warn-fill",
  ok: "ok-fill",
};
