/**
 * Conversion engine: parsing, proxy mapping, and per-format generators.
 * All functions are pure (explicit inputs, no DOM reads) except the
 * generate*Defaults helpers, which take a settings snapshot instead.
 * To add a format: add a generator + register it in FORMAT_REGISTRY.
 */
import {
  AMNEZIA_KEYS, AMNEZIA15_KEYS, AMNEZIA_ADV_KEYS,
  CLASH_ADV_KEY_MAP, COUNTRY_FLAGS, COUNTRY_TLDS, COUNTRY_NAMES,
  DNS_PROVIDERS, AMNEZIA_I1_DEFAULT,
} from "./config.js";
import { getRandomInt } from "./utils.js";

/** Parse one .conf text into {interface, peers}. */
export function parseWGConfig(text) {
  const config = { interface: { amneziaOptions: {} }, peers: [] };
  let currentSection = null;
  const optionKeys = [...AMNEZIA_KEYS, ...AMNEZIA15_KEYS, ...AMNEZIA_ADV_KEYS, "id", "ip", "ib"];

  for (const line of String(text).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (currentSection === "peer" && trimmed.startsWith("#")) {
      const nameMatch = trimmed.match(/#\s*(.+)/);
      if (nameMatch && config.peers.length > 0) {
        config.peers[config.peers.length - 1].name = nameMatch[1].trim();
      }
      continue;
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1).toLowerCase();
      if (currentSection === "peer") config.peers.push({ amneziaOptions: {} });
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim().toLowerCase();
    const value = trimmed.slice(eq + 1).trim();

    if (currentSection === "interface") {
      const target = optionKeys.includes(key) ? config.interface.amneziaOptions : config.interface;
      target[key] = value;
    } else if (currentSection === "peer" && config.peers.length > 0) {
      const peer = config.peers[config.peers.length - 1];
      if (optionKeys.includes(key)) peer.amneziaOptions[key] = value;
      else if (key === "presharedkey") peer.presharedKey = value;
      else peer[key] = value;
    }
  }
  return config;
}

/**
 * Split pasted multi-config text on [Interface] boundaries.
 * Leading comment lines (e.g. "# My Server" above the first section)
 * form a head chunk without any section — it is dropped so it never
 * becomes a phantom empty config that blocks validation.
 * @param {string} text raw pasted .conf content (one or many configs).
 * @returns {object[]} parsed configs, each with {interface, peers}.
 */
export function parseMultipleWGConfigs(text) {
  return String(text).split(/\n(?=\[Interface\])/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && /\[Interface\]/i.test(p))
    .map((p) => parseWGConfig(p));
}

/** Guess a country code from an endpoint hostname (TLD, then keywords, then 2-letter tokens). */
export function detectCountryFromEndpoint(hostname) {
  if (!hostname) return null;
  const host = hostname.replace(/:\d+$/, "").toLowerCase();
  for (const segment of host.split(/[.\-]/)) {
    const match = segment.match(/^([a-zA-Z]{2})\d*$/);
    if (match && COUNTRY_FLAGS[match[1].toUpperCase()]) return match[1].toUpperCase();
  }
  for (const [tld, code] of Object.entries(COUNTRY_TLDS)) {
    if (host.endsWith(tld)) return code;
  }
  for (const [name, code] of Object.entries(COUNTRY_NAMES)) {
    if (host.includes(name)) return code;
  }
  return null;
}

/** Resolve junk values from a settings snapshot (per-config random or preset/custom). */
export function junkFromSettings(s, usePerConfigRandom = false) {
  if (usePerConfigRandom) {
    const jc = getRandomInt(1, 128);
    const jmin = getRandomInt(1, 1279);
    return { jc, jmin, jmax: getRandomInt(jmin + 1, 1280) };
  }
  const presets = {
    light: { jc: 3, jmin: 1, jmax: 3 },
    heavy: { jc: 5, jmin: 10, jmax: 40 },
    custom: {
      jc: parseInt(s.jc, 10) || 128,
      jmin: parseInt(s.jmin, 10) || 1279,
      jmax: parseInt(s.jmax, 10) || 1280,
    },
  };
  const cfg = presets[s.junkMode] || presets.custom;
  if (cfg.jmax <= cfg.jmin) cfg.jmax = cfg.jmin + 1;
  return { ...cfg };
}

/** Build Amnezia options from a settings snapshot (junk + 1.5 + advanced). */
export function amneziaOptionsFromSettings(s, usePerConfigRandom = false) {
  const result = { ...junkFromSettings(s, usePerConfigRandom), s1: 0, s2: 0, h1: 1, h2: 2, h3: 3, h4: 4 };
  if (s.amnezia15) {
    result.i1 = s.i1 || AMNEZIA_I1_DEFAULT;
    result.i2 = s.i2 || "";
    result.i3 = s.i3 || "";
    result.i4 = s.i4 || "";
    result.i5 = s.i5 || "";
  }
  if (s.advanced) {
    const pairs = [
      ["contentpaddingaddition", s.adv.padding], ["rekeyaftertime", s.adv.rekeyAfter],
      ["rekeytimeout", s.adv.rekeyTimeout], ["rejectaftertime", s.adv.rejectAfter],
      ["keepalivetimeout", s.adv.keepalive], ["maxhandshakeattempts", s.adv.handshake],
    ];
    for (const [key, raw] of pairs) {
      const v = normalizeAdvValue(raw);
      if (v) result[key] = v;
    }
    if (s.adv.disableCookies) result.disablecookies = "on";
  }
  return result;
}

/** Build Wiresock options from a settings snapshot. */
export function wiresockOptionsFromSettings(s) {
  const presets = {
    light: { jc: 3, jmin: 1, jmax: 3 },
    heavy: { jc: 5, jmin: 10, jmax: 40 },
  };
  let base = presets[s.ws.junkMode];
  if (!base) {
    const jc = parseInt(s.ws.jc, 10) || 128;
    const jmin = parseInt(s.ws.jmin, 10) || 1279;
    let jmax = parseInt(s.ws.jmax, 10) || 1280;
    if (jmax <= jmin) jmax = jmin + 1;
    base = { jc, jmin, jmax };
  }
  return { ...base, s1: 0, s2: 0, h1: 1, h2: 2, h3: 3, h4: 4, id: s.ws.id, ip: s.ws.ip, ib: s.ws.ib };
}

/** Resolve effective DNS list from settings (null = keep config DNS). */
export function dnsFromSettings(s) {
  if (!s.dns.enabled) return null;
  if (s.dns.provider === "custom") return s.dns.custom.trim() || null;
  return DNS_PROVIDERS[s.dns.provider] || DNS_PROVIDERS.google;
}

/** Normalize "N" or "A-B" advanced values; null when invalid. */
export function normalizeAdvValue(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) return null;
  let a = parseInt(m[1], 10);
  let b = m[2] !== undefined ? parseInt(m[2], 10) : a;
  if (a > 65535 || b > 65535) return null;
  if (b < a) [a, b] = [b, a];
  return a === b ? `${a}` : `${a}-${b}`;
}

/** Resolve PersistentKeepalive: explicit Advanced setting wins, else the original peer value. */
export function keepaliveFromSettings(s, peerData) {
  const raw = (s.adv?.persistent ?? "").trim();
  if (raw) {
    const v = parseInt(raw, 10);
    if (!Number.isNaN(v) && v >= 0 && v <= 65535) return v;
  }
  const orig = parseInt(peerData?.persistentkeepalive, 10);
  return !Number.isNaN(orig) && orig >= 0 && orig <= 65535 ? orig : null;
}

/** Resolve effective MTU (null = default 1420 downstream). */
export function mtuFromSettings(s) {
  if (!s.mtu.enabled) return null;
  const v = parseInt(s.mtu.value, 10);
  return Number.isNaN(v) || v < 576 || v > 1500 ? 1420 : v;
}

/**
 * Map a parsed config to the internal proxy model.
 * NOTE: country-flag prefixing is preserved from legacy behavior.
 * @param {object} wgConfig parsed config ({interface, peers}).
 * @param {string} fileName source file name (fallback display name).
 * @param {object} settings snapshot from readSettings().
 * @param {"awg"|"clash"|"wiresocket"} [format="awg"] output family.
 * @param {boolean} [usePerConfigRandom=false] fresh junk values per config.
 * @returns {object} proxy model consumed by the FORMAT_REGISTRY builders.
 */
export function convertToProxy(wgConfig, fileName, settings, format = "awg", usePerConfigRandom = false) {
  const { interface: ifaceData, peers } = wgConfig;
  const peerData = peers[0];
  if (!peerData?.endpoint) throw new Error("Missing peer endpoint");

  const colonIdx = peerData.endpoint.lastIndexOf(":");
  const server = peerData.endpoint.slice(0, colonIdx);
  const port = peerData.endpoint.slice(colonIdx + 1);

  const customDNS = dnsFromSettings(settings);
  const dnsList = customDNS
    ? customDNS.split(",").map((d) => d.trim())
    : (ifaceData.dns ? ifaceData.dns.split(",").map((d) => d.trim()) : []);

  let options;
  if (format === "wiresocket") {
    options = wiresockOptionsFromSettings(settings);
    options.id = ifaceData.amneziaOptions.id || peerData.amneziaOptions?.id || options.id;
    options.ip = ifaceData.amneziaOptions.ip || peerData.amneziaOptions?.ip || options.ip;
    options.ib = ifaceData.amneziaOptions.ib || peerData.amneziaOptions?.ib || options.ib;
  } else {
    options = amneziaOptionsFromSettings(settings, usePerConfigRandom);
    for (const key of [...AMNEZIA15_KEYS, ...AMNEZIA_KEYS, ...AMNEZIA_ADV_KEYS]) {
      const v = ifaceData.amneziaOptions[key] || peerData.amneziaOptions?.[key];
      if (v) options[key] = v;
    }
  }

  let proxyName = peerData.name || fileName.replace(".conf", "");
  const originalName = proxyName;
  if (!proxyName) {
    proxyName = `Random_${Math.random().toString(36).slice(2, 7)}`;
  } else {
    proxyName = proxyName.replace(/FREE#?/gi, "").trim();
    const isolatedTokens = proxyName.replace(/[[\](){}\-_]/g, " ").replace(/\d+/g, " ");
    const candidates = isolatedTokens.match(/\b[a-zA-Z]{2}\b/g);
    let code = candidates?.map((c) => c.toUpperCase()).find((c) => COUNTRY_FLAGS[c]) || null;
    if (!code) code = detectCountryFromEndpoint(server);
    if (code) {
      const flagEmoji = COUNTRY_FLAGS[code].split(" ")[0];
      const cleanRegex = new RegExp(`[\\s\\[\\(-\\_\\]]*${code}[\\s\\]\\)-\\_\\]]*`, "i");
      let cleaned = proxyName.replace(cleanRegex, " ").replace(/\s+/g, " ").trim();
      if (!cleaned || cleaned === "-") cleaned = originalName.replace(".conf", "");
      proxyName = `${flagEmoji} ${cleaned}`;
    }
    proxyName = proxyName.replace(/[-\s_]+$/, "").trim();
  }

  const result = {
    name: proxyName,
    originalName,
    type: "wireguard",
    server: server.replace(/^\[|\]$/g, ""),
    serverRaw: server,
    port: parseInt(port, 10),
    ip: ifaceData.address,
    private_key: ifaceData.privatekey,
    public_key: peerData.publickey,
    preshared_key: peerData.presharedKey,
    allowed_ips: peerData.allowedips ? peerData.allowedips.split(",").map((ip) => `'${ip.trim()}'`) : [],
    udp: true,
    mtu: mtuFromSettings(settings) || 1420,
    remote_dns_resolve: true,
    dns: dnsList,
    persistent_keepalive: keepaliveFromSettings(settings, peerData),
  };
  result[format === "wiresocket" ? "wiresocket-options" : "amnezia-options"] = options;
  return result;
}

/** Render amnezia-wg-option YAML block for Clash. */
export function amneziaOptionsYAML(options) {
  const entries = Object.entries(options)
    .filter(([key, value]) => value !== undefined && value !== "" &&
      [...AMNEZIA_KEYS, ...AMNEZIA15_KEYS, ...AMNEZIA_ADV_KEYS].includes(key))
    .map(([key, value]) => {
      const outKey = CLASH_ADV_KEY_MAP[key] || key;
      return `    ${outKey}: ${key === "disablecookies" ? "true" : value}`;
    })
    .join("\n");
  return entries ? `  amnezia-wg-option:\n${entries}\n` : "";
}

/** Render the Clash proxy-groups section. */
export function proxyGroupsYAML(proxies) {
  if (!proxies.length) return "";
  const names = proxies.map((p) => `    - ${p.name}`).join("\n");
  return `\n- name: DPI\n  type: select\n  icon: https://raw.githubusercontent.com/zaeboba/page/refs/heads/main/archive/wireguard.svg\n  proxies:\n${names}\n  url: 'http://speed.cloudflare.com/'\n  unified-delay: true\n  interval: 300`;
}

function clashProxyBlock(proxy) {
  const parts = [
    `- name: ${proxy.name}`, `  type: ${proxy.type}`, `  server: ${proxy.server}`,
    `  port: ${proxy.port}`, `  ip: ${proxy.ip}`, `  private-key: ${proxy.private_key}`,
    `  public-key: ${proxy.public_key}`,
  ];
  if (proxy.preshared_key) parts.push(`  pre-shared-key: ${proxy.preshared_key}`);
  parts.push(
    `  allowed-ips: [${proxy.allowed_ips.join(", ")}]`, `  udp: ${proxy.udp}`,
    `  mtu: ${proxy.mtu}`, `  remote-dns-resolve: ${proxy.remote_dns_resolve}`,
    `  dns: [${proxy.dns.join(", ")}]`, amneziaOptionsYAML(proxy["amnezia-options"]),
  );
  return parts.join("\n");
}

/** Full multi-proxy Clash YAML. */
export function clashCombined(proxies) {
  return `proxies:\n${proxies.map(clashProxyBlock).join("\n")}\nproxy-groups:${proxyGroupsYAML(proxies)}`;
}

/** One AmneziaWG .conf text. */
export function singleAWGConfig(proxy) {
  const o = proxy["amnezia-options"] || {};
  const lines = [
    `# ${proxy.originalName || "Unnamed config"}`, "[Interface]",
    `PrivateKey = ${proxy.private_key}`, `Address = ${proxy.ip}`,
  ];
  if (proxy.dns?.length) lines.push(`DNS = ${proxy.dns.join(", ")}`);
  lines.push(`MTU = ${proxy.mtu}`,
    `Jc = ${o.jc ?? 128}`, `Jmin = ${o.jmin ?? 1279}`, `Jmax = ${o.jmax ?? 1280}`,
    `S1 = ${o.s1 ?? 0}`, `S2 = ${o.s2 ?? 0}`,
    `H1 = ${o.h1 ?? 1}`, `H2 = ${o.h2 ?? 2}`, `H3 = ${o.h3 ?? 3}`, `H4 = ${o.h4 ?? 4}`);
  if (o.i1) lines.push(`I1 = ${o.i1}`);
  if (o.i2) lines.push(`I2 = ${o.i2}`);
  if (o.i3) lines.push(`I3 = ${o.i3}`);
  if (o.i4) lines.push(`I4 = ${o.i4}`);
  if (o.i5) lines.push(`I5 = ${o.i5}`);
  if (o.contentpaddingaddition) lines.push(`ContentPaddingAddition = ${o.contentpaddingaddition}`);
  if (o.rekeyaftertime) lines.push(`RekeyAfterTime = ${o.rekeyaftertime}`);
  if (o.rekeytimeout) lines.push(`RekeyTimeout = ${o.rekeytimeout}`);
  if (o.rejectaftertime) lines.push(`RejectAfterTime = ${o.rejectaftertime}`);
  if (o.keepalivetimeout) lines.push(`KeepaliveTimeout = ${o.keepalivetimeout}`);
  if (o.maxhandshakeattempts) lines.push(`MaxHandshakeAttempts = ${o.maxhandshakeattempts}`);
  if (o.disablecookies) lines.push("DisableCookies = on");
  lines.push("", "[Peer]", `PublicKey = ${proxy.public_key}`);
  if (proxy.preshared_key) lines.push(`PresharedKey = ${proxy.preshared_key}`);
  lines.push(
    `AllowedIPs = ${proxy.allowed_ips.join(", ").replace(/'/g, "")}`,
    `Endpoint = ${proxy.serverRaw || proxy.server}:${proxy.port}`,
  );
  if (proxy.persistent_keepalive !== null && proxy.persistent_keepalive !== undefined) {
    lines.push(`PersistentKeepalive = ${proxy.persistent_keepalive}`);
  }
  return lines.join("\n");
}

/** One Wiresock .conf text. */
export function singleWiresockConfig(proxy) {
  const o = proxy["wiresocket-options"] || {};
  const lines = [
    `# ${proxy.originalName || "Unnamed config"}`, "[Interface]",
    `PrivateKey = ${proxy.private_key}`, `Address = ${proxy.ip}`,
  ];
  if (proxy.dns?.length) lines.push(`DNS = ${proxy.dns.join(", ")}`);
  lines.push(`MTU = ${proxy.mtu}`,
    `Jc = ${o.jc ?? 128}`, `Jmin = ${o.jmin ?? 1279}`, `Jmax = ${o.jmax ?? 1280}`,
    `S1 = ${o.s1 ?? 0}`, `S2 = ${o.s2 ?? 0}`,
    `H1 = ${o.h1 ?? 1}`, `H2 = ${o.h2 ?? 2}`, `H3 = ${o.h3 ?? 3}`, `H4 = ${o.h4 ?? 4}`);
  if (o.id) lines.push(`Id = ${o.id}`);
  if (o.ip) lines.push(`Ip = ${o.ip}`);
  if (o.ib) lines.push(`Ib = ${o.ib}`);
  lines.push("", "[Peer]", `PublicKey = ${proxy.public_key}`);
  if (proxy.preshared_key) lines.push(`PresharedKey = ${proxy.preshared_key}`);
  lines.push(
    `AllowedIPs = ${proxy.allowed_ips.join(", ").replace(/'/g, "")}`,
    `Endpoint = ${proxy.serverRaw || proxy.server}:${proxy.port}`,
  );
  if (proxy.persistent_keepalive !== null && proxy.persistent_keepalive !== undefined) {
    lines.push(`PersistentKeepalive = ${proxy.persistent_keepalive}`);
  }
  return lines.join("\n");
}

/**
 * Human-friendly source name for a pasted config.
 * Prefers the peer's # name comment, then the endpoint hostname,
 * falling back to a numbered config name. Never "pasted_N".
 * @param {object} wgConfig parsed config (peer name/endpoint are read).
 * @param {number} index zero-based position (used for the fallback name).
 * @returns {string} human-friendly name ending in ".conf".
 */
export function inferConfigName(wgConfig, index) {
  const peer = wgConfig.peers?.[0] || {};
  const clean = (s) => String(s || "").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 48);
  if (peer.name && clean(peer.name)) return `${clean(peer.name)}.conf`;
  const host = String(peer.endpoint || "").split(":")[0].replace(/^\[|\]$/g, "").trim();
  if (host && clean(host)) return `${clean(host)}.conf`;
  return `config-${index + 1}.conf`;
}

/** Filesystem-safe output name derived from the proxy. */
export function outputFileName(proxy, index) {
  const base = proxy.name || proxy.originalName || `config_${index + 1}`;
  const cleaned = base.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").trim();
  return `${cleaned && cleaned !== ".conf" ? cleaned : `config_${index + 1}`}.conf`;
}

/**
 * Format registry — the only place that maps a format id to its
 * content builders. Add new formats here (safe extension point).
 */
export const FORMAT_REGISTRY = {
  clash: {
    single: (proxy) => clashProxyBlock(proxy),
    combined: (proxies) => clashCombined(proxies),
    fileName: (proxy, i) => outputFileName(proxy, i).replace(".conf", ".yaml"),
    zipName: "wg-configs-clash.zip",
    showQR: false,
  },
  awg: {
    single: (proxy) => singleAWGConfig(proxy),
    combined: (proxies) => proxies.map(singleAWGConfig).join("\n\n"),
    fileName: (proxy, i) => outputFileName(proxy, i),
    zipName: "wg-configs-awg.zip",
    showQR: true,
  },
  wiresocket: {
    single: (proxy) => singleWiresockConfig(proxy),
    combined: (proxies) => proxies.map(singleWiresockConfig).join("\n\n"),
    fileName: (proxy, i) => outputFileName(proxy, i).replace(".conf", "-wiresock.conf"),
    zipName: "wg-configs-wiresocket.zip",
    showQR: false,
  },
};
