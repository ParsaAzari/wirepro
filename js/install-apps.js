/**
 * Official client download catalog for the install-guide modal.
 * Links must be official only: vendor sites, Google Play, App Store,
 * or the project's own GitHub releases — never third-party mirrors.
 */

/** OS picker order (matches INSTALL_APPS keys). */
export const OS_ORDER = ["windows", "macos", "android", "ios", "linux"];

/**
 * Curated official clients per OS.
 * @type {Record<string, Array<{name: string, url: string, formats: string[], hintKey: string}>>}
 * formats: which output format ids this client is meant to import
 * ("awg" | "clash" | "wiresocket"); empty = general / standard .conf only.
 */
export const INSTALL_APPS = {
  windows: [
    {
      name: "AmneziaWG",
      url: "https://github.com/amnezia-vpn/amneziawg-windows-client/releases/latest",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
    {
      name: "AmneziaVPN",
      url: "https://amnezia.org/downloads",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
    {
      name: "WireGuard",
      url: "https://www.wireguard.com/install/",
      formats: [],
      hintKey: "install_hint_conf",
    },
    {
      name: "WireSock",
      url: "https://wiresock.net/wiresock-secure-connect/download-wiresock-vpn-client",
      formats: ["wiresocket"],
      hintKey: "install_hint_wiresock",
    },
    {
      name: "Clash Verge Rev",
      url: "https://github.com/clash-verge-rev/clash-verge-rev/releases",
      formats: ["clash"],
      hintKey: "install_hint_clash",
    },
    {
      name: "WG Tunnel",
      url: "https://wgtunnel.com/download",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
  ],
  macos: [
    {
      name: "AmneziaVPN",
      url: "https://amnezia.org/downloads",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
    {
      name: "WireGuard",
      url: "https://apps.apple.com/app/wireguard/id1441195209",
      formats: [],
      hintKey: "install_hint_conf",
    },
    {
      name: "Clash Verge Rev",
      url: "https://github.com/clash-verge-rev/clash-verge-rev/releases",
      formats: ["clash"],
      hintKey: "install_hint_clash",
    },
    {
      name: "WG Tunnel",
      url: "https://wgtunnel.com/download",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
  ],
  android: [
    {
      name: "AmneziaWG",
      url: "https://play.google.com/store/apps/details?id=org.amnezia.awg",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
    {
      name: "AmneziaVPN",
      url: "https://play.google.com/store/apps/details?id=org.amnezia.vpn",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
    {
      name: "WG Tunnel",
      url: "https://play.google.com/store/apps/details?id=com.zaneschepke.wireguardautotunnel",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
    {
      name: "WireGuard",
      url: "https://play.google.com/store/apps/details?id=com.wireguard.android",
      formats: [],
      hintKey: "install_hint_conf",
    },
    {
      name: "Clash Meta for Android",
      url: "https://github.com/MetaCubeX/ClashMetaForAndroid/releases",
      formats: ["clash"],
      hintKey: "install_hint_clash",
    },
  ],
  ios: [
    {
      name: "AmneziaWG",
      url: "https://apps.apple.com/app/amneziawg/id6478942365",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
    {
      name: "AmneziaVPN",
      url: "https://apps.apple.com/app/amneziavpn/id1600529900",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
    {
      name: "WireGuard",
      url: "https://apps.apple.com/app/wireguard/id1441195209",
      formats: [],
      hintKey: "install_hint_conf",
    },
  ],
  linux: [
    {
      name: "AmneziaVPN",
      url: "https://amnezia.org/downloads",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
    {
      name: "WireGuard",
      url: "https://www.wireguard.com/install/",
      formats: [],
      hintKey: "install_hint_conf",
    },
    {
      name: "Clash Verge Rev",
      url: "https://github.com/clash-verge-rev/clash-verge-rev/releases",
      formats: ["clash"],
      hintKey: "install_hint_clash",
    },
    {
      name: "WG Tunnel",
      url: "https://wgtunnel.com/download",
      formats: ["awg"],
      hintKey: "install_hint_awg",
    },
  ],
};
