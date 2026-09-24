/**
 * Unit tests for direct WARP generation (no pool).
 * Run: node --test tools/warp-direct.test.mjs
 * No network, no DOM — all I/O is stubbed.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  b64urlToB64,
  buildWarpConf,
  PoolError,
  registerAccount,
  attachLicense,
  maskLicense,
  normalizeAddress,
  isValidProfile,
} from "../js/warp-profile.js";

const INLINE_CFG = {
  id: "dev-1",
  token: "tok",
  account: { license: "L", account_type: "free", warp_plus: false },
  config: {
    interface: { addresses: { v4: "172.16.0.2", v6: "" } },
    peers: [{ endpoint: { host: "engage.cloudflareclient.com:2408" }, public_key: `${"B".repeat(43)}=` }],
  },
};

const SAMPLE_CONF = [
  "# warp-direct",
  "[Interface]",
  `PrivateKey = ${"A".repeat(43)}=`,
  "Address = 172.16.0.2/32, 2606:4700:110:abcd::2/128",
  "DNS = 1.1.1.1, 1.0.0.1",
  "",
  "[Peer]",
  `PublicKey = ${"B".repeat(43)}=`,
  "AllowedIPs = 0.0.0.0/0, ::/0",
  "Endpoint = engage.cloudflareclient.com:2408",
  "",
].join("\n");

describe("profile core", () => {
  it("normalizes base64url to padded base64", () => {
    assert.equal(b64urlToB64("SGVsbG8"), "SGVsbG8=");
  });

  it("adds CIDR masks the API omits (bare IPs break real clients)", () => {
    assert.equal(normalizeAddress("172.16.0.2"), "172.16.0.2/32");
    assert.equal(normalizeAddress("2606:4700:110::2"), "2606:4700:110::2/128");
    assert.equal(normalizeAddress("10.0.0.2/32"), "10.0.0.2/32");
    assert.equal(normalizeAddress(""), "");
  });

  it("bakes MTU, keepalive and dual-stack DNS into profiles", () => {
    const text = buildWarpConf({
      name: "std",
      privateKey: `${"A".repeat(43)}=`,
      addresses: { v4: "172.16.0.2/32", v6: "" },
      endpointHost: "engage.cloudflareclient.com",
      endpointPort: 2408,
      peerPublicKey: `${"B".repeat(43)}=`,
    });
    assert.ok(text.includes("MTU = 1280"));
    assert.ok(text.includes("PersistentKeepalive = 25"));
    assert.ok(text.includes("2606:4700:4700::1111"));
    assert.ok(text.includes("Endpoint = engage.cloudflareclient.com:2408"));
    assert.ok(!text.includes(":2408:2408"));
  });

  it("validates profiles with the frontend rules", async () => {
    assert.equal(await isValidProfile(SAMPLE_CONF, "unit"), true);
    assert.equal(await isValidProfile("### nope", "unit"), false);
  });

  it("classifies retryable API failures", () => {
    assert.equal(new PoolError("register", 429).retryable, true);
    assert.equal(new PoolError("register", 503).retryable, true);
    assert.equal(new PoolError("register", 400).retryable, false);
    assert.equal(new PoolError("register", 401).retryable, false);
  });
});

describe("registerAccount", () => {
  it("uses inline POST config without a second GET", async () => {
    let gets = 0;
    const fetchImpl = async (url, init) => {
      if (init?.method === "POST") {
        assert.ok(JSON.parse(init.body).warp_enabled === true);
        return { ok: true, json: () => Promise.resolve(INLINE_CFG) };
      }
      gets++;
      return { ok: false, status: 500 };
    };
    const account = await registerAccount(`${"C".repeat(43)}=`, { fetchImpl });
    assert.equal(gets, 0);
    assert.equal(account.endpointHost, "engage.cloudflareclient.com");
    assert.equal(account.endpointPort, 2408);
    assert.equal(account.accountType, "free");
  });

  it("attaches licenses with masked logging", async () => {
    let seen = null;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return { ok: true };
    };
    const ok = await attachLicense(
      { apiVersion: "v0a737", accountId: "dev-1", token: "tok", license: "AAAA-BBBB-CCCC" },
      { fetchImpl },
    );
    assert.equal(ok, true);
    assert.ok(seen.url.endsWith("/v0a737/reg/dev-1/account"));
    assert.ok(JSON.parse(seen.init.body).license === "AAAA-BBBB-CCCC");
    assert.equal(maskLicense("AAAA-BBBB-CCCC"), "AAAA…CCCC");
  });
});

describe("x25519 (RFC 7748 §6.1 vectors)", () => {
  const VECTORS = [
    {
      priv: "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a",
      pub: "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a",
    },
    {
      priv: "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb",
      pub: "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f",
    },
  ];

  it("derives both public keys", async () => {
    const { x25519GetPublic, hexToBytes, bytesToHex } = await import("../js/x25519.js");
    for (const { priv, pub } of VECTORS) {
      assert.equal(bytesToHex(x25519GetPublic(hexToBytes(priv))), pub);
    }
  });

  it("agrees on the shared secret both ways", async () => {
    const { x25519ScalarMult, hexToBytes, bytesToHex } = await import("../js/x25519.js");
    const [a, b] = VECTORS;
    const kab = bytesToHex(x25519ScalarMult(hexToBytes(a.priv), hexToBytes(b.pub)));
    const kba = bytesToHex(x25519ScalarMult(hexToBytes(b.priv), hexToBytes(a.pub)));
    assert.equal(kab, kba);
    assert.equal(kab, "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742");
  });
});

describe("warp-direct", () => {
  it("registers through a proxy prefix and builds a valid profile", async () => {
    const { registerDirectAccount } = await import("../js/warp-direct.js");
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push(url);
      return { ok: true, json: () => Promise.resolve(INLINE_CFG) };
    };
    const result = await registerDirectAccount({
      proxies: [{ name: "test-proxy", prefix: "https://proxy.test/?url=" }],
      fetchImpl,
    });
    assert.ok(seen[0].startsWith("https://proxy.test/?url=https%3A%2F%2Fapi.cloudflareclient.com"));
    assert.ok(result.profile.includes("MTU = 1280"));
    assert.ok(result.profile.includes("PersistentKeepalive = 25"));
    assert.match(result.privateKey, /^[A-Za-z0-9+/]{43}=$/);
    assert.equal(result.proxyName, "test-proxy");
  });

  it("reports unreachable when all proxies fail at transport level", async () => {
    const { registerDirectAccount } = await import("../js/warp-direct.js");
    const fetchImpl = async () => { throw new TypeError("fetch failed"); };
    await assert.rejects(
      registerDirectAccount({ proxies: [{ name: "x", prefix: "https://x/" }], fetchImpl }),
      /unreachable/,
    );
  });

  it("reports rejected when a server answers with HTTP errors", async () => {
    const { registerDirectAccount } = await import("../js/warp-direct.js");
    const fetchImpl = async () => ({ ok: false, status: 403 });
    await assert.rejects(
      registerDirectAccount({ proxies: [{ name: "x", prefix: "https://x/" }], fetchImpl }),
      /rejected/,
    );
  });

  it("tries the next proxy after a failure", async () => {
    const { registerDirectAccount } = await import("../js/warp-direct.js");
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      if (url.startsWith("https://one/")) throw new Error("down");
      return { ok: true, json: () => Promise.resolve(INLINE_CFG) };
    };
    const result = await registerDirectAccount({
      proxies: [
        { name: "one", prefix: "https://one/" },
        { name: "two", prefix: "https://two/" },
      ],
      fetchImpl,
    });
    assert.equal(result.proxyName, "two");
    assert.ok(calls.some((u) => u.startsWith("https://two/")));
  });

  it("builds the relay chain: worker → corsproxy.dev (no SDK in unit env)", async () => {
    const { resolveProxies } = await import("../js/warp-direct.js");
    const chain = resolveProxies();
    assert.equal(chain.length, 2);
    assert.equal(chain[0].name, "worker");
    assert.ok(chain[0].prefix.startsWith("https://"));
    assert.equal(chain[0].fetch, "native");
    assert.equal(chain[1].name, "corsproxy");
    assert.ok(chain[1].prefix.startsWith("https://api.corsproxy.dev/"));
    assert.equal(chain[1].fetch, "native");
    // Empty primary prefix disables the whole chain (gen_no_relay).
    assert.deepEqual(resolveProxies(""), []);
    // Test-only injection replaces the chain with a single native entry.
    assert.deepEqual(resolveProxies("https://relay.test/?url="), [
      { name: "primary", prefix: "https://relay.test/?url=", fetch: "native" },
    ]);
  });

  it("appends the Corsfix SDK as last relay when loaded", async () => {
    const { resolveProxies, hasCorsfixSdk, defaultDirectFetch } = await import("../js/warp-direct.js");
    assert.equal(hasCorsfixSdk(), false);
    globalThis.corsfix = {
      fetch: async (url, init) => ({ ok: true, url, init, json: async () => ({}) }),
    };
    try {
      assert.equal(hasCorsfixSdk(), true);
      // Order matters: worker → corsproxy → SDK; SDK entry has an empty
      // prefix (the SDK proxies the raw target itself) and sdk fetch mode.
      const chain = resolveProxies();
      assert.equal(chain.length, 3);
      assert.deepEqual(
        chain.map((p) => p.name),
        ["worker", "corsproxy", "corsfix-sdk"],
      );
      assert.equal(chain[2].prefix, "");
      assert.equal(chain[2].fetch, "sdk");
      const doFetch = defaultDirectFetch();
      const res = await doFetch("https://example.com/x", { method: "GET" });
      assert.equal(res.ok, true);
      assert.equal(res.url, "https://example.com/x");
    } finally {
      delete globalThis.corsfix;
    }
  });

  it("routes each entry through its own fetch (native vs sdk)", async () => {
    const { registerDirectAccount, resolveProxies } = await import("../js/warp-direct.js");
    let sdkCalls = 0;
    globalThis.corsfix = {
      fetch: async () => {
        sdkCalls++;
        return { ok: true, json: async () => INLINE_CFG };
      },
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      // Transport-dead for worker + injected test prefixes only;
      // corsproxy.dev answers normally (the sdk entry never hits fetch).
      if (/workers\.dev|relay\.test/.test(String(url))) throw new TypeError("fetch failed");
      return { ok: true, json: async () => INLINE_CFG };
    };
    try {
      // Default chain: worker (native, transport-dead) → corsproxy (native, ok).
      const a = await registerDirectAccount({});
      assert.equal(a.proxyName, "corsproxy");
      assert.equal(sdkCalls, 0);
      // Chain ending in the sdk entry: native dead → corsfix.fetch answers.
      const b = await registerDirectAccount({
        proxies: [
          ...resolveProxies("https://relay.test/?url="),
          { name: "sdk", prefix: "", fetch: "sdk" },
        ],
      });
      assert.equal(b.proxyName, "sdk");
      assert.equal(sdkCalls, 1);
    } finally {
      globalThis.fetch = realFetch;
      delete globalThis.corsfix;
    }
  });

  it("reports no_relay when nothing is configured", async () => {
    const { registerDirectAccount } = await import("../js/warp-direct.js");
    await assert.rejects(registerDirectAccount({ proxies: [] }), /no_relay/);
    await assert.rejects(registerDirectAccount({ proxies: [] }), (err) => err.code === "no_relay");
  });
});

describe("self-host relay", () => {
  it("answers preflight and rejects non-allowlisted targets", async () => {
    const { spawn } = await import("node:child_process");
    const port = 18787;
    const child = spawn(process.execPath, ["proxy/server.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, PORT: String(port) },
      stdio: "ignore",
    });
    try {
      const base = `http://localhost:${port}`;
      let ready = false;
      for (let i = 0; i < 50 && !ready; i++) {
        try {
          const res = await fetch(`${base}/?url=${encodeURIComponent("https://example.com")}`);
          ready = true;
        } catch {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      assert.ok(ready, "relay did not start");
      const preflight = await fetch(`${base}/?url=${encodeURIComponent("https://example.com")}`, { method: "OPTIONS" });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
      const evil = await fetch(`${base}/?url=${encodeURIComponent("https://evil.example/x")}`);
      assert.equal(evil.status, 403);
    } finally {
      child.kill();
    }
  });
});

describe("converters regression: leading comments", () => {
  it("drops head chunks without [Interface] instead of phantom configs", async () => {
    const { parseMultipleWGConfigs } = await import("../js/converters.js");
    const withComment = `# My Server\n${SAMPLE_CONF}`;
    assert.equal(parseMultipleWGConfigs(withComment).length, 1);
    assert.equal(parseMultipleWGConfigs("just some text").length, 0);
    assert.equal(parseMultipleWGConfigs("").length, 0);
  });
});

describe("keepalive conversion", () => {
  const baseSettings = (persistent) => ({
    junkMode: "light", amnezia15: false, advanced: false,
    jc: "", jmin: "", jmax: "", randomPerConfig: false,
    i1: "", i2: "", i3: "", i4: "", i5: "",
    adv: { padding: "", rekeyAfter: "", rekeyTimeout: "", rejectAfter: "", keepalive: "", handshake: "", persistent, disableCookies: false },
    dns: { enabled: false, provider: "google", custom: "" },
    mtu: { enabled: false, value: "" },
    ws: { junkMode: "light", jc: "", jmin: "", jmax: "", id: "x.com", ip: "QUIC", ib: "Chrome" },
  });

  it("carries PersistentKeepalive through conversion (setting wins, else original)", async () => {
    const { convertToProxy, singleAWGConfig, singleWiresockConfig, parseWGConfig } = await import("../js/converters.js");
    const withOrig = parseWGConfig(
      `[Interface]\nPrivateKey = ${"A".repeat(43)}=\nAddress = 10.0.0.2/32\n\n[Peer]\nPublicKey = ${"B".repeat(43)}=\nAllowedIPs = 0.0.0.0/0\nEndpoint = 1.2.3.4:51820\nPersistentKeepalive = 25\n`,
    );
    const kept = convertToProxy(withOrig, "t.conf", baseSettings(""), "awg", false);
    assert.ok(singleAWGConfig(kept).includes("PersistentKeepalive = 25"));
    const overridden = convertToProxy(withOrig, "t.conf", baseSettings("60"), "awg", false);
    assert.ok(singleAWGConfig(overridden).includes("PersistentKeepalive = 60"));
    const wsOut = singleWiresockConfig(convertToProxy(withOrig, "t.conf", baseSettings(""), "wiresocket", false));
    assert.ok(wsOut.includes("PersistentKeepalive = 25"));
    const bare = parseWGConfig(
      `[Interface]\nPrivateKey = ${"A".repeat(43)}=\nAddress = 10.0.0.2/32\n\n[Peer]\nPublicKey = ${"B".repeat(43)}=\nAllowedIPs = 0.0.0.0/0\nEndpoint = 1.2.3.4:51820\n`,
    );
    assert.ok(!singleAWGConfig(convertToProxy(bare, "t.conf", baseSettings(""), "awg", false)).includes("PersistentKeepalive"));
  });
});
