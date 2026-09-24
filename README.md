<p align="center">
  <img src="assets/logo.svg" alt="WireGuard Converter logo" width="112" height="112" />
</p>

<h1 align="center">WireGuard Converter</h1>

<p align="center">
  <strong>WireGuard configs → AmneziaWG, Clash, or Wiresock — ready for restricted networks.</strong>
</p>

<p align="center">
  Turn ordinary <code>.conf</code> files into formats with the junk-packet knobs that help traffic survive deep packet inspection.<br/>
  Static site. No build step. Your keys stay in the browser.
</p>

---

## Why it exists

Plain WireGuard is easy to fingerprint: fixed packet shapes and sizes give filters a clean signature. AmneziaWG and Wiresock add controlled noise (`jc`, `jmin`, `jmax`, and friends) so the stream looks less like a textbook tunnel. Moving between those formats by hand is tedious, especially if you keep several profiles. This tool does the rewrite for you.

## Features

- **Four-step wizard** — Input → Format → Settings → Result, with live validation as you paste or drop files
- **Three output families** — AmneziaWG / WG Tunnel, Clash YAML, Wiresock (with masking IDs)
- **Junk packet presets** — Light, Heavy, or fully custom values; Amnezia 1.5 (I1–I5) when you need it
- **Advanced timing** — rekey, keepalive, handshake limits, content padding (off by default)
- **DNS and MTU overrides** — known resolvers or your own list; MTU default 1420
- **Auto Generate** — optional one-click fresh WARP account (developer must enable a relay; see below)
- **Country flags** — proxy names that contain a country code get a matching flag in Clash output
- **Copy, QR, ZIP** — per-config clipboard, QR for mobile clients, or download everything as a zip
- **Five languages** — English, Türkçe, فارسی, Русский, 中文 — plus dark and light themes

## Run it locally

Any static file server works. From the project root:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

You can also open `index.html` directly in a browser, though a local server matches production more closely (module scripts, relative asset paths).

## How to use

1. **Input** — drop one or more `.conf` files, or paste config text. The tool detects each block and shows a count.
2. **Format** — pick Clash, AmneziaWG / WG Tunnel, or Wiresock.
3. **Settings** — choose a junk preset (or custom values), and optionally DNS, MTU, and advanced options.
4. **Result** — copy a config, show its QR code, edit it in place, or download the zip.

Validation runs before you leave step 1. Missing private keys, broken endpoints, and malformed fields show up with short explanations instead of a silent bad export.

## Auto Generate (optional)

**Auto Generate** registers a brand-new Cloudflare WARP account in the browser and pastes a ready `.conf` into the input box. The private key is created locally (X25519) and never leaves the device; only the public key is sent.

Cloudflare’s API does not send CORS headers, so the browser cannot call it directly. Auto Generate walks a fixed three-relay chain — **there is no proxy field in the UI**:

1. **Self-hosted Worker** (primary) — ~100k req/day, no key in the URL, allowlisted to the WARP API.
2. **[corsproxy.dev](https://corsproxy.dev)** (fallback) — 100 req/day, origin-locked key; a `429` means the daily quota is spent and the chain moves on.
3. **[Corsfix](https://corsfix.com) SDK** (last resort) — loaded from `unpkg.com/corsfix`.

First success wins; visitors either get a working button or a clear failure message. The chain is defined in `js/warp-direct.js` (`WORKER_PREFIX` / `CORSPROXY_PREFIX`).

Self-hosted / Origin-hardened relay details: [`proxy/README.md`](proxy/README.md).

## Project layout

```
index.html      wizard shell (four steps + dialogs)
js/             ES modules — parsing, conversion, i18n, UI, WARP helpers
styles/         design tokens and component CSS (no framework)
lang/           en, fa, tr, ru, zh string tables
assets/         logo, icons sprite, format thumbnails
proxy/          optional self-hosted CORS relay (Worker or Node)
tools/          node:test suite for WARP + conversion regression
```

Adding an output format means one generator function plus an entry in `FORMAT_REGISTRY` in `js/converters.js`.

## Tests

```bash
node --test tools/warp-direct.test.mjs
```

Covers profile building, registration error codes, X25519 RFC vectors, and converter regressions. No network and no browser required.

## Credits

- Original concept and early codebase: [proton-converter/proton-converter.github.io](https://github.com/proton-converter/proton-converter.github.io)
- This rewrite and current repository: [ParsaAzari/wirepro](https://github.com/ParsaAzari/wirepro) (`Parsa Azari`)
- UI libraries: [JSZip](https://stuk.github.io/jszip/), [QRCode.js](https://github.com/davidshimjs/qrcodejs)
- Fonts: [Vazirmatn](https://github.com/rastikerdar/vazirmatn), Inter, Noto Sans TC

## License / attribution

See [LICENSE](LICENSE). All rights reserved by **Parsa Azari**.

You may read, run, and study this code for personal use. Redistribution, sublicensing, or commercial reuse requires written permission. If you reference this project in an article, fork, or derivative write-up, credit the source: **ParsaAzari / wirepro** with a link to the repository.

Do not strip attribution or present this work as your own.
