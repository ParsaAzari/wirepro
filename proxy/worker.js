/**
 * Self-hosted CORS relay for WARP registration (primary relay of the chain).
 *
 * The browser cannot call api.cloudflareclient.com directly — the API
 * sends no CORS headers. This Worker forwards the request, adds CORS, and
 * returns the response. Only the PUBLIC key ever crosses the relay.
 *
 * Deploy: Cloudflare dashboard → Workers & Pages → Create → paste → Deploy.
 * The frontend prefix is `https://YOUR-WORKER.workers.dev/?url=`
 * (WORKER_PREFIX in js/warp-direct.js).
 *
 * Security model:
 * - Target allowlist: only https://api.cloudflareclient.com (else 403).
 * - Origin allowlist: only the site origin + localhost (else 403, no CORS
 *   headers, so a foreign page cannot read anything). Keep both lists in
 *   sync with where the app is served from.
 * - No logs, no storage, no API keys.
 */

const UPSTREAM = "https://api.cloudflareclient.com";

/** Browser origins allowed to use this relay (exact origin, no path). */
const ALLOWED_ORIGINS = [
  "https://parsaazari.github.io", // GitHub Pages (production)
  "http://localhost",             // dev servers, any port (prefix match below)
  "http://127.0.0.1",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, CF-Client-Version, User-Agent",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

/** Origin matches the allowlist (localhost/127.0.0.1 accept any port). */
function originAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(
    (base) => origin === base || origin.startsWith(`${base}:`),
  );
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");

    // Preflight: answer only for allowed origins.
    if (request.method === "OPTIONS") {
      if (!originAllowed(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin },
      });
    }

    // Real requests: reject foreign origins before touching upstream.
    if (!originAllowed(origin)) {
      return new Response("Forbidden: origin not allowed", { status: 403 });
    }

    const url = new URL(request.url);
    // App calls: "?url=" + encodeURIComponent(target) (already decoded by URLSearchParams).
    const targetParam = url.searchParams.get("url");
    const upstreamUrl = targetParam
      ? targetParam
      : UPSTREAM + url.pathname.replace(/^\/proxy/, "");

    if (!upstreamUrl.startsWith(UPSTREAM + "/")) {
      return new Response("Forbidden: allowlisted to Cloudflare WARP API only", {
        status: 403,
        headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin },
      });
    }

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          "CF-Client-Version": request.headers.get("CF-Client-Version") ?? "a-6.11-2223",
          "User-Agent": "okhttp/3.12.1",
          ...(request.headers.get("Authorization")
            ? { Authorization: request.headers.get("Authorization") }
            : {}),
        },
        body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(),
      });
    } catch {
      return new Response(JSON.stringify({ error: "upstream unreachable" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" },
      });
    }

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        "Access-Control-Allow-Origin": origin,
        "Content-Type": "application/json",
      },
    });
  },
};
