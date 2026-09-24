/**
 * Direct per-user WARP registration (browser side).
 *
 * Unlike the shared pool, every call creates a FRESH account with a
 * locally generated keypair — uniqueness is structural, so two users can
 * never receive the same config. The private key never leaves the device;
 * only the public key travels.
 *
 * RELAY CHAIN — Auto Generate walks this list in order and stops at the
 * first success. There is no proxy field in the UI; visitors never see it.
 *
 *   1. worker       user-owned Cloudflare Worker — primary relay.
 *                   ~100k req/day, no key in the URL, allowlisted to the
 *                   WARP API only. Origin check lives in the Worker itself.
 *   2. corsproxy.dev  managed fallback — 100 req/day, key in the query
 *                   string, origin-locked (localhost + site origin).
 *                   HTTP 429 here = daily quota spent → try next relay.
 *   3. Corsfix SDK  last resort — loaded from unpkg.com/corsfix; empty
 *                   prefix, fetched via corsfix.fetch (no key needed).
 *
 * WHY each entry carries its own fetch mode: entries 1–2 prefix the
 * encoded target URL and use native fetch; entry 3 passes the raw target
 * and must use corsfix.fetch. One shared fetch would double-proxy.
 *
 * Failures map to UI messages in ui.js: transport dead on every relay →
 * gen_unreachable; relay answered but API said no → gen_rejected; empty
 * chain → gen_no_relay. Swap the primary relay via WORKER_PREFIX.
 * @see https://corsproxy.dev/docs
 * @see https://corsfix.com/docs/cors-proxy/sdk
 */
import { registerAccount, buildWarpConf, PoolError } from "./warp-profile.js";
import { randomPrivateBytes, x25519GetPublic, bytesToBase64 } from "./x25519.js";

/** Primary relay: self-hosted Worker (?url= + encoded target). */
const WORKER_PREFIX = "https://corsfreedom.parsageme02-15a.workers.dev/?url=";
/** Fallback relay: managed corsproxy.dev (browser key rides in the query). */
const CORSPROXY_PREFIX = "https://api.corsproxy.dev/proxy?key=sk_live_1e9349f132eaf30422fd58373e6d7945&url=";

/** True when the Corsfix SDK is on the page (third relay). */
export function hasCorsfixSdk() {
  return typeof globalThis.corsfix?.fetch === "function";
}

/**
 * Native fetch bound to the global scope (relay entries 1–2).
 * @returns {typeof fetch}
 */
export function defaultDirectFetch() {
  if (hasCorsfixSdk()) {
    const sdkFetch = globalThis.corsfix.fetch.bind(globalThis.corsfix);
    return (input, init) => sdkFetch(input, init);
  }
  return globalThis.fetch.bind(globalThis);
}

/**
 * Fetch for one relay entry: sdk → corsfix.fetch, otherwise native fetch.
 * @param {{fetch?: string}} proxy entry from resolveProxies().
 * @returns {typeof fetch}
 */
function fetchFor(proxy) {
  if (proxy.fetch === "sdk" && hasCorsfixSdk()) {
    return (input, init) => globalThis.corsfix.fetch(input, init);
  }
  return globalThis.fetch.bind(globalThis);
}

/**
 * Effective relay chain for registration, in fallback order.
 *
 * Production (default): worker → corsproxy.dev → Corsfix SDK (if loaded).
 * Custom/empty `prefix` is a test hook — it replaces the whole chain with
 * a single native entry (empty string disables the feature → []).
 * @param {string} [prefix=WORKER_PREFIX] primary relay prefix override.
 * @returns {{name: string, prefix: string, fetch: string}[]} 0–3 entries.
 */
export function resolveProxies(prefix = WORKER_PREFIX) {
  if (prefix !== WORKER_PREFIX) {
    return prefix ? [{ name: "primary", prefix, fetch: "native" }] : [];
  }
  const chain = [
    { name: "worker", prefix: WORKER_PREFIX, fetch: "native" },
    { name: "corsproxy", prefix: CORSPROXY_PREFIX, fetch: "native" },
  ];
  if (hasCorsfixSdk()) chain.push({ name: "corsfix-sdk", prefix: "", fetch: "sdk" });
  return chain;
}

/**
 * Generate a browser-local keypair (CSPRNG + vendored X25519).
 * @param {Function} [randomFn] injectable CSPRNG for tests.
 * @returns {{privateKey: string, publicKey: string}} 44-char base64 keys.
 */
export function generateBrowserKeypair(randomFn = randomPrivateBytes) {
  const priv = randomFn();
  return {
    privateKey: bytesToBase64(priv),
    publicKey: bytesToBase64(x25519GetPublic(priv)),
  };
}

/**
 * Register one fresh account through the relay chain (first success wins).
 * Private key stays local; only the public key is sent.
 * @param {object} [opts] options.
 * @param {{name: string, prefix: string, fetch?: string}[]} [opts.proxies]
 *   test override; omitted → resolveProxies() (the built-in chain).
 * @param {Function} [opts.fetchImpl] injectable fetch (forces one fetch
 *   for every entry — tests only; production resolves per entry).
 * @param {number} [opts.timeoutMs] per-request timeout.
 * @param {{privateKey: string, publicKey: string}} [opts.keypair] test override.
 * @returns {Promise<{account: object, profile: string, proxyName: string, privateKey: string}>}
 *   profile is complete .conf text.
 * @throws {Error} coded failure via directError (no_relay/unreachable/rejected).
 */
export async function registerDirectAccount({
  proxies = null,
  fetchImpl = null,
  timeoutMs = 30000,
  keypair = null,
} = {}) {
  const list = proxies ?? resolveProxies();
  if (!list.length) throw directError("no_relay");
  const keys = keypair ?? generateBrowserKeypair();
  let lastError = null;
  let sawHttpResponse = false;
  for (const proxy of list) {
    try {
      const account = await registerAccount(keys.publicKey, {
        fetchImpl: fetchImpl ?? fetchFor(proxy),
        timeoutMs,
        proxyPrefix: proxy.prefix,
        proxyKey: proxy.key || "",
      });
      sawHttpResponse = true;
      if (!account.addresses.v4 || !account.peerPublicKey) continue;
      const profile = buildWarpConf({
        name: `warp-${Date.now().toString(36)}.conf`,
        privateKey: keys.privateKey,
        addresses: account.addresses,
        endpointHost: account.endpointHost,
        endpointPort: account.endpointPort,
        peerPublicKey: account.peerPublicKey,
      });
      return { account, profile, proxyName: proxy.name, privateKey: keys.privateKey };
    } catch (err) {
      // Any HTTP status means we REACHED something (relay alive, API
      // answered) — only transport failures mean "unreachable network".
      if (err instanceof PoolError) sawHttpResponse = true;
      lastError = err;
    }
  }
  if (!sawHttpResponse) throw directError("unreachable");
  throw directError("rejected", lastError?.message);
}

/**
 * Coded direct-registration failure for translated UI messages:
 * "no_relay" (relay chain empty), "unreachable" (every relay transport-dead,
 * e.g. filtered network) vs "rejected" (a relay answered but API said no).
 * @param {"unreachable"|"rejected"|"no_relay"} code machine-readable kind.
 * @param {string} [detail=""] optional debug info (never user-facing raw).
 * @returns {Error} error carrying .code for the i18n mapping in ui.js.
 */
export function directError(code, detail = "") {
  return Object.assign(new Error(`direct: ${code}${detail ? ` (${detail})` : ""}`), { code });
}
