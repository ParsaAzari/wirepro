/**
 * Central mutable state with a tiny pub/sub.
 * Only store.js may hold cross-module state (proxies, wizard step, format).
 * Settings form values stay in the DOM and are read on demand by converters;
 * persistence helpers live here so every module uses one path.
 */
import {
  LS_JUNK_MODE, LS_AMNEZIA15, LS_RANDOMIZE_PC,
  LS_WS_ID, LS_WS_IP, LS_WS_IB,
  LS_CUSTOM_DNS, LS_DNS_PROVIDER, LS_CUSTOM_DNS_VAL,
  LS_CUSTOM_MTU, LS_MTU_VALUE,
  LS_ADV_SETTINGS, LS_ADV_VALUES, LS_ADV_COOKIES,
} from "./config.js";
import { getById } from "./utils.js";

/**
 * Advanced-panel input ids persisted as one JSON blob (LS_ADV_VALUES).
 * Keep in sync with the wg-adv-* inputs in index.html step 3.
 */
const ADV_FIELD_IDS = [
  "wg-adv-padding", "wg-adv-rekey-after", "wg-adv-rekey-timeout",
  "wg-adv-reject-after", "wg-adv-keepalive", "wg-adv-handshake",
  "wg-adv-persistent",
];

/**
 * Single mutable state container. Only store.js writes these fields;
 * readers use the store facade below so change notifications stay central.
 */
const state = {
  proxies: [],
  combined: "",
  currentStep: 1,
  visited: new Set([1]),
  format: "awg",
};

const listeners = new Set();

/**
 * Subscribe to state changes.
 * @param {Function} fn listener receiving {type, ...detail} change objects.
 * @returns {Function} unsubscribe function.
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fan out a state change to all subscribers (never throws to callers). */
function notify(change) {
  listeners.forEach((fn) => fn(change));
}

/**
 * Public state facade (read-only getters + mutators that notify).
 * Mutators always go through notify() so UI subscribers stay in sync.
 */
export const store = {
  get proxies() { return state.proxies; },
  get combined() { return state.combined; },
  get currentStep() { return state.currentStep; },
  get format() { return state.format; },

  setProxies(proxies, combined) {
    state.proxies = proxies;
    state.combined = combined;
    notify({ type: "proxies" });
  },

  clearProxies() {
    state.proxies = [];
    state.combined = "";
    notify({ type: "proxies" });
  },

  setStep(step) {
    state.currentStep = step;
    state.visited.add(step);
    notify({ type: "step", step });
  },

  setFormat(format) {
    state.format = format;
    notify({ type: "format", format });
  },
};

/**
 * Read the selected output format from the wizard radio group.
 * @returns {"awg"|"clash"|"wiresocket"} selected format id ("awg" fallback).
 */
export function readFormat() {
  return document.querySelector('input[name="wg-format"]:checked')?.value || "awg";
}

/**
 * Snapshot every settings control into a plain object (single read point).
 * Converters must read through this snapshot — never query the DOM
 * directly — so generation stays deterministic and testable.
 * @returns {object} settings snapshot (junk, amnezia15, advanced, dns, mtu, ws).
 */
export function readSettings() {
  const val = (id) => getById(id)?.value ?? "";
  return {
    junkMode: document.querySelector('input[name="wg-junk"]:checked')?.value || "light",
    amnezia15: getById("wg-amnezia15-enabled")?.checked || false,
    advanced: getById("wg-advanced-enabled")?.checked || false,
    jc: val("wg-jc"), jmin: val("wg-jmin"), jmax: val("wg-jmax"),
    randomPerConfig: getById("wg-random-per-config")?.checked || false,
    i1: val("wg-i1"), i2: val("wg-i2"), i3: val("wg-i3"), i4: val("wg-i4"), i5: val("wg-i5"),
    adv: {
      padding: val("wg-adv-padding"), rekeyAfter: val("wg-adv-rekey-after"),
      rekeyTimeout: val("wg-adv-rekey-timeout"), rejectAfter: val("wg-adv-reject-after"),
      keepalive: val("wg-adv-keepalive"), handshake: val("wg-adv-handshake"),
      persistent: val("wg-adv-persistent"),
      disableCookies: getById("wg-adv-cookies")?.checked || false,
    },
    dns: {
      enabled: getById("wg-dns-enabled")?.checked || false,
      provider: getById("wg-dns-provider")?.value || "google",
      custom: val("wg-dns-custom"),
    },
    mtu: {
      enabled: getById("wg-mtu-enabled")?.checked || false,
      value: val("wg-mtu"),
    },
    ws: {
      junkMode: document.querySelector('input[name="wg-ws-junk"]:checked')?.value || "light",
      jc: val("wg-ws-jc"), jmin: val("wg-ws-jmin"), jmax: val("wg-ws-jmax"),
      id: val("wg-ws-id"), ip: getById("wg-ws-ip")?.value || "QUIC",
      ib: getById("wg-ws-ib")?.value || "Chrome",
    },
  };
}

/**
 * Persist current settings to localStorage (same keys as legacy app).
 * Wrapped in try/catch because private-mode browsers throw on access —
 * settings simply won't persist there instead of crashing the flow.
 */
export function persistSettings() {
  try {
    const s = readSettings();
    localStorage.setItem(LS_JUNK_MODE, { light: "junk1", heavy: "junk2", custom: "junk3" }[s.junkMode] || "junk1");
    localStorage.setItem(LS_AMNEZIA15, s.amnezia15 ? "1" : "0");
    localStorage.setItem(LS_RANDOMIZE_PC, s.randomPerConfig ? "1" : "0");
    localStorage.setItem(LS_WS_ID, s.ws.id);
    localStorage.setItem(LS_WS_IP, s.ws.ip);
    localStorage.setItem(LS_WS_IB, s.ws.ib);
    localStorage.setItem(LS_CUSTOM_DNS, s.dns.enabled ? "1" : "0");
    localStorage.setItem(LS_DNS_PROVIDER, s.dns.provider);
    localStorage.setItem(LS_CUSTOM_DNS_VAL, s.dns.custom);
    localStorage.setItem(LS_CUSTOM_MTU, s.mtu.enabled ? "1" : "0");
    localStorage.setItem(LS_MTU_VALUE, s.mtu.value || "1420");
    localStorage.setItem(LS_ADV_SETTINGS, s.advanced ? "1" : "0");
    localStorage.setItem(LS_ADV_VALUES, JSON.stringify({
      "wg-adv-padding": s.adv.padding, "wg-adv-rekey-after": s.adv.rekeyAfter,
      "wg-adv-rekey-timeout": s.adv.rekeyTimeout, "wg-adv-reject-after": s.adv.rejectAfter,
      "wg-adv-keepalive": s.adv.keepalive, "wg-adv-handshake": s.adv.handshake,
      "wg-adv-persistent": s.adv.persistent,
    }));
    localStorage.setItem(LS_ADV_COOKIES, s.adv.disableCookies ? "1" : "0");
  } catch { /* storage may be unavailable — settings simply won't persist */ }
}

/**
 * Restore persisted settings into the form. Safe to call before wizard
 * init. Missing keys keep form defaults; corrupt JSON is ignored.
 */
export function restoreSettings() {
  const set = (id, v) => { const el = getById(id); if (el) el.value = v; };
  const check = (id, on) => { const el = getById(id); if (el) el.checked = on; };

  const junkMode = localStorage.getItem(LS_JUNK_MODE);
  if (junkMode) {
    const map = { junk1: "light", junk2: "heavy", junk3: "custom" };
    const radio = document.querySelector(`input[name="wg-junk"][value="${map[junkMode] || "light"}"]`);
    if (radio) radio.checked = true;
  }
  check("wg-amnezia15-enabled", localStorage.getItem(LS_AMNEZIA15) === "1");
  check("wg-random-per-config", localStorage.getItem(LS_RANDOMIZE_PC) === "1");
  set("wg-ws-id", localStorage.getItem(LS_WS_ID) || "");
  const wsIp = localStorage.getItem(LS_WS_IP); if (wsIp) set("wg-ws-ip", wsIp);
  const wsIb = localStorage.getItem(LS_WS_IB); if (wsIb) set("wg-ws-ib", wsIb);
  check("wg-dns-enabled", localStorage.getItem(LS_CUSTOM_DNS) === "1");
  const provider = localStorage.getItem(LS_DNS_PROVIDER); if (provider) set("wg-dns-provider", provider);
  set("wg-dns-custom", localStorage.getItem(LS_CUSTOM_DNS_VAL) || "");
  check("wg-mtu-enabled", localStorage.getItem(LS_CUSTOM_MTU) === "1");
  set("wg-mtu", localStorage.getItem(LS_MTU_VALUE) || "");
  check("wg-advanced-enabled", localStorage.getItem(LS_ADV_SETTINGS) === "1");
  try {
    const adv = JSON.parse(localStorage.getItem(LS_ADV_VALUES) || "{}");
    ADV_FIELD_IDS.forEach((id) => { if (adv[id] !== undefined) set(id, adv[id]); });
  } catch { /* corrupted JSON — keep defaults */ }
  check("wg-adv-cookies", localStorage.getItem(LS_ADV_COOKIES) === "1");
}
