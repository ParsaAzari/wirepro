/**
 * Shared constants — the single source of truth for lookup tables, keys
 * and storage names. No logic lives here; see converters.js (parsing),
 * store.js (persistence) and i18n.js (languages) for consumers.
 */

// --- Country detection data (flag emoji, TLDs and name keywords) --- //
/** ISO-2 → display flag chip used in YAML proxy names. */
export const COUNTRY_FLAGS = {
  "AD": "🇦🇩 AD", "AE": "🇦🇪 AE", "AF": "🇦🇫 AF", "AG": "🇦🇬 AG", "AI": "🇦🇮 AI", "AL": "🇦🇱 AL",
  "AM": "🇦🇲 AM", "AO": "🇦🇴 AO", "AQ": "🇦🇶 AQ", "AR": "🇦🇷 AR", "AS": "🇦🇸 AS", "AT": "🇦🇹 AT",
  "AU": "🇦🇺 AU", "AW": "🇦🇼 AW", "AX": "🇦🇽 AX", "AZ": "🇦🇿 AZ", "BA": "🇧🇦 BA", "BB": "🇧🇧 BB",
  "BD": "🇧🇩 BD", "BE": "🇧🇪 BE", "BF": "🇧🇫 BF", "BG": "🇧🇬 BG", "BH": "🇧🇭 BH", "BI": "🇧🇮 BI",
  "BJ": "🇧🇯 BJ", "BL": "🇧🇱 BL", "BM": "🇧🇲 BM", "BN": "🇧🇳 BN", "BO": "🇧🇴 BO", "BQ": "🇧🇶 BQ",
  "BR": "🇧🇷 BR", "BS": "🇧🇸 BS", "BT": "🇧🇹 BT", "BV": "🇧🇻 BV", "BW": "🇧🇼 BW", "BY": "🇧🇾 BY",
  "BZ": "🇧🇿 BZ", "CA": "🇨🇦 CA", "CC": "🇨🇨 CC", "CD": "🇨🇩 CD", "CF": "🇨🇫 CF", "CG": "🇨🇬 CG",
  "CH": "🇨🇭 CH", "CI": "🇨🇮 CI", "CK": "🇨🇰 CK", "CL": "🇨🇱 CL", "CM": "🇨🇲 CM", "CN": "🇨🇳 CN",
  "CO": "🇨🇴 CO", "CR": "🇨🇷 CR", "CU": "🇨🇺 CU", "CV": "🇨🇻 CV", "CW": "🇨🇼 CW", "CX": "🇨🇽 CX",
  "CY": "🇨🇾 CY", "CZ": "🇨🇿 CZ", "DE": "🇩🇪 DE", "DJ": "🇩🇯 DJ", "DK": "🇩🇰 DK", "DM": "🇩🇲 DM",
  "DO": "🇩🇴 DO", "DZ": "🇩🇿 DZ", "EC": "🇪🇨 EC", "EE": "🇪🇪 EE", "EG": "🇪🇬 EG", "EH": "🇪🇭 EH",
  "ER": "🇪🇷 ER", "ES": "🇪🇸 ES", "ET": "🇪🇹 ET", "FI": "🇫🇮 FI", "FJ": "🇫🇯 FJ", "FK": "🇫🇰 FK",
  "FM": "🇫🇲 FM", "FO": "🇫🇴 FO", "FR": "🇫🇷 FR", "GA": "🇬🇦 GA", "GB": "🇬🇧 GB", "GD": "🇬🇩 GD",
  "GE": "🇬🇪 GE", "GF": "🇬🇫 GF", "GG": "🇬🇬 GG", "GH": "🇬🇭 GH", "GI": "🇬🇮 GI", "GL": "🇬🇱 GL",
  "GM": "🇬🇲 GM", "GN": "🇬🇳 GN", "GP": "🇬🇵 GP", "GQ": "🇬🇶 GQ", "GR": "🇬🇷 GR", "GS": "🇬🇸 GS",
  "GT": "🇬🇹 GT", "GU": "🇬🇺 GU", "GW": "🇬🇼 GW", "GY": "🇬🇾 GY", "HK": "🇭🇰 HK", "HM": "🇭🇲 HM",
  "HN": "🇭🇳 HN", "HR": "🇭🇷 HR", "HT": "🇭🇹 HT", "HU": "🇭🇺 HU", "ID": "🇮🇩 ID", "IE": "🇮🇪 IE",
  "IL": "🇮🇱 IL", "IM": "🇮🇲 IM", "IN": "🇮🇳 IN", "IO": "🇮🇴 IO", "IQ": "🇮🇶 IQ", "IR": "🇮🇷 IR",
  "IS": "🇮🇸 IS", "IT": "🇮🇹 IT", "JE": "🇯🇪 JE", "JM": "🇯🇲 JM", "JO": "🇯🇴 JO", "JP": "🇯🇵 JP",
  "KE": "🇰🇪 KE", "KG": "🇰🇬 KG", "KH": "🇰🇭 KH", "KI": "🇰🇮 KI", "KM": "🇰🇲 KM", "KN": "🇰🇳 KN",
  "KP": "🇰🇵 KP", "KR": "🇰🇷 KR", "KW": "🇰🇼 KW", "KY": "🇰🇾 KY", "KZ": "🇰🇿 KZ", "LA": "🇱🇦 LA",
  "LB": "🇱🇧 LB", "LC": "🇱🇨 LC", "LI": "🇱🇮 LI", "LK": "🇱🇰 LK", "LR": "🇱🇷 LR", "LS": "🇱🇸 LS",
  "LT": "🇱🇹 LT", "LU": "🇱🇺 LU", "LV": "🇱🇻 LV", "LY": "🇱🇾 LY", "MA": "🇲🇦 MA", "MC": "🇲🇨 MC",
  "MD": "🇲🇩 MD", "ME": "🇲🇪 ME", "MF": "🇲🇫 MF", "MG": "🇲🇬 MG", "MH": "🇲🇭 MH", "MK": "🇲🇰 MK",
  "ML": "🇲🇱 ML", "MM": "🇲🇲 MM", "MN": "🇲🇳 MN", "MO": "🇲🇴 MO", "MP": "🇲🇵 MP", "MQ": "🇲🇶 MQ",
  "MR": "🇲🇷 MR", "MS": "🇲🇸 MS", "MT": "🇲🇹 MT", "MU": "🇲🇺 MU", "MV": "🇲🇻 MV", "MW": "🇲🇼 MW",
  "MX": "🇲🇽 MX", "MY": "🇲🇾 MY", "MZ": "🇲🇿 MZ", "NA": "🇳🇦 NA", "NC": "🇳🇨 NC", "NE": "🇳🇪 NE",
  "NF": "🇳🇫 NF", "NG": "🇳🇬 NG", "NI": "🇳🇮 NI", "NL": "🇳🇱 NL", "NO": "🇳🇴 NO", "NP": "🇳🇵 NP",
  "NR": "🇳🇷 NR", "NU": "🇳🇺 NU", "NZ": "🇳🇿 NZ", "OM": "🇴🇲 OM", "PA": "🇵🇦 PA", "PE": "🇵🇪 PE",
  "PF": "🇵🇫 PF", "PG": "🇵🇬 PG", "PH": "🇵🇭 PH", "PK": "🇵🇰 PK", "PL": "🇵🇱 PL", "PM": "🇵🇲 PM",
  "PN": "🇵🇳 PN", "PR": "🇵🇷 PR", "PS": "🇵🇸 PS", "PT": "🇵🇹 PT", "PW": "🇵🇼 PW", "PY": "🇵🇾 PY",
  "QA": "🇶🇦 QA", "RE": "🇷🇪 RE", "RO": "🇷🇴 RO", "RS": "🇷🇸 RS", "RU": "🇷🇺 RU", "RW": "🇷🇼 RW",
  "SA": "🇸🇦 SA", "SB": "🇸🇧 SB", "SC": "🇸🇨 SC", "SD": "🇸🇩 SD", "SE": "🇸🇪 SE", "SG": "🇸🇬 SG",
  "SH": "🇸🇭 SH", "SI": "🇸🇮 SI", "SJ": "🇸🇯 SJ", "SK": "🇸🇰 SK", "SL": "🇸🇱 SL", "SM": "🇸🇲 SM",
  "SN": "🇸🇳 SN", "SO": "🇸🇴 SO", "SR": "🇸🇷 SR", "SS": "🇸🇸 SS", "ST": "🇸🇹 ST", "SV": "🇸🇻 SV",
  "SX": "🇸🇽 SX", "SY": "🇸🇾 SY", "SZ": "🇸🇿 SZ", "TC": "🇹🇨 TC", "TD": "🇹🇩 TD", "TF": "🇹🇫 TF",
  "TG": "🇹🇬 TG", "TH": "🇹🇭 TH", "TJ": "🇹🇯 TJ", "TK": "🇹🇰 TK", "TL": "🇹🇱 TL", "TM": "🇹🇲 TM",
  "TN": "🇹🇳 TN", "TO": "🇹🇴 TO", "TR": "🇹🇷 TR", "TT": "🇹🇹 TT", "TV": "🇹🇻 TV", "TW": "🇹🇼 TW",
  "TZ": "🇹🇿 TZ", "UA": "🇺🇦 UA", "UK": "🇬🇧 GB", "UG": "🇺🇬 UG", "UM": "🇺🇲 UM", "US": "🇺🇸 US", "UY": "🇺🇾 UY",
  "UZ": "🇺🇿 UZ", "VA": "🇻🇦 VA", "VC": "🇻🇨 VC", "VE": "🇻🇪 VE", "VG": "🇻🇬 VG", "VI": "🇻🇮 VI",
  "VN": "🇻🇳 VN", "VU": "🇻🇺 VU", "WF": "🇼🇫 WF", "WS": "🇼🇸 WS", "YE": "🇾🇪 YE", "YT": "🇾🇹 YT",
  "ZA": "🇿🇦 ZA", "ZM": "🇿🇲 ZM", "ZW": "🇿🇼 ZW"
};

// --- Amnezia/Wiresock parameter keys (lowercased .conf key names) --- //
/** Base Amnezia obfuscation keys. */
export const AMNEZIA_KEYS    = ['jc', 'jmin', 'jmax', 's1', 's2', 'h1', 'h2', 'h3', 'h4'];
/** Amnezia 1.5 i1–i5 keys (I1 default comes from AMNEZIA_I1_DEFAULT). */
export const AMNEZIA15_KEYS  = ['i1', 'i2', 'i3', 'i4', 'i5'];
/** Advanced .conf keys shared by Amnezia profiles. */
export const AMNEZIA_ADV_KEYS  = ['contentpaddingaddition', 'rekeyaftertime', 'rekeytimeout', 'rejectaftertime', 'keepalivetimeout', 'maxhandshakeattempts', 'disablecookies'];
/** Advanced input ids in step 3 (snake form; see store.js ADV_FIELD_IDS for localStorage ids). */
export const ADV_FIELD_IDS     = ['advContentPadding', 'advRekeyAfterTime', 'advRekeyTimeout', 'advRejectAfterTime', 'advKeepaliveTimeout', 'advMaxHandshakeAttempts'];
/** Map advanced snake keys → Clash YAML key names. */
export const CLASH_ADV_KEY_MAP = {
  contentpaddingaddition: 'content-padding-addition',
  rekeyaftertime:         'rekey-after-time',
  rekeytimeout:           'rekey-timeout',
  rejectaftertime:        'reject-after-time',
  keepalivetimeout:       'keepalive-timeout',
  maxhandshakeattempts:   'max-handshake-attempts',
  disablecookies:         'disable-cookies'
};
// --- Supported UI languages (must match lang/*.json files) --- //
/** Two-letter language codes shipped with the app. */
export const SUPPORTED_LANGS = ["en", "tr", "fa", "ru", "zh"];

/** Hostname TLD → country code (used by detectCountry on Endpoint= lines). */
export const COUNTRY_TLDS = {
    '.de': 'DE', '.fr': 'FR', '.ru': 'RU', '.nl': 'NL',
    '.uk': 'GB', '.it': 'IT', '.es': 'ES', '.pl': 'PL',
    '.se': 'SE', '.no': 'NO', '.fi': 'FI', '.dk': 'DK',
    '.at': 'AT', '.ch': 'CH', '.be': 'BE', '.ie': 'IE',
    '.pt': 'PT', '.gr': 'GR', '.cz': 'CZ', '.ro': 'RO',
    '.hu': 'HU', '.bg': 'BG', '.hr': 'HR', '.sk': 'SK',
    '.si': 'SI', '.ee': 'EE', '.lv': 'LV', '.lt': 'LT',
    '.jp': 'JP', '.kr': 'KR', '.cn': 'CN', '.tw': 'TW',
    '.in': 'IN', '.au': 'AU', '.nz': 'NZ', '.ca': 'CA',
    '.br': 'BR', '.mx': 'MX', '.ar': 'AR', '.cl': 'CL',
    '.za': 'ZA', '.tr': 'TR', '.ua': 'UA', '.il': 'IL',
    '.ae': 'AE', '.sa': 'SA', '.th': 'TH', '.vn': 'VN',
    '.id': 'ID', '.my': 'MY', '.sg': 'SG', '.ph': 'PH',
    '.us': 'US', '.by': 'BY', '.kz': 'KZ'
};
/** Country name keywords (lowercased) → ISO-2 for Endpoint/Server heuristics. */
export const COUNTRY_NAMES = {
    'germany': 'DE', 'deutschland': 'DE', 'deutsch': 'DE', 'frankfurt': 'DE', 'berlin': 'DE',
    'france': 'FR', 'french': 'FR', 'paris': 'FR',
    'netherlands': 'NL', 'dutch': 'NL', 'amsterdam': 'NL', 'holland': 'NL',
    'usa': 'US', 'unitedstates': 'US', 'us-': 'US', '-us': 'US',
    'unitedkingdom': 'GB', 'uk-': 'GB', '-uk': 'GB', 'britain': 'GB', 'london': 'GB',
    'russia': 'RU', 'russian': 'RU', 'moscow': 'RU',
    'japan': 'JP', 'japanese': 'JP', 'tokyo': 'JP', 'osaka': 'JP',
    'singapore': 'SG', 'singaporean': 'SG',
    'canada': 'CA', 'canadian': 'CA', 'toronto': 'CA', 'montreal': 'CA',
    'australia': 'AU', 'australian': 'AU', 'sydney': 'AU', 'melbourne': 'AU',
    'sweden': 'SE', 'swedish': 'SE', 'stockholm': 'SE',
    'switzerland': 'CH', 'swiss': 'CH', 'zurich': 'CH', 'geneva': 'CH',
    'italy': 'IT', 'italian': 'IT', 'rome': 'IT', 'milan': 'IT',
    'spain': 'ES', 'spanish': 'ES', 'madrid': 'ES', 'barcelona': 'ES',
    'poland': 'PL', 'polish': 'PL', 'warsaw': 'PL',
    'turkey': 'TR', 'turkish': 'TR', 'istanbul': 'TR', 'ankara': 'TR',
    'india': 'IN', 'mumbai': 'IN', 'delhi': 'IN', 'bangalore': 'IN',
    'brazil': 'BR', 'brazilian': 'BR', 'saopaulo': 'BR',
    'korea': 'KR', 'korean': 'KR', 'seoul': 'KR',
    'hongkong': 'HK', 'hong': 'HK',
    'greece': 'GR', 'greek': 'GR', 'athens': 'GR',
    'norway': 'NO', 'norwegian': 'NO', 'oslo': 'NO',
    'finland': 'FI', 'finnish': 'FI', 'helsinki': 'FI',
    'denmark': 'DK', 'danish': 'DK', 'copenhagen': 'DK',
    'austria': 'AT', 'austrian': 'AT', 'vienna': 'AT',
    'belgium': 'BE', 'belgian': 'BE', 'brussels': 'BE',
    'ireland': 'IE', 'irish': 'IE', 'dublin': 'IE',
    'portugal': 'PT', 'portuguese': 'PT', 'lisbon': 'PT',
    'czech': 'CZ', 'czechia': 'CZ', 'prague': 'CZ',
    'romania': 'RO', 'romanian': 'RO', 'bucharest': 'RO',
    'hungary': 'HU', 'hungarian': 'HU', 'budapest': 'HU',
    'croatia': 'HR', 'croatian': 'HR', 'zagreb': 'HR',
    'bulgaria': 'BG', 'bulgarian': 'BG', 'sofia': 'BG',
    'ukraine': 'UA', 'ukrainian': 'UA', 'kyiv': 'UA',
    'israel': 'IL', 'israeli': 'IL', 'telaviv': 'IL',
    'uae': 'AE', 'emirates': 'AE', 'dubai': 'AE',
    'saudi': 'SA', 'arabia': 'SA', 'riyadh': 'SA',
    'thailand': 'TH', 'thai': 'TH', 'bangkok': 'TH',
    'vietnam': 'VN', 'vietnamese': 'VN', 'hanoi': 'VN',
    'indonesia': 'ID', 'indonesian': 'ID', 'jakarta': 'ID',
    'malaysia': 'MY', 'malaysian': 'MY', 'kualalumpur': 'MY',
    'philippines': 'PH', 'filipino': 'PH', 'manila': 'PH',
    'mexico': 'MX', 'mexican': 'MX', 'mexicocity': 'MX',
    'argentina': 'AR', 'argentinian': 'AR', 'buenosaires': 'AR',
    'chile': 'CL', 'chilean': 'CL', 'santiago': 'CL',
    'southafrica': 'ZA', 'african': 'ZA', 'johannesburg': 'ZA',
    'taiwan': 'TW', 'taiwanese': 'TW', 'taipei': 'TW',
    'newzealand': 'NZ', 'zealand': 'NZ', 'auckland': 'NZ'
};

// --- Built-in DNS presets ("display value, ..." lists) --- //
/** Well-known resolvers plus a blank "custom" slot (value filled by the form). */
export const DNS_PROVIDERS = {
  google:    '8.8.8.8, 8.8.4.4',
  cloudflare: '1.1.1.1, 1.0.0.1',
  quad9:     '9.9.9.9, 149.112.112.112',
  opendns:   '208.67.222.222, 208.67.220.220',
  adguard:   '94.140.14.14, 94.140.15.15',
  nextdns:   '45.90.28.0, 45.90.30.0',
  custom:    ''
};

// --- localStorage keys (wg_ prefix avoids collisions) --- //
/** Theme preference ("dark" | "light"). */
export const LS_THEME         = 'wg_theme';
/** Jitter junk mode toggle. */
export const LS_JUNK_MODE     = 'wg_junk_mode';
/** Amnezia 1.5 panel toggle. */
export const LS_AMNEZIA15     = 'wg_amnezia15';
/** Per-config randomization toggle. */
export const LS_RANDOMIZE_PC  = 'wg_randomize_per_config';
/** Wiresock masking Id. */
export const LS_WS_ID         = 'wg_ws_id';
/** Wiresock masking IP. */
export const LS_WS_IP         = 'wg_ws_ip';
/** Wiresock masking IB. */
export const LS_WS_IB         = 'wg_ws_ib';
/** Custom DNS toggle. */
export const LS_CUSTOM_DNS    = 'wg_custom_dns';
/** DNS provider preset id. */
export const LS_DNS_PROVIDER  = 'wg_dns_provider';
/** Free-form DNS list. */
export const LS_CUSTOM_DNS_VAL = 'wg_custom_dns_val';
/** Custom MTU toggle. */
export const LS_CUSTOM_MTU    = 'wg_custom_mtu';
/** MTU numeric value. */
export const LS_MTU_VALUE     = 'wg_mtu_value';
/** Advanced panel master toggle. */
export const LS_ADV_SETTINGS  = 'wg_adv_settings';
/** JSON blob of advanced input values (see store.js ADV_FIELD_IDS). */
export const LS_ADV_VALUES    = 'wg_adv_values';
/** Legacy cookie-related advanced flag (kept for migration). */
export const LS_ADV_COOKIES   = 'wg_adv_cookies';

/** Default I1 value used when Amnezia 1.5 is enabled without user input. */
export const AMNEZIA_I1_DEFAULT = '<b 0xc70000000108ce1bf31eec7d93360000449e227e4596ed7f75c4d35ce31880b4133107c822c6355b51f0d7c1bba96d5c210a48aca01885fed0871cfc37d59137d73b506dc013bb4a13c060ca5b04b7ae215af71e37d6e8ff1db235f9fe0c25cb8b492471054a7c8d0d6077d430d07f6e87a8699287f6e69f54263c7334a8e144a29851429bf2e350e519445172d36953e96085110ce1fb641e5efad42c0feb4711ece959b72cc4d6f3c1e83251adb572b921534f6ac4b10927167f41fe50040a75acef62f45bded67c0b45b9d655ce374589cad6f568b8475b2e8921ff98628f86ff2eb5bcce6f3ddb7dc89e37c5b5e78ddc8d93a58896e530b5f9f1448ab3b7a1d1f24a63bf981634f6183a21af310ffa52e9ddf5521561760288669de01a5f2f1a4f922e68d0592026bbe4329b654d4f5d6ace4f6a23b8560b720a5350691c0037b10acfac9726add44e7d3e880ee6f3b0d6429ff33655c297fee786bb5ac032e48d2062cd45e305e6d8d8b82bfbf0fdbc5ec09943d1ad02b0b5868ac4b24bb10255196be883562c35a713002014016b8cc5224768b3d330016cf8ed9300fe6bf39b4b19b3667cddc6e7c7ebe4437a58862606a2a66bd4184b09ab9d2cd3d3faed4d2ab71dd821422a9540c4c5fa2a9b2e6693d411a22854a8e541ed930796521f03a54254074bc4c5bca152a1723260e7d70a24d49720acc544b41359cfc252385bda7de7d05878ac0ea0343c77715e145160e6562161dfe2024846dfda3ce99068817a2418e66e4f37dea40a21251c8a034f83145071d93baadf050ca0f95dc9ce2338fb082d64fbc8faba905cec66e65c0e1f9b003c32c943381282d4ab09bef9b6813ff3ff5118623d2617867e25f0601df583c3ac51bc6303f79e68d8f8de4b8363ec9c7728b3ec5fcd5274edfca2a42f2727aa223c557afb33f5bea4f64aeb252c0150ed734d4d8eccb257824e8e090f65029a3a042a51e5cc8767408ae07d55da8507e4d009ae72c47ddb138df3cab6cc023df2532f88fb5a4c4bd917fafde0f3134be09231c389c70bc55cb95a779615e8e0a76a2b4d943aabfde0e394c985c0cb0376930f92c5b6998ef49ff4a13652b787503f55c4e3d8eebd6e1bc6db3a6d405d8405bd7a8db7cefc64d16e0d105a468f3d33d29e5744a24c4ac43ce0eb1bf6b559aed520b91108cda2de6e2c4f14bc4f4dc58712580e07d217c8cca1aaf7ac04bab3e7b1008b966f1ed4fba3fd93a0a9d3a27127e7aa587fbcc60d548300146bdc126982a58ff5342fc41a43f83a3d2722a26645bc961894e339b953e78ab395ff2fb854247ad06d446cc2944a1aefb90573115dc198f5c1efbc22bc6d7a74e41e666a643d5f85f57fde81b87ceff95353d22ae8bab11684180dd142642894d8dc34e402f802c2fd4a73508ca99124e428d67437c871dd96e506ffc39c0fc401f666b437adca41fd563cbcfd0fa22fbbf8112979c4e677fb533d981745cceed0fe96da6cc0593c430bbb71bcbf924f70b4547b0bb4d41c94a09a9ef1147935a5c75bb2f721fbd24ea6a9f5c9331187490ffa6d4e34e6bb30c2c54a0344724f01088fb2751a486f425362741664efb287bce66c4a544c96fa8b124d3c6b9eaca170c0b530799a6e878a57f402eb0016cf2689d55c76b2a91285e2273763f3afc5bc9398273f5338a06d>';
