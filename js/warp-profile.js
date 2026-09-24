/**
 * Shared WARP profile core — browser-safe and dependency-free.
 * Single implementation for direct per-user registration (js/warp-direct.js).
 * No Node.js APIs, no DOM access, no network side effects at import time.
 */

/** Cloudflare client API versions to try, newest first. */
export const API_VERSIONS = ["v0a737", "v0a2223", "v0a884", "v0a1922"];

/** Headers mimicking the official WARP client (required by the API). */
export const CLIENT_HEADERS = {
  "CF-Client-Version": "a-6.11-2223",
  "User-Agent": "okhttp/3.12.1",
  "Content-Type": "application/json; charset=UTF-8",
};

/** Default WARP WireGuard endpoint port. */
export const WARP_PORT = 2408;

/** WARP-standard link settings baked into every generated profile. */
export const WARP_MTU = 1280;
/** PersistentKeepalive seconds (matches official WARP client). */
export const WARP_KEEPALIVE = 25;

/** Dual-stack DNS used for generated profiles. */
export const WARP_DNS = "1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001";

/** Typed API failure carrying retry advice for the caller. */
export class PoolError extends Error {
  constructor(stage, status) {
    super(`WARP API failed at ${stage} (HTTP ${status})`);
    this.name = "PoolError";
    this.stage = stage;
    this.status = status;
  }

  /** 429 and 5xx are worth retrying; everything else is fatal fast. */
  get retryable() {
    return this.status === 429 || (this.status >= 500 && this.status <= 599);
  }
}

/**
 * Normalize base64url (JWK) to standard padded base64.
 * Buffer-free so it runs identically in browsers and Node.
 * @param {string} input base64url string (no padding).
 * @returns {string} standard base64 with "=" padding.
 */
export function b64urlToB64(input) {
  const b64 = String(input).replace(/-/g, "+").replace(/_/g, "/");
  return b64 + "=".repeat((4 - (b64.length % 4)) % 4);
}

/**
 * Ensure an address carries CIDR notation (WireGuard clients reject
 * bare IPs like "172.16.0.2" — the API returns them maskless).
 * @param {string} addr IPv4 or IPv6 address, with or without mask.
 * @returns {string} address with /32 (v4) or /128 (v6) appended when missing.
 */
export function normalizeAddress(addr) {
  const trimmed = String(addr || "").trim();
  if (!trimmed || trimmed.includes("/")) return trimmed;
  return trimmed.includes(":") ? `${trimmed}/128` : `${trimmed}/32`;
}

/**
 * Render a standard WireGuard profile for a WARP account.
 * @param {object} parts profile pieces.
 * @param {string} parts.name config title (first comment line).
 * @param {string} parts.privateKey 44-char base64 private key.
 * @param {{v4: string, v6: string}} parts.addresses interface addresses.
 * @param {string} parts.endpointHost peer hostname (port split separately).
 * @param {number} [parts.endpointPort] peer port (WARP_PORT default).
 * @param {string} parts.peerPublicKey 44-char base64 peer key.
 * @returns {string} complete .conf text.
 */
export function buildWarpConf({
  name,
  privateKey,
  addresses,
  endpointHost,
  endpointPort = WARP_PORT,
  peerPublicKey,
}) {
  const addressLine = [addresses.v4, addresses.v6]
    .map(normalizeAddress)
    .filter(Boolean)
    .join(", ");
  return [
    `# ${name}`,
    "[Interface]",
    `PrivateKey = ${privateKey}`,
    `Address = ${addressLine}`,
    `DNS = ${WARP_DNS}`,
    `MTU = ${WARP_MTU}`,
    "",
    "[Peer]",
    `PublicKey = ${peerPublicKey}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    `Endpoint = ${endpointHost}:${endpointPort}`,
    `PersistentKeepalive = ${WARP_KEEPALIVE}`,
    "",
  ].join("\n");
}

/** fetch() with an abort-based timeout (no native fetch timeout option). */
async function fetchWithTimeout(fetchImpl, url, { timeoutMs, ...init }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Register one WARP account for the given public key.
 * @param {string} publicKey 44-char base64 X25519 public key.
 * @param {object} opts
 * @param {string} opts.proxyPrefix optional CORS-proxy prefix; the target
 *   URL is appended encoded (e.g. "https://corsproxy.io/?url="). Empty
 *   means direct calls (Node/CI only — browsers are CORS-blocked).
 * Tries API versions in order; throws PoolError on failure.
 * @param {string} publicKey 44-char base64 X25519 public key.
 * @param {string} [opts] overrides for tests
 *   ({fetchImpl, timeoutMs, proxyPrefix, proxyKey}).
 * @param {string} [opts.proxyKey] legacy Corsfix key sent as x-corsfix-key
 *   header (relay chain entries 1–2 carry no header key — theirs lives in
 *   the URL or needs none; only old raw-Corsfix prefixes set this).
 * @returns {Promise<object>} account record (ids, addresses, endpoint, keys).
 */
export async function registerAccount(
  publicKey,
  { fetchImpl = globalThis.fetch, timeoutMs = 30000, proxyPrefix = "", proxyKey = "" } = {},
) {
  const tos = new Date().toISOString().replace(/\.\d+Z$/, "+00:00");
  const body = {
    install_id: "",
    warp_enabled: true,
    tos,
    key: publicKey,
    fcm_token: "",
    type: "Android",
    model: "PC",
    locale: "en_US",
  };
  const proxyHeaders = proxyKey ? { "x-corsfix-key": proxyKey } : {};
  const urlFor = (version, path) => {
    const target = `https://api.cloudflareclient.com/${version}${path}`;
    return proxyPrefix ? `${proxyPrefix}${encodeURIComponent(target)}` : target;
  };
  let lastError = null;
  for (const version of API_VERSIONS) {
    try {
      const regRes = await fetchWithTimeout(fetchImpl, urlFor(version, "/reg"), {
        method: "POST",
        headers: { ...CLIENT_HEADERS, ...proxyHeaders },
        body: JSON.stringify(body),
        timeoutMs,
      });
      if (!regRes.ok) throw new PoolError("register", regRes.status);
      const reg = await regRes.json();
      // Newer API versions embed the full client config in the POST
      // response; older ones need a second authenticated GET.
      let cfg = reg.config ? reg : null;
      if (!cfg) {
        const cfgRes = await fetchWithTimeout(fetchImpl, urlFor(version, `/reg/${reg.id}`), {
          headers: { Authorization: `Bearer ${reg.token}`, ...proxyHeaders },
          timeoutMs,
        });
        if (!cfgRes.ok) throw new PoolError("client_config", cfgRes.status);
        cfg = await cfgRes.json();
      }
      // The API sometimes returns "host:port" in endpoint.host —
      // split it so callers never duplicate the port.
      const rawHost = cfg.config?.peers?.[0]?.endpoint?.host ?? "engage.cloudflareclient.com";
      const portMatch = rawHost.match(/:(\d+)$/);
      return {
        apiVersion: version,
        accountId: reg.id,
        token: reg.token ?? "",
        license: reg.account?.license ?? "",
        accountType: reg.account?.account_type ?? cfg.account?.account_type ?? "free",
        warpPlus: Boolean(reg.account?.warp_plus ?? cfg.account?.warp_plus ?? false),
        addresses: {
          v4: cfg.config?.interface?.addresses?.v4 ?? "",
          v6: cfg.config?.interface?.addresses?.v6 ?? "",
        },
        endpointHost: portMatch ? rawHost.slice(0, portMatch.index) : rawHost,
        endpointPort: portMatch ? parseInt(portMatch[1], 10) : WARP_PORT,
        peerPublicKey: cfg.config?.peers?.[0]?.public_key ?? "",
      };
    } catch (err) {
      lastError = err;
      // A 4xx (except 429) means this version/client shape is rejected:
      // stop version-hopping and fail fast.
      if (err instanceof PoolError && !err.retryable && err.status < 500) break;
    }
  }
  throw lastError ?? new PoolError("register", 0);
}

/**
 * Attach a WARP+ license to a fresh account (optional; only store-bought
 * keys grant real Plus — referral keys do not, per wgcf docs).
 * @param {object} ids {apiVersion, accountId, token, license}.
 * @param {object} [opts] overrides for tests ({fetchImpl, timeoutMs, proxyPrefix}).
 * @returns {boolean} true when the server accepted the key.
 */
export async function attachLicense(
  { apiVersion, accountId, token, license },
  { fetchImpl = globalThis.fetch, timeoutMs = 30000, proxyPrefix = "" } = {},
) {
  const target = `https://api.cloudflareclient.com/${apiVersion}/reg/${accountId}/account`;
  const url = proxyPrefix ? `${proxyPrefix}${encodeURIComponent(target)}` : target;
  const res = await fetchWithTimeout(
    fetchImpl,
    url,
    {
      method: "PATCH",
      headers: { ...CLIENT_HEADERS, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ license }),
      timeoutMs,
    },
  );
  return res.ok;
}

/**
 * Mask a license for logs (never print full account credentials).
 * @param {string} license raw license key.
 * @returns {string} first 4 + last 4 chars, or stars when too short.
 */
export function maskLicense(license) {
  const s = String(license || "");
  return s.length <= 8 ? "********" : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

/**
 * Validate generated profile text with the app's own rules.
 * Lazy-imports the frontend validator to keep this module import-light.
 * @param {string} text candidate .conf content.
 * @param {string} label config label used in diagnostics.
 * @returns {Promise<boolean>} true when the profile has zero blocking errors.
 */
export async function isValidProfile(text, label) {
  try {
    const { parseWGConfig } = await import("./converters.js");
    const { validateWGConfig, hasErrors } = await import("./validation.js");
    return !hasErrors(validateWGConfig(parseWGConfig(text), label));
  } catch {
    return false;
  }
}
