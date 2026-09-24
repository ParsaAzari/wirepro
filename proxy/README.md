# Self-hosted CORS relay

The browser cannot call Cloudflare’s WARP API directly — the API sends no CORS headers. A small relay in front of it forwards **only the public key** and returns the registration response. You own the process; nothing is logged or stored.

There is **no proxy settings form** in the app. The relay chain is fixed in [`js/warp-direct.js`](../js/warp-direct.js) (`WORKER_PREFIX` → `CORSPROXY_PREFIX` → Corsfix SDK). The Worker below is the **primary** relay; point `WORKER_PREFIX` at yours and Auto Generate works without asking visitors for anything.

## Option A — Cloudflare Worker (primary, easiest, free)

1. Open dash.cloudflare.com → Workers & Pages → Create → Start from scratch.
2. Paste the contents of [`worker.js`](worker.js).
3. Deploy. You get a URL like `https://xxx.workers.dev`.
4. In `js/warp-direct.js`, set:

   ```js
   const WORKER_PREFIX = "https://xxx.workers.dev/?url=";
   ```

The Worker ships with two allowlists — keep both in sync with where you serve the app:

- **Target**: only `api.cloudflareclient.com`.
- **Origin**: only your site origin + `localhost` / `127.0.0.1` (any port). A foreign page gets `403` with no CORS headers, so it cannot read the response.

## Option B — any Node host (VPS / Railway / Render / Fly)

```bash
node proxy/server.mjs   # uses PORT or 8787
```

Then:

```js
const WORKER_PREFIX = "http://YOUR-HOST:8787/?url=";
```

For production, put TLS in front (HTTPS). Browsers treat plain `http://` origins as mixed content on an HTTPS site.

## Security model

- Allowlisted target: `api.cloudflareclient.com` only — anything else returns 403.
- Allowlisted origins: site + localhost only — anything else returns 403 without CORS headers.
- Keys are generated in the browser; **only the public key** passes through the relay.
- No logs, no database, no third-party API keys in the relay itself.
- The `corsproxy.dev` fallback key in `CORSPROXY_PREFIX` is origin-locked in its own dashboard — keep that lock in sync too.

## Why generation cannot be fully offline

A WARP interface address, peer endpoint, and peer public key come from Cloudflare at registration time. Tools that claim fully offline WARP generation are inventing values that will not work. Honest options are: this relay, a managed CORS proxy, or pasting a config by hand (step 1 of the app always works with no network on our side).

## Related

- App overview and setup: [README.md](../README.md)
