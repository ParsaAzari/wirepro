/**
 * Minimal self-hosted CORS relay for WARP registration (Node 20+, zero deps).
 *
 * Run:  node proxy/server.mjs            (listens on PORT or 8787)
 * Then: set the app's proxy setting to  http://YOUR-HOST:8787/?url=
 *
 * Same security model as proxy/worker.js: allowlisted to Cloudflare's
 * WARP API, no logs, no storage, private keys never touch the wire.
 */
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { fileURLToPath } from "node:url";

const UPSTREAM_HOST = "api.cloudflareclient.com";
const PORT = Number(process.env.PORT || 8787);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, CF-Client-Version, User-Agent",
  "Access-Control-Max-Age": "86400",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  for (const [key, value] of Object.entries(CORS_HEADERS)) res.setHeader(key, value);
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  const targetParam = new URL(req.url, "http://local").searchParams.get("url");
  let path = targetParam ? decodeURIComponent(targetParam).replace(`https://${UPSTREAM_HOST}`, "") : "/";
  if (!path.startsWith("/")) {
    res.writeHead(403, { "Content-Type": "application/json" }).end('"Forbidden"');
    return;
  }

  try {
    const body = await readBody(req);
    const upstream = httpsRequest(
      {
        host: UPSTREAM_HOST,
        port: 443,
        path,
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          "CF-Client-Version": req.headers["cf-client-version"] ?? "a-6.11-2223",
          "User-Agent": "okhttp/3.12.1",
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
          "Content-Length": body.length,
        },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, { "Content-Type": "application/json" });
        upstreamRes.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502, { "Content-Type": "application/json" }).end('"Upstream unreachable"');
    });
    upstream.end(body);
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" }).end('"Relay error"');
  }
});

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  server.listen(PORT, () => {
    console.log(`WARP CORS relay on :${PORT} (allowlisted to ${UPSTREAM_HOST} only)`);
  });
}

export { server, UPSTREAM_HOST };
