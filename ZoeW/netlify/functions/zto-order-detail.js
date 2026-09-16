'use strict';

const crypto = require('crypto');

const DEFAULT_API_URL = 'https://aargus-api.ztoglobal.com/scan/get/order/detail';
const DEFAULT_BROWSER_ORIGIN = 'https://argus.ztoglobal.com';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const DEFAULT_BODY_TEMPLATE = '{"billCode":"{barcode}","countryCode":"KH"}';
const DEFAULT_QUERY_PARAM = 'billCode';
const DEFAULT_ACCEPT_LANGUAGE = 'km';

const BARCODE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const HEADER_NAME_RE = /^[A-Za-z0-9-]{1,80}$/;
const FORBIDDEN_FORWARD_HEADER_RE = /^(?:authorization|connection|content-length|cookie|host|transfer-encoding)$/i;
const FIELD_PATH_RE = /^[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*$/;
const QUERY_PARAM_RE = /^[A-Za-z0-9_.-]{1,40}$/;
const SAFE_REASON_RE = /^[A-Za-z0-9_.:@-]{1,80}$/;
const SIGNED_VALUE_RE = /^[A-Za-z0-9_.:@-]{1,40}$/;
const SIGNED_PATH_MAX = 8;
const SIGNED_VALUE_MAX = 16;
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]+/g;
const SUCCESS_CODE_RE = /^(?:0+|200|success|succeed|ok|true)$/;
const LOGIN_REDIRECT_RE = /https?:\/\/[^\s"']*(?:oauth|\/login\b|\/signin\b|sso[.\/]|iam[-.])/i;

const PHONE_PATHS = ['consigneePhone', 'consigneeMobile', 'consigneeTel', 'receiverPhone', 'receiverMobile', 'recipientPhone', 'recipientMobile', 'phone', 'mobile'];
const COD_PATHS = ['agentAmount', 'codAmount', 'collectionAmount', 'codFee', 'cod'];
// ⛔ **`fcAmount` ជា DOD — លើ *ផ្លូវទាំង ២*** (ការវាស់របស់ម្ចាស់គម្រោង
// 2026-09-11 លើបញ្ជី · 2026-09-15 លើ `/detail`) ៖ កញ្ចប់ `ztda` ដែល
// អតិថិជនទទួល មាន `agentAmount: 0` (គ្មានប្រាក់ប្រមូលជំនួស) ប៉ុន្តែ
// `fcAmount: 2.5` គឺជា **ថ្លៃដឹកដែលអតិថិជនបង់ពេលទទួល** = DOD ក្នុង
// វាក្យស័ព្ទ ZoeW។ កញ្ចប់ Shopee មាន `fcAmount: 0.0` ➜ DOD 0 ដដែល។
//
// ⛔ **វាត្រូវឈរមុន `arrivalServiceCharge`** ៖ ZTO ផ្ញើវាលនោះ **ជានិច្ច
// ដោយតម្លៃ `0.00`** ហើយ `pickNumber()` ត្រឡប់លេខដំបូងដែលរកឃើញ **រួមទាំង
// `0`** ➜ បើវាឈរមុន ការស្វែងរកឈប់ត្រឹមនោះ ➜ **DOD 0 រាល់កញ្ចប់** ហើយ
// វាល ៤ ខាងក្រោមក្លាយជា **កូដងាប់** (វាស់បាន 2.35.1 ៖ ការស្កេនឆ្លើយ
// DOD 0 ខណៈការទាញបញ្ជីឆ្លើយ 2.5 លើ barcode តែមួយ)។
//
// ⛔ **`freightFee` មិនមែន DOD** ទោះវាស្មើ `fcAmount` លើកញ្ចប់ `payType: "CC"`
// ក៏ដោយ ៖ លើកញ្ចប់បង់មុន វានៅមិនមែន 0 (ថ្លៃដឹកពិតជាមាន) ខណៈ `fcAmount`
// ជា 0 ➜ ការយកវា = គិតលុយអតិថិជនលើថ្លៃដឹកដែលអ្នកផ្ញើបង់រួច។
const DOD_PATHS = ['fcAmount', 'arrivalServiceCharge', 'dodAmount', 'arrivalCharge', 'serviceCharge', 'dod'];
const BARCODE_PATHS = ['billCode', 'waybillNo', 'waybillCode', 'mailNo', 'barcode'];

// ⛔ ផ្លូវ **បញ្ជី** (`/scan/page/scan`) ជាផ្លូវទី ២ ឆ្ពោះទៅ ZTO ៖ វាទាញ
// កញ្ចប់តាម **ជួរកាលបរិច្ឆេទ** ជំនួសការសួរ barcode ម្តងមួយ។ សំបករបស់វា
// ផ្ទុក **array** (`data.result[]`) ➜ `orderCandidates()` ដែលរកវត្ថុ
// **តែមួយ** មិនស្រង់វាចេញបានទេ។ វាល barcode ក៏ផ្សេងដែរ ៖ `scanBillCode`។
//
// ⛔ **មុខងារនេះជាការស្រេចចិត្ត** — គ្មានលេខសាខាក្នុងសំណើ ➜ វាដេកលក់
// ទាំងស្រុង ហើយការកំណត់ **ខុស** បិទតែវា មិនប៉ះការស្កេន (ច្បាប់ដដែលនឹង
// `ZTO_FIELD_SIGNED` ៖ លេខទូរស័ព្ទ និងលុយសំខាន់ជាងបញ្ជី)។
//
// ⛔ **លេខសាខាមកពី *សំណើ* មិនមែនពី env ទៀតទេ** (សំណើម្ចាស់គម្រោង
// 2026-09-14) ៖ `ZTO_LIST_SITE_CODE` ក្នុង Netlify ចាក់សោ deploy ទាំងមូល
// ចូល **សាខាតែមួយ** ខណៈ ZoeW ត្រូវបម្រើសាខាច្រើន ➜ លេខសាខារស់ក្នុង
// ZoeW របស់ឧបករណ៍នីមួយៗវិញ ហើយចូលមកជា `?site=`។ ⛔ ការបញ្ចាំងពិតឈរខាង
// **ZTO** ៖ Cookie ជារបស់គណនីអាជីវកម្ម ➜ សាខាដែលគណនីនោះគ្មានសិទ្ធិ
// ត្រឡប់បញ្ជីទទេ។ ⛔ ហើយលេខសាខាត្រូវចូល **កូនសោ cache** ជាដាច់ខាត —
// បើមិនដូច្នេះ សាខា ក ទទួលបញ្ជីរបស់សាខា ខ ពី cache ➜ **COD របស់
// អតិថិជនអ្នកដទៃចូល ZoeW**។
const DEFAULT_LIST_URL = 'https://aargus-api.ztoglobal.com/scan/page/scan';
const DEFAULT_LIST_SCAN_TYPE = '03';
// ⛔ `scanTypeCode` ជាតម្រងដែល **ZTO** អនុវត្ត ➜ យើងផ្ទៀងផ្ទាត់វាមិនបាន។
// ជួរដេកដែលត្រឡប់មកផ្ទុក `scanTypeDesc` ជាអត្ថបទ ➜ នោះជាជាន់ការពារ
// **ខាងយើង** ៖ បើលេខកូដប្រែ ឬ ZTO បញ្ចូលប្រភេទស្កេនផ្សេង (ចេញដំណើរ ·
// ប្រគល់) នោះកញ្ចប់ខុសនឹងចូល ZoeW ដោយស្ងាត់។ (សំណើម្ចាស់គម្រោង 2026-09-11។)
// ⛔ ច្បាប់ «មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស» នៅដដែល ៖ ជួរដេកដែល **គ្មានវាលនេះ**
// មិនត្រូវរំលង — មានតែ «មានវាល ហើយវាខុស» ទើបសម្គាល់។
const DEFAULT_LIST_SCAN_DESC = 'អីវ៉ាន់មកដល់';
const LIST_SCAN_DESC_PATHS = ['scanTypeDesc', 'scanTypeName', 'scanDesc'];
// ⛔ **ជាន់ទី ២ ៖ កូដស្ថិរ។** `scanTypeDesc` ជាអត្ថបទដែល **បកប្រែ** ➜ វាប្រែ
// តាមភាសារបស់គណនី ➜ ការពឹងលើវាតែម្យ៉ាងធ្វើឲ្យការប្តូរភាសាក្លាយជា **បញ្ជីទទេ
// កុហក**។ `scanTypeCode` ជាកូដស្ថិរ ➜ ទាំង ២ ត្រូវពិនិត្យ **ឯករាជ្យ**
// (សំណើម្ចាស់គម្រោង 2026-09-11 ៖ «អោយ sync តែ `03` + «អីវ៉ាន់មកដល់»»)។
const LIST_SCAN_CODE_PATHS = ['scanTypeCode', 'scanType'];
const LIST_SITE_CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;
const LIST_SCAN_TYPE_RE = /^[A-Za-z0-9_-]{1,8}$/;
const LIST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIST_TIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
const LIST_RANGE_MAX_DAYS = 31;
const LIST_ROW_MAX = 200;
const LIST_CACHE_TTL_MAX_MS = 60000;
// ⛔ បញ្ជីដាក់ `scanBillCode` **មុខគេ** ព្រោះជួរដេករបស់វាអាចផ្ទុក
// `billCode` ផ្សេង (លេខមេ) ដែលមិនមែនលេខស្លាកដែលស្កេនចូល។ បញ្ជីដើម
// នៅជាប្រភពតែមួយ ➜ **ការបន្ថែម មិនមែនការចម្លង**។
const LIST_BARCODE_PATHS = ['scanBillCode'].concat(BARCODE_PATHS);
const LIST_TIME_PATHS = ['scanTime', 'scanDate', 'createTime', 'operateTime'];

const FIELD_SEPARATOR = '|';
const CACHE_MAX = 200;
// សាលក្រម «រកមិនឃើញ» មានអាយុខ្លីជាងលទ្ធផលពិតដោយចេតនា ៖ កញ្ចប់ដែល ZTO
// មិនទាន់បញ្ចូល អាចលេចឡើងក្នុងប៉ុន្មាននាទីក្រោយ Arrival Scan ➜ TTL វែង
// នឹងក្លាយជាការបដិសេធដែលកុហក។ ១៥ វិ. គ្រប់គ្រាន់ដើម្បីលេបការស្កេនម្តងទៀត
// របស់អ្នកប្រើ ដោយមិនបាំងការត្រួតពិនិត្យឡើងវិញដែលស្មោះត្រង់។
const NOT_FOUND_CACHE_TTL_DEFAULT_MS = 15000;
const resultCache = new Map();
const inFlight = new Map();

const COOKIE_NAME_RE = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]{1,128}$/;
const COOKIE_VALUE_RE = /^[\u0021-\u003a\u003c-\u007e]*$/;
const CONTROL_CHAR_TEST_RE = /[\u0000-\u001f\u007f]/;
const COOKIE_MAX_LENGTH = 8192;
const COOKIE_MAX_PAIRS = 64;
const SESSION_COOKIE_NAME = 'BOS-MAN-SESSION';
const COOKIE_STORE_NAME = 'zto-auth';
const COOKIE_STORE_KEY = 'cookie';
const COOKIE_CACHE_TTL_MS = 60000;
const COOKIE_STORE_TIMEOUT_MS = 3000;
const COOKIE_RENEW_MIN_GAP_MS = 60000;
const COOKIE_RENEW_WRITE_TIMEOUT_MS = 900;
const COOKIE_BUDGET_RESERVE_MS = 1200;
const COOKIE_READ_MIN_TIMEOUT_MS = 300;
const COOKIE_WRITE_MIN_TIMEOUT_MS = 200;
const COOKIE_REFRESH_RETRY_RESERVE_MS = 2500;
// ⛔ ពេល **សតិទទេ** ការអាន Cookie មិនមែនការងារស្រេចចិត្តទេ — វា *ជាសំណើ
// ទាំងមូល*។ ដូច្នេះការកក់ពេលឲ្យ upstream ពេញ `upstreamTimeoutMs` មុនការអាន
// គឺខុសទិស ៖ វាបង្រួមបង្អួចអានរហូតតូចជាងអ្វីដែល store ត្រូវការពិត ➜ 503
// ខណៈថវិកានៅសល់ច្រើន។ ជំនួសវិញ កក់ត្រឹម **ការហៅ upstream អប្បបរមា ១**
// (`fetchOrder()` ទាមទារ `remaining > 1200` ហើយកាត់ `remaining − 200`)។
const COOKIE_COLD_UPSTREAM_RESERVE_MS = 1500;

const upstreamCookieSignal = { seenAt: 0, setCookie: false, names: [] };
const upstreamRejectSignal = { at: 0, status: 0, code: '', count: 0 };
const cookieState = {
    value: '', source: '', at: 0, storeReason: '', renewAt: 0, renewals: 0, authRejectedAt: 0,
    authAcceptedAt: 0,
    authIdentity: '', version: 0, storeCookie: '', storeEtag: '', storeMissing: false,
    renewAttemptValue: '', renewAttemptEtag: '',
    pendingRenewal: null, obsolete: new Set(), mustRevalidate: false
};
let cookieRefreshInFlight = false;
let cookieWriteInFlight = null;
let blobsModuleForTests = null;

function setCookieLines(response) {
    const headers = response && response.headers;
    if (!headers) return [];
    if (typeof headers.getSetCookie === 'function') return headers.getSetCookie() || [];
    if (typeof headers.get === 'function') {
        const single = headers.get('set-cookie');
        if (single) return [single];
    }
    return [];
}

function parseCookieHeader(raw) {
    const text = String(raw || '').trim();
    if (!text || text.length > COOKIE_MAX_LENGTH) return null;
    if (CONTROL_CHAR_TEST_RE.test(text)) return null;
    const parts = text.split(';');
    const pairs = [];
    for (let i = 0; i < parts.length; i++) {
        const pair = parts[i].trim();
        if (!pair) continue;
        if (pairs.length >= COOKIE_MAX_PAIRS) break;
        const at = pair.indexOf('=');
        if (at < 1) continue;
        const name = pair.slice(0, at).trim();
        const value = pair.slice(at + 1);
        if (!COOKIE_NAME_RE.test(name) || !COOKIE_VALUE_RE.test(value)) continue;
        pairs.push({ name: name, value: value });
    }
    return pairs.length ? pairs : null;
}

function serializeCookiePairs(pairs) {
    return pairs.map((pair) => pair.name + '=' + pair.value).join('; ');
}

function hasSessionCookie(pairs) {
    return pairs.some((pair) => pair.name === SESSION_COOKIE_NAME && pair.value.length >= 8);
}

function sanitizeStoredCookie(raw) {
    const pairs = parseCookieHeader(raw);
    if (!pairs || !hasSessionCookie(pairs)) return '';
    return serializeCookiePairs(pairs);
}

function sanitizeEnvCookie(raw) {
    const text = String(raw || '').trim();
    if (!text || text.length > COOKIE_MAX_LENGTH) return '';
    if (CONTROL_CHAR_TEST_RE.test(text)) return '';
    return text;
}

function mergeRenewedCookie(current, lines) {
    const base = parseCookieHeader(current);
    if (!base) return '';
    const order = [];
    const byName = new Map();
    base.forEach((pair) => {
        if (!byName.has(pair.name)) order.push(pair.name);
        byName.set(pair.name, pair.value);
    });
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
        const head = String(lines[i]).split(';')[0];
        const at = head.indexOf('=');
        if (at < 1) continue;
        const name = head.slice(0, at).trim();
        const value = head.slice(at + 1).trim();
        if (!value || !COOKIE_NAME_RE.test(name) || !COOKIE_VALUE_RE.test(value)) continue;
        if (byName.get(name) === value) continue;
        if (!byName.has(name)) order.push(name);
        byName.set(name, value);
        changed = true;
    }
    if (!changed) return '';
    const merged = order.slice(0, COOKIE_MAX_PAIRS)
        .map((name) => ({ name: name, value: byName.get(name) }));
    if (!hasSessionCookie(merged)) return '';
    const text = serializeCookiePairs(merged);
    return text.length > COOKIE_MAX_LENGTH ? '' : text;
}

function cookieFingerprint(cookie) {
    if (!cookie) return '';
    return crypto.createHash('sha256').update(cookie).digest('hex').slice(0, 8);
}

function cookieCredentialIdentity(cookie) {
    const value = process.env.ZTO_AUTHORIZATION || process.env.ZTO_TOKEN || cookie || '';
    return value ? crypto.createHash('sha256').update(value).digest('hex') : '';
}

function sessionCookieValue(cookie) {
    const pairs = parseCookieHeader(cookie);
    const pair = pairs && pairs.find((entry) => entry.name === SESSION_COOKIE_NAME);
    return pair ? pair.value : '';
}

function currentCookieCredential(store) {
    return { cookie: cookieState.value, source: cookieState.source, store: store, renewal: '',
        version: cookieState.version, identity: cookieCredentialIdentity(cookieState.value) };
}

function cookieSessionIsCurrent(session) {
    if (!session || session.identity !== cookieCredentialIdentity(cookieState.value)) return false;
    if (process.env.ZTO_AUTHORIZATION || process.env.ZTO_TOKEN) return !session.cookie;
    return session.cookie === cookieState.value && session.version === cookieState.version;
}

function replaceCookieValue(value) {
    if (cookieState.value === value) return;
    if (cookieState.value) cookieState.obsolete.add(cookieState.value);
    while (cookieState.obsolete.size > 32) cookieState.obsolete.delete(cookieState.obsolete.values().next().value);
    cookieState.value = value;
    cookieState.version += 1;
    cookieState.authIdentity = '';
    cookieState.authRejectedAt = 0;
    cookieState.authAcceptedAt = 0;
}

function adoptStoredCookie(stored, etag, version) {
    if (version !== cookieState.version) return false;
    const pending = cookieState.pendingRenewal;
    if (pending && (stored === pending.baseCookie || pending.ancestors.has(stored))) {
        if (etag) {
            pending.baseCookie = stored;
            pending.etag = etag;
            pending.missing = false;
            cookieState.storeCookie = stored;
            cookieState.storeEtag = etag;
            cookieState.storeMissing = false;
        }
        return false;
    }
    if (stored !== cookieState.value && cookieState.obsolete.has(stored) && !cookieState.mustRevalidate) return false;
    replaceCookieValue(stored);
    cookieState.source = 'blob';
    cookieState.at = Date.now();
    cookieState.storeReason = '';
    cookieState.storeCookie = stored;
    cookieState.storeEtag = etag || '';
    cookieState.storeMissing = false;
    cookieState.pendingRenewal = null;
    cookieState.mustRevalidate = false;
    return true;
}

function loadBlobsModule() {
    if (blobsModuleForTests) return blobsModuleForTests;
    return require('@netlify/blobs');
}

function openCookieStore(netlifyEvent) {
    if (!netlifyEvent || typeof netlifyEvent.blobs !== 'string' || !netlifyEvent.blobs) {
        return { store: null, reason: 'no-context' };
    }
    let blobs;
    try {
        blobs = loadBlobsModule();
    } catch (_) {
        return { store: null, reason: 'import' };
    }
    if (!blobs || typeof blobs.connectLambda !== 'function' || typeof blobs.getStore !== 'function') {
        return { store: null, reason: 'export' };
    }
    try {
        blobs.connectLambda(netlifyEvent);
    } catch (_) {
        return { store: null, reason: 'connect' };
    }
    try {
        return { store: blobs.getStore(COOKIE_STORE_NAME), reason: '' };
    } catch (_) {
        return { store: null, reason: 'getstore' };
    }
}

function settleWithin(run, timeoutMs, label) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => finish({ ok: false, reason: label + ':timeout' }), timeoutMs);
        let pending;
        try {
            pending = run();
        } catch (_) {
            finish({ ok: false, reason: label + ':throw' });
            return;
        }
        Promise.resolve(pending).then(
            (value) => finish({ ok: true, value: value }),
            (error) => {
                const name = error && typeof error.name === 'string' && /^[A-Za-z]{1,40}$/.test(error.name)
                    ? error.name
                    : 'error';
                finish({ ok: false, reason: label + ':' + name });
            }
        );
    });
}

// ⛔ **Blobs មិនត្រូវជាចំណុចដាច់តែមួយ — ទាំងភាពអាចប្រើបាន ទាំងល្បឿន។**
// ក្រោយ TTL ៦០ វិនាទី ការអានចាស់ឈរ **លើផ្លូវឆ្លើយតប** ➜ រាល់ការស្កេនរង់ចាំ
// Netlify Blobs មុនហៅ ZTO ទោះបីជា Cookie ដដែលនៅក្នុងសតិក៏ដោយ។ ដូច្នេះពេលមាន
// តម្លៃក្នុងសតិរួច ៖ ឆ្លើយភ្លាម រួចធ្វើឲ្យស្រស់ **ខាងក្រោយ**។ ⛔ ក្រោយ 401
// (`invalidateCookieCache()`) ការអានត្រូវ **ទប់** វិញ — ទីនោះជាកន្លែងដែល
// ការអានតម្លៃថ្មីពិតជាចាំបាច់មុនហៅ upstream។
function refreshCookieInBackground(store) {
    if (cookieRefreshInFlight || !store) return;
    cookieRefreshInFlight = true;
    // ⛔ Netlify អាច **បង្កក** container ភ្លាមក្រោយការឆ្លើយតប ➜ ការអាននេះអាច
    // ដោះវិញយូរក្រោយមក ដោយកាន់ទិដ្ឋភាព **ចាស់**។ ខណៈនោះ Argus អាចបានប្តូរ
    // session ហើយ (`adoptRenewedCookie`) ➜ ការសរសេរជាន់ដោយទិដ្ឋភាពចាស់នឹង
    // បង្កើត 401 ដែលយើងទើបជៀសផុត។ ដូច្នេះអនុវត្តតែពេលសតិ **មិនប្រែ**។
    const seen = cookieState.version;
    settleWithin(
        () => store.getWithMetadata(COOKIE_STORE_KEY, { type: 'text' }),
        COOKIE_STORE_TIMEOUT_MS,
        'read'
    ).then((read) => {
        if (!read.ok) {
            cookieState.storeReason = read.reason;
            return;
        }
        const entry = read.value;
        const stored = sanitizeStoredCookie(entry && entry.data);
        if (!stored) {
            cookieState.storeReason = entry && entry.data ? 'invalid' : 'empty';
            return;
        }
        adoptStoredCookie(stored, entry.etag, seen);
    }, () => {}).then(() => {
        cookieRefreshInFlight = false;
    }, () => {
        cookieRefreshInFlight = false;
    });
}

async function resolveCookieCredential(netlifyEvent, env, options) {
    if (env.ZTO_AUTHORIZATION || env.ZTO_TOKEN) {
        return { cookie: '', source: '', store: null, renewal: '', identity: cookieCredentialIdentity('') };
    }
    const skipCache = !!(options && options.fresh);
    const readTimeoutMs = (options && options.timeoutMs !== undefined)
        ? options.timeoutMs
        : COOKIE_STORE_TIMEOUT_MS;
    let storeWitness = null;
    const opened = openCookieStore(netlifyEvent);
    // ⛔ មូលហេតុត្រូវរស់រានពី cache ។ ការសរសេរ `storeReason = opened.reason`
    // (ជា `''` ពេល store បើកបាន) មុនការពិនិត្យ cache លុបមូលហេតុនៃការអាន
    // ដែលធ្លាក់ ៖ វាស់បានលើ Windows ពិត (2026-09-02) — helper សួរ
    // `?diag=1` ១៤ ដង ហើយមើលឃើញ `source: env` ដោយ **គ្មានមូលហេតុ**។
    if (opened.reason) cookieState.storeReason = opened.reason;
    if (!skipCache && cookieState.value && elapsedSince(cookieState.at) < COOKIE_CACHE_TTL_MS) {
        return currentCookieCredential(opened.store);
    }
    const blocking = !!(options && options.blocking);
    // ⛔ ការធ្វើឲ្យស្រស់ខាងក្រោយ **មិនបង់ថ្លៃពេលរបស់សំណើនេះទេ** (វាមានពិដាន
    // ផ្ទាល់ខ្លួន `COOKIE_STORE_TIMEOUT_MS`) ➜ ការចាក់សោវាក្រោយ `readTimeoutMs`
    // ធ្វើឲ្យថវិកាតឹង **បង្កក Cookie ជារៀងរហូត** ៖ ការស្កេនលែងធ្វើឲ្យវាស្រស់
    // ហើយ helper ដែលសរសេរ Cookie ថ្មី ត្រូវរង់ចាំការត្រៀមជុំក្រោយ។
    if (!skipCache && !blocking && !cookieState.mustRevalidate && cookieState.value && opened.store) {
        refreshCookieInBackground(opened.store);
        return currentCookieCredential(opened.store);
    }
    if (opened.store && readTimeoutMs > 0) {
        const version = cookieState.version;
        const read = await settleWithin(
            () => opened.store.getWithMetadata(COOKIE_STORE_KEY, { type: 'text' }),
            readTimeoutMs,
            'read'
        );
        if (version !== cookieState.version) return currentCookieCredential(opened.store);
        if (read.ok) {
            const entry = read.value;
            const stored = sanitizeStoredCookie(entry && entry.data);
            if (stored) {
                adoptStoredCookie(stored, entry.etag, version);
                return currentCookieCredential(opened.store);
            }
            storeWitness = { cookie: entry && typeof entry.data === 'string' ? entry.data : '',
                etag: entry && typeof entry.etag === 'string' ? entry.etag : '', missing: entry === null };
            cookieState.storeReason = entry && entry.data ? 'invalid' : 'empty';
        } else {
            cookieState.storeReason = read.reason;
        }
    }
    if (opened.store && !(readTimeoutMs > 0)) cookieState.storeReason = 'budget';
    // ⛔ **«អានឡើងវិញមិនបាន» ≠ «Cookie បាត់»** — ច្បាប់ដដែលនឹង `license-verify.js`
    // («មិនអាចផ្ទៀងផ្ទាត់» ≠ «ខុស») អនុវត្តលើ Cookie ៖ Cookie blob ដែលមាន
    // ក្នុងសតិ ត្រូវ **រស់** រហូតដល់មានសាលក្រម 401 ពិត (`mustRevalidate`)។
    // ការសរសេរជាន់វាដោយ `ZTO_COOKIE` env ដែល **មិនមាន** បំផ្លាញ credential
    // ដ៏ល្អ ➜ HTTP 503 `ZTO_AUTH_NOT_CONFIGURED` ខណៈ Cookie ពិតជានៅដដែល
    // (វាស់បាន ៖ ៥/១០ ការស្កេនធ្លាក់ ជាមួយ `ZTO_UPSTREAM_TIMEOUT_MS=7500`)។
    // វាក៏រក្សា **លំដាប់អាទិភាព** ដែលឯកសារចែងផង ៖ blob ឈ្នះលើ `ZTO_COOKIE`។
    if (!cookieState.mustRevalidate && cookieState.value) {
        return currentCookieCredential(opened.store);
    }
    const envCookie = sanitizeEnvCookie(env.ZTO_COOKIE);
    replaceCookieValue(envCookie);
    cookieState.source = envCookie ? 'env' : '';
    cookieState.at = envCookie ? Date.now() : 0;
    cookieState.storeCookie = storeWitness ? storeWitness.cookie : '';
    cookieState.storeEtag = storeWitness ? storeWitness.etag : '';
    cookieState.storeMissing = !!(storeWitness && storeWitness.missing);
    cookieState.pendingRenewal = null;
    cookieState.mustRevalidate = false;
    return currentCookieCredential(opened.store);
}

function invalidateCookieCache(session) {
    if (session && !cookieSessionIsCurrent(session)) return;
    cookieState.at = 0;
    cookieState.mustRevalidate = true;
}

function noteCookieRejected(session) {
    if (!cookieSessionIsCurrent(session)) return;
    cookieState.authIdentity = session.identity;
    cookieState.authRejectedAt = Date.now();
    if (cookieState.pendingRenewal && cookieState.pendingRenewal.value === session.cookie) cookieState.pendingRenewal = null;
}

function noteCookieAccepted(session) {
    if (!cookieSessionIsCurrent(session)) return;
    cookieState.authIdentity = session.identity;
    cookieState.authRejectedAt = 0;
    cookieState.authAcceptedAt = Date.now();
}

function noteCookieRenewal(session, response) {
    if (!session || !session.store || !session.cookie) return;
    const lines = setCookieLines(response);
    if (!lines.length) return;
    const merged = mergeRenewedCookie(session.cookie, lines);
    if (!merged || merged === session.cookie) return;
    session.renewal = merged;
}

// ⛔ ពិដានល្បឿន និងថវិកាពេល ការពារ **ការសរសេរទៅ Blobs** — មិនមែនការចងចាំទេ។
// Argus ទើបប្រគល់ session ថ្មីមកឲ្យយើងក្នុងសំណើនេះ ៖ ការបោះវាចោលទាំងស្រុង
// ធ្វើឲ្យសំណើបន្ទាប់នៃ instance ដដែលផ្ញើ Cookie **ចាស់** ➜ 401 ដែលអាចជៀសបាន
// ➜ អាន store ឡើងវិញ បូកការសាកម្តងទៀត (ថ្លៃមួយជុំពេញនៃថវិកា)។ ដូច្នេះការ
// ចងចាំកើតឡើង **ជានិច្ច** ចំណែកការសរសេរនៅតែស្ថិតក្រោមពិដានដដែល។
function adoptRenewedCookie(session, merged) {
    if (!merged || !cookieSessionIsCurrent(session)) return;
    const pending = cookieState.pendingRenewal;
    const baseCookie = pending ? pending.baseCookie : cookieState.storeCookie;
    const etag = pending ? pending.etag : cookieState.storeEtag;
    const ancestors = new Set(pending ? pending.ancestors : []);
    ancestors.add(session.cookie);
    while (ancestors.size > 32) ancestors.delete(ancestors.values().next().value);
    replaceCookieValue(merged);
    session.cookie = merged;
    session.version = cookieState.version;
    session.identity = cookieCredentialIdentity(merged);
    cookieState.pendingRenewal = { value: merged, baseCookie: baseCookie, etag: etag,
        missing: cookieState.storeMissing, version: cookieState.version, ancestors: ancestors };
}

async function flushCookieRenewal(session, timeoutMs) {
    if (!session || !session.store) return;
    const budgetedMs = timeoutMs === undefined ? COOKIE_RENEW_WRITE_TIMEOUT_MS : timeoutMs;
    if (session.renewal) {
        const merged = session.renewal;
        session.renewal = '';
        adoptRenewedCookie(session, merged);
    }
    const pending = cookieState.pendingRenewal;
    if (!pending || !(budgetedMs > 0) || cookieWriteInFlight) return;
    const criticalRotation = sessionCookieValue(pending.value) !== sessionCookieValue(pending.baseCookie);
    const sameAttempt = pending.value === cookieState.renewAttemptValue && pending.etag === cookieState.renewAttemptEtag;
    if (elapsedSince(cookieState.renewAt) < COOKIE_RENEW_MIN_GAP_MS && (!criticalRotation || sameAttempt)) return;
    if (!pending.etag && !pending.missing) {
        cookieState.storeReason = 'write:no-etag';
        return;
    }
    cookieState.renewAt = Date.now();
    cookieState.renewAttemptValue = pending.value;
    cookieState.renewAttemptEtag = pending.etag;
    const baseCookie = pending.baseCookie;
    const baseEtag = pending.etag;
    const options = baseEtag ? { onlyIfMatch: baseEtag } : { onlyIfNew: true };
    const run = Promise.resolve().then(() => session.store.set(COOKIE_STORE_KEY, pending.value, options)).then((result) => {
        if (cookieState.storeCookie !== baseCookie || cookieState.storeEtag !== baseEtag) return;
        if (!result || result.modified !== true || typeof result.etag !== 'string' || !result.etag) {
            cookieState.storeReason = result && result.modified === false ? 'write:conflict' : 'write:unconfirmed';
            cookieState.at = 0;
            cookieState.mustRevalidate = true;
            return;
        }
        cookieState.storeCookie = pending.value;
        cookieState.storeEtag = result.etag;
        cookieState.storeMissing = false;
        const current = cookieState.pendingRenewal;
        if (current === pending) cookieState.pendingRenewal = null;
        else if (current && current.baseCookie === baseCookie && current.etag === baseEtag) {
            current.baseCookie = pending.value;
            current.etag = result.etag;
            current.missing = false;
        }
        cookieState.source = 'blob';
        if (cookieState.value === pending.value) cookieState.at = Date.now();
        cookieState.storeReason = '';
        cookieState.renewals += 1;
    });
    cookieWriteInFlight = run;
    const write = await settleWithin(() => run, budgetedMs, 'write');
    if (cookieWriteInFlight === run) cookieWriteInFlight = null;
    if (!write.ok) {
        if (cookieState.pendingRenewal && cookieState.pendingRenewal.baseCookie === baseCookie) cookieState.storeReason = write.reason;
    }
}

function noteUpstreamSetCookie(response) {
    try {
        const lines = setCookieLines(response);
        upstreamCookieSignal.seenAt = Date.now();
        upstreamCookieSignal.setCookie = lines.length > 0;
        upstreamCookieSignal.names = lines
            .map((line) => String(line).split('=')[0].trim())
            .filter((name) => COOKIE_NAME_RE.test(name))
            .slice(0, 12);
    } catch (_) {}
}

class ZtoConfigError extends Error {
    constructor(reason) {
        super('ZTO_CONFIG_INVALID');
        this.name = 'ZtoConfigError';
        this.reason = String(reason || '');
    }
}

function elapsedSince(mark) {
    if (!mark) return Infinity;
    const delta = Date.now() - mark;
    return delta < 0 ? Infinity : delta;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'no-referrer'
        },
        body: JSON.stringify(body)
    };
}

function timingSafeEqualText(left, right) {
    const a = Buffer.from(String(left || ''));
    const b = Buffer.from(String(right || ''));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function boundedInteger(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function boolEnv(value, fallback) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (!text) return fallback;
    if (/^(?:1|true|yes|on)$/i.test(text)) return true;
    if (/^(?:0|false|no|off)$/i.test(text)) return false;
    return fallback;
}

function parseExtraHeaders(raw) {
    if (!raw) return {};
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (_) {
        throw new ZtoConfigError('headers:invalid-json');
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new ZtoConfigError('headers:not-object');
    }
    const safe = {};
    Object.keys(parsed).forEach((name) => {
        if (HEADER_NAME_RE.test(name) && !FORBIDDEN_FORWARD_HEADER_RE.test(name) && typeof parsed[name] === 'string') {
            safe[name] = parsed[name];
        }
    });
    return safe;
}

function readFieldPaths(raw, defaults, label) {
    const text = String(raw || '').trim();
    if (!text) return defaults;
    const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return defaults;
    parts.forEach((part) => {
        if (part.length > 120 || !FIELD_PATH_RE.test(part)) throw new ZtoConfigError('field:' + label);
    });
    const merged = parts.slice();
    defaults.forEach((part) => { if (merged.indexOf(part) === -1) merged.push(part); });
    return merged.slice(0, 24);
}

// ⛔ ស្ថានភាព «បិទរួចនៅ ZTO» ជាវាល **ស្រេចចិត្ត** ៖ បើគ្មានការកំណត់ ➜ មុខងារ
// ដេកលក់ទាំងស្រុង។ ⛔ ហើយការកំណត់ **ខុស មិនត្រូវសម្លាប់ lookup** ដូច
// `ZTO_FIELD_PHONE` ដទៃទេ (ពួកនោះបោះ `ZtoConfigError` ➜ 503) — លេខទូរស័ព្ទ
// និងលុយសំខាន់ជាងស្លាកស្ថានភាព ➜ ការកំណត់ខុសបិទតែមុខងារនេះ ហើយប្រាប់
// មូលហេតុក្នុង `?diag=1`។
function readSignedConfig(env) {
    const out = { paths: [], values: [], reason: '' };
    const rawPaths = String(env.ZTO_FIELD_SIGNED || '').trim();
    const rawValues = String(env.ZTO_SIGNED_VALUES || '').trim();
    if (!rawPaths && !rawValues) return out;
    if (!rawPaths || !rawValues) {
        out.reason = rawPaths ? 'values:missing' : 'paths:missing';
        return out;
    }
    const paths = rawPaths.split(',').map((part) => part.trim()).filter(Boolean);
    if (!paths.length || paths.length > SIGNED_PATH_MAX
        || paths.some((part) => part.length > 120 || !FIELD_PATH_RE.test(part))) {
        out.reason = 'paths:invalid';
        return out;
    }
    const values = rawValues.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
    if (!values.length || values.length > SIGNED_VALUE_MAX
        || values.some((part) => !SIGNED_VALUE_RE.test(part))) {
        out.reason = 'values:invalid';
        return out;
    }
    out.paths = paths;
    out.values = values;
    return out;
}

// ⛔ **មិនបោះជាដាច់ខាត** ៖ ការកំណត់បញ្ជីខុសត្រូវបិទតែមុខងារបញ្ជី ហើយ
// រាយមូលហេតុក្នុង `?diag=1` — មិនមែនបោះ `ZtoConfigError` ➜ 503 ដែលនឹង
// **សម្លាប់ការស្កេន** ទាំងស្រុង។
function readListConfig(env) {
    const out = {
        enabled: false, url: null, scanType: DEFAULT_LIST_SCAN_TYPE,
        pageSize: 100, maxPages: 3, reason: '', fingerprint: ''
    };
    let url;
    try {
        url = new URL(String(env.ZTO_LIST_URL || '').trim() || DEFAULT_LIST_URL);
    } catch (_) {
        out.reason = 'url:invalid';
        return out;
    }
    if (url.protocol !== 'https:') { out.reason = 'url:invalid'; return out; }
    const scanType = String(env.ZTO_LIST_SCAN_TYPE || '').trim() || DEFAULT_LIST_SCAN_TYPE;
    if (!LIST_SCAN_TYPE_RE.test(scanType)) { out.reason = 'scan-type:invalid'; return out; }
    out.enabled = true;
    out.url = url;
    out.scanType = scanType;
    // ⛔ អត្ថបទទទេ ជាការ **បិទជាន់នេះដោយចេតនា** (ZTO ប្តូរឈ្មោះ ➜ អ្នកប្រើ
    // ត្រូវអាចដោះវាចេញភ្លាម ដោយមិនរង់ចាំ deploy កូដ)។ `undefined` ➜ លំនាំដើម។
    out.scanDesc = env.ZTO_LIST_SCAN_DESC === undefined
        ? DEFAULT_LIST_SCAN_DESC
        : String(env.ZTO_LIST_SCAN_DESC).trim();
    out.pageSize = boundedInteger(env.ZTO_LIST_PAGE_SIZE, 100, 10, 100);
    out.maxPages = boundedInteger(env.ZTO_LIST_MAX_PAGES, 3, 1, 20);
    out.fingerprint = crypto.createHash('sha256')
        .update(url.href).update(FIELD_SEPARATOR)
        .update(scanType).update(FIELD_SEPARATOR)
        .update(out.scanDesc).update(FIELD_SEPARATOR)
        .update(String(out.pageSize))
        .digest('base64url')
        .slice(0, 16);
    return out;
}

// ⛔ សាលក្រម **៣** ដដែលនឹង `readListConfig()` ៖ អវត្តមាន ➜ `site:missing` ·
// រូបរាងខុស ➜ `site:invalid` · ត្រឹមត្រូវ ➜ កូដ។ ⛔ វា **មិនបោះ** ៖ «បិទ»
// មិនមែនកំហុស ➜ HTTP 200 គ្មានវាល `error` (ច្បាប់ដដែលនឹង `found:false`)។
// ⛔ **លេខសាខាត្រូវមកពីអត្តសញ្ញាណ មិនមែនពី parameter របស់ client។**
//
// 🔴 ការវាស់របស់ម្ចាស់គម្រោង ៖ Cookie `BOS-MAN-SESSION` ផ្ទុកសិទ្ធិអាន
// **ទូទាំងប្រទេស** ➜ លេខសាខាជាព្រំដែន **តែមួយ** ហើយវាធ្វើដំណើរជា
// parameter ដែល client គ្រប់គ្រង ➜ អ្នកកាន់ `ZTO_PROXY_KEY` (សោដែល
// **ចែករំលែក** ទៅគ្រប់ឧបករណ៍) អានបញ្ជីរបស់សាខា **ណាក៏បាន** ដោយហៅ
// Function ដោយផ្ទាល់។ ការចងខាង client ទប់បានតែអ្នកប្រើស្មោះត្រង់។
//
// ដូច្នេះអ្នកសម្រេចឈរនៅ **server** ៖ Firebase **ID token** (RS256 ចុះ
// ហត្ថលេខាដោយ Google) ➜ email ដែលផ្ទៀងផ្ទាត់រួច ➜ លេខសាខា។ ⛔ `?site=`
// របស់ client ត្រូវ **បោះចោល**។
//
// ⛔ **ជាន់នេះឈរលើការគ្រប់គ្រងការបង្កើតគណនី** ៖ បើ Firebase បើក sign-up
// សាធារណៈ អ្នកវាយប្រហារបង្កើត `x@zoew<សាខា>.com` ដោយខ្លួនឯង ➜ ត្រូវដក
// «Enable create (sign-up)» ក្នុង Console។ `email_verified` **មិនត្រូវ
// ទាមទារ** ព្រោះ domain ទាំងនោះមិនមែន domain ពិត (ម្ចាស់គម្រោងបង្កើត
// គណនីដោយដៃ) ➜ ការទាមទារវានឹងបិទមុខងារទាំងស្រុង។
const ID_TOKEN_HEADER = 'x-zoe-id-token';
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const FIREBASE_CERTS_TTL_MS = 60 * 60 * 1000;
const FIREBASE_CERTS_MIN_TIMEOUT_MS = 1200;
const FIREBASE_CERTS_MAX_TIMEOUT_MS = 3000;
const ID_TOKEN_SKEW_MS = 60 * 1000;
const PROJECT_ID_RE = /^[a-z0-9][a-z0-9-]{2,62}$/;
const PROJECT_ID_MAX = 16;
const SITE_EMAIL_PREFIX_RE = /^[a-z0-9-]{1,32}$/;
const SITE_EMAIL_PREFIX_DEFAULT = 'zoew';

const certsState = { at: 0, keys: null, inFlight: null };

// ⛔ បញ្ជីបំបែកដោយ comma តាមលំនាំដដែលនឹង `ZTO_SIGNED_VALUES` (ច្បាប់ ១២)
// ➜ ដកឃ្លា និងធាតុទទេមិនសំខាន់។
function readProjectIds(env) {
    const raw = String((env && env.FIREBASE_PROJECT_IDS) || '').trim();
    if (!raw) return [];
    const parts = raw.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
    if (!parts.length || parts.length > PROJECT_ID_MAX) return [];
    if (parts.some((part) => !PROJECT_ID_RE.test(part))) return [];
    return parts;
}

function siteEmailPrefix(env) {
    const raw = String((env && env.ZTO_SITE_EMAIL_PREFIX) || '').trim().toLowerCase();
    return SITE_EMAIL_PREFIX_RE.test(raw) ? raw : SITE_EMAIL_PREFIX_DEFAULT;
}

// ⛔ `$` ជាចំណុចសំខាន់ ៖ បើគ្មានវា `…@zoew881859.com.evil.com` នឹងឆ្លង។
function siteCodeFromEmail(email, prefix) {
    const text = String(email || '').trim().toLowerCase();
    const re = new RegExp('@' + prefix + '([0-9]{4,12})\\.com$');
    const hit = re.exec(text);
    return hit ? hit[1] : '';
}

function b64urlBuf(text) {
    const raw = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/]*$/.test(raw)) return null;
    const pad = raw.length % 4;
    try { return Buffer.from(raw + (pad ? '===='.slice(pad) : ''), 'base64'); } catch (_) { return null; }
}

function decodeIdToken(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const headBuf = b64urlBuf(parts[0]);
    const bodyBuf = b64urlBuf(parts[1]);
    const sig = b64urlBuf(parts[2]);
    if (!headBuf || !bodyBuf || !sig || !sig.length) return null;
    let header, payload;
    try {
        header = JSON.parse(headBuf.toString('utf8'));
        payload = JSON.parse(bodyBuf.toString('utf8'));
    } catch (_) { return null; }
    if (!header || typeof header !== 'object' || Array.isArray(header)) return null;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    return { header: header, payload: payload, signed: parts[0] + '.' + parts[1], signature: sig };
}

// ⛔ វិញ្ញាបនបត្ររបស់ Google **រួមសម្រាប់គ្រប់ Project** ➜ ការទាញតែម្ដង
// បម្រើ Project ប៉ុន្មានក៏បាន។ cache ជាការចាំបាច់ ៖ ការទាញរាល់សំណើនឹង
// ស៊ីថវិកា ហើយធ្វើឲ្យការស្កេនយឺត។
async function firebaseCerts(timeoutMs) {
    if (certsState.keys && elapsedSince(certsState.at) < FIREBASE_CERTS_TTL_MS) return certsState.keys;
    if (certsState.inFlight) return certsState.inFlight;
    certsState.inFlight = (async () => {
        const out = await settleWithin(async () => {
            const res = await fetch(FIREBASE_CERTS_URL, { method: 'GET' });
            if (!res || !res.ok) throw new Error('certs:http');
            return await res.json();
        }, timeoutMs, 'certs');
        certsState.inFlight = null;
        if (!out.ok || !out.value || typeof out.value !== 'object') return certsState.keys;
        const keys = {};
        Object.keys(out.value).forEach((kid) => {
            const pem = out.value[kid];
            if (typeof pem === 'string' && pem.indexOf('BEGIN CERTIFICATE') !== -1) keys[kid] = pem;
        });
        if (!Object.keys(keys).length) return certsState.keys;
        certsState.keys = keys;
        certsState.at = Date.now();
        return keys;
    })();
    return certsState.inFlight;
}

// ⛔ សាលក្រម ៣ ៖ `ok` · មូលហេតុដែល **មិនលេចតម្លៃ** · គ្មានការបោះ។
async function verifyIdToken(token, projectIds, timeoutMs) {
    if (!token) return { ok: false, reason: 'idtoken:missing' };
    if (!projectIds.length) return { ok: false, reason: 'idtoken:project-unset' };
    const parsed = decodeIdToken(token);
    if (!parsed) return { ok: false, reason: 'idtoken:malformed' };
    if (parsed.header.alg !== 'RS256') return { ok: false, reason: 'idtoken:alg' };
    const kid = typeof parsed.header.kid === 'string' ? parsed.header.kid : '';
    if (!kid) return { ok: false, reason: 'idtoken:kid' };

    const aud = typeof parsed.payload.aud === 'string' ? parsed.payload.aud.toLowerCase() : '';
    if (!aud || projectIds.indexOf(aud) === -1) return { ok: false, reason: 'idtoken:aud' };
    if (parsed.payload.iss !== 'https://securetoken.google.com/' + aud) return { ok: false, reason: 'idtoken:iss' };

    const now = Date.now();
    const exp = Number(parsed.payload.exp) * 1000;
    const iat = Number(parsed.payload.iat) * 1000;
    if (!Number.isFinite(exp) || exp + ID_TOKEN_SKEW_MS < now) return { ok: false, reason: 'idtoken:expired' };
    if (!Number.isFinite(iat) || iat - ID_TOKEN_SKEW_MS > now) return { ok: false, reason: 'idtoken:future' };
    if (typeof parsed.payload.sub !== 'string' || !parsed.payload.sub) return { ok: false, reason: 'idtoken:sub' };

    const keys = await firebaseCerts(timeoutMs);
    if (!keys) return { ok: false, reason: 'idtoken:certs' };
    const pem = keys[kid];
    if (!pem) return { ok: false, reason: 'idtoken:kid-unknown' };

    let good = false;
    try {
        good = crypto.verify('RSA-SHA256', Buffer.from(parsed.signed), crypto.createPublicKey(pem), parsed.signature);
    } catch (_) { good = false; }
    if (!good) return { ok: false, reason: 'idtoken:signature' };

    const email = typeof parsed.payload.email === 'string' ? parsed.payload.email : '';
    return { ok: true, email: email, reason: '' };
}

function listSiteCodeOf(raw) {
    const text = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!text) return { code: '', reason: 'site:missing' };
    if (!LIST_SITE_CODE_RE.test(text)) return { code: '', reason: 'site:invalid' };
    return { code: text, reason: '' };
}

// ⛔ កាលបរិច្ឆេទត្រូវ **ពិត** មិនត្រឹមត្រូវនឹង regex ៖ `2026-02-31` ឆ្លង
// `LIST_DATE_RE` តែរអិលទៅ `2026-03-03` ➜ ជួរដែលអ្នកប្រើមិនបានស្នើ។
function listDateIsValid(text) {
    if (!LIST_DATE_RE.test(text)) return false;
    const at = Date.parse(text + 'T00:00:00Z');
    if (!Number.isFinite(at)) return false;
    return new Date(at).toISOString().slice(0, 10) === text;
}

function listRange(fromText, toText) {
    const from = String(fromText || '').trim();
    const to = String(toText || '').trim();
    if (!listDateIsValid(from) || !listDateIsValid(to)) return null;
    const a = Date.parse(from + 'T00:00:00Z');
    const b = Date.parse(to + 'T00:00:00Z');
    if (b < a) return null;
    if ((b - a) / 86400000 > LIST_RANGE_MAX_DAYS - 1) return null;
    return { from: from, to: to, start: from + ' 00:00:00', end: to + ' 23:59:59' };
}

function listRequestBody(listConfig, siteCode, range, page) {
    return {
        condition: {
            dispatchOrSendManCode: null,
            mailNos: [],
            preOrNextStationCode: null,
            scanEndTime: range.end,
            scanManCode: null,
            scanSiteCode: siteCode,
            scanStartTime: range.start,
            scanTypeCode: listConfig.scanType,
            signMan: null
        },
        pageNum: page,
        pageSize: listConfig.pageSize
    };
}

// ⛔ សំបកមាន **ជាន់** ៖ `{data:{pageNum,pages,total,result:[…]}}`។ ជួរដេក
// ត្រូវរកឃើញជា **array** ពិត — `result` ដែលមិនមែន array ត្រូវជា **ការធ្លាក់**
// មិនមែន «០ ជួរដេក» ស្ងាត់ៗ (០ ជួរដេកកុហក ធ្វើឲ្យអ្នកប្រើជឿថាថ្ងៃនោះទទេ)។
function listContainerOf(upstream) {
    if (!upstream || typeof upstream !== 'object') return null;
    const roots = [upstream.data, upstream.result, upstream.data && upstream.data.data,
        upstream.body, upstream];
    const keys = ['result', 'rows', 'list', 'records', 'items'];
    for (let i = 0; i < roots.length; i++) {
        const node = roots[i];
        if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
        for (let j = 0; j < keys.length; j++) {
            if (Array.isArray(node[keys[j]])) return { rows: node[keys[j]], meta: node };
        }
    }
    for (let i = 0; i < roots.length; i++) {
        if (Array.isArray(roots[i])) return { rows: roots[i], meta: {} };
    }
    return null;
}

// ⛔ កញ្ចប់ដែល **មិនមែនរបស់អតិថិជន** (ឆ្លងកាត់ · ផ្ទាល់ខ្លួន) មកជាមួយ
// `consigneeMobile: "0"` ➜ វាមិនមែនលេខទូរស័ព្ទទេ។ ⛔ តែ `cod === 0`
// **មិនមែនតម្រង** — កញ្ចប់ `taobao` ដែលបង់មុន មាន COD = 0 ស្របច្បាប់។
function listPhoneIsPlaceholder(text) {
    const digits = String(text || '').replace(/[^0-9]/g, '');
    return !digits || /^0+$/.test(digits);
}

// ⛔ **ការបញ្ចាំងឈរនៅ server** ៖ ឈ្មោះ · អាសយដ្ឋាន · `fcAmount` (ថ្លៃដឹក)
// មិនត្រូវឆ្លងកាត់ទេ — PII ដែលមិនប្រើ និងទំហំដែលមិនចាំបាច់។
// ⛔ សាលក្រម ៣ ៖ `''` (ប្រើបាន) · `'scan-type'` (ប្រភេទស្កេនខុស) ·
// `''` សម្រាប់ជួរដេកដែល **គ្មានវាល** — «មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស»។
// ⛔ តម្លៃពិតរបស់វាល **មិនឆ្លងកាត់ទៅ browser** — ត្រឹមសាលក្រម។
function listScanTypeSkip(listConfig, candidates) {
    const code = pickText(candidates, LIST_SCAN_CODE_PATHS);
    if (code && code !== listConfig.scanType) return 'scan-type';
    if (!listConfig.scanDesc) return '';
    const desc = pickText(candidates, LIST_SCAN_DESC_PATHS);
    if (!desc) return '';
    return desc === listConfig.scanDesc ? '' : 'scan-type';
}

function projectListRow(config, row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const candidates = [row];
    const phone = pickText(candidates, config.phonePaths);
    const cod = pickNumber(candidates, config.codPaths);
    // ⛔ **ផ្លូវបញ្ជី និងផ្លូវស្កេនអានបញ្ជីវាលដដែល** (`config.dodPaths`) ➜ ទិន្នន័យ
    // តែមួយមិនអាចឲ្យលេខ ២ ផ្សេងគ្នាបានទេ។ ⛔ `ZTO_FIELD_DOD` (បើកំណត់) ឈ្នះ
    // ជានិច្ច ➜ ការប្តូរវាលនាពេលអនាគត នៅតែជា env តែម្យ៉ាង គ្មានការកែកូដ។
    const dod = pickNumber(candidates, config.dodPaths);
    const at = pickText(candidates, LIST_TIME_PATHS);
    // ⛔ សាលក្រម «បិទរួច» ជា **ជាន់ទី ១** នៃច្រកទ្វារ «ចាស់ + បិទរួច ➜ បញ្ចូល»
    // ខាង client ៖ បើជួរដេកបញ្ជីផ្ទុកវាល `ZTO_FIELD_SIGNED` នោះការវាស់ឥតថ្លៃ។
    // ⛔ វាលអវត្តមាន ➜ `null` (**មិនទាន់វាស់**) មិនមែន `false` — client ត្រូវ
    // ធ្លាក់ចុះទៅផ្លូវ `/detail` ក្នុងមួយ barcode ជំនួស។
    return {
        barcode: pickText(candidates, LIST_BARCODE_PATHS),
        phone: listPhoneIsPlaceholder(phone) ? '' : phone,
        cod: cod === null ? 0 : cod,
        dod: dod === null ? 0 : dod,
        at: LIST_TIME_RE.test(at) ? at.slice(0, 19) : '',
        ztoClosed: pickSignedVerdict(candidates, config.signed),
        skip: listScanTypeSkip(config.list, candidates)
    };
}

function listResponseBody(config, container, page, siteCode) {
    const rows = container.rows.slice(0, LIST_ROW_MAX)
        .map((row) => projectListRow(config, row))
        .filter(Boolean);
    const meta = container.meta || {};
    const pages = Number(meta.pages);
    const total = Number(meta.total);
    return {
        success: true,
        list: true,
        enabled: true,
        page: page,
        // ⛔ លេខសាខាដែល **ដេរីវេពី token** ➜ UI បង្ហាញការពិត ជំនួសលេខដែល
        // អ្នកប្រើវាយ (ដែល server បោះចោល)។ វាជាសាខារបស់គណនីខ្លួនឯង ➜ គ្មានការលេច។
        site: String(siteCode || ''),
        pages: Number.isFinite(pages) ? pages : (rows.length ? 1 : 0),
        total: Number.isFinite(total) ? total : rows.length,
        rows: rows
    };
}

function readHttpsUrl(raw, label) {
    let url;
    try {
        url = new URL(String(raw));
    } catch (_) {
        throw new ZtoConfigError(label + ':invalid');
    }
    if (url.protocol !== 'https:') throw new ZtoConfigError(label + ':not-https');
    return url;
}

function readBodyTemplate(raw) {
    const text = String(raw || '').trim() || DEFAULT_BODY_TEMPLATE;
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (_) {
        throw new ZtoConfigError('body:invalid-json');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ZtoConfigError('body:not-object');
    }
    return parsed;
}

function fillTemplate(value, barcode, depth) {
    if (depth > 6) return value;
    if (typeof value === 'string') return value.split('{barcode}').join(barcode);
    if (Array.isArray(value)) return value.map((item) => fillTemplate(item, barcode, depth + 1));
    if (value && typeof value === 'object') {
        const out = {};
        Object.keys(value).forEach((key) => { out[key] = fillTemplate(value[key], barcode, depth + 1); });
        return out;
    }
    return value;
}

function readConfig(env) {
    const endpoint = readHttpsUrl(String(env.ZTO_API_URL || '').trim() || DEFAULT_API_URL, 'api-url');
    const method = String(env.ZTO_API_METHOD || 'POST').trim().toUpperCase();
    if (method !== 'GET' && method !== 'POST') throw new ZtoConfigError('method:unsupported');

    const queryParam = String(env.ZTO_REQUEST_QUERY_PARAM || DEFAULT_QUERY_PARAM).trim();
    if (!QUERY_PARAM_RE.test(queryParam)) throw new ZtoConfigError('query-param:invalid');

    const browserOrigin = readHttpsUrl(String(env.ZTO_BROWSER_ORIGIN || '').trim() || DEFAULT_BROWSER_ORIGIN, 'browser-origin');
    const acceptLanguage = String(env.ZTO_ACCEPT_LANGUAGE || DEFAULT_ACCEPT_LANGUAGE).trim().slice(0, 60) || DEFAULT_ACCEPT_LANGUAGE;
    if (!/^[A-Za-z0-9,;=*.\- ]+$/.test(acceptLanguage)) throw new ZtoConfigError('accept-language:invalid');

    const config = {
        endpoint,
        method,
        queryParam,
        bodyTemplate: method === 'POST' ? readBodyTemplate(env.ZTO_REQUEST_BODY_JSON) : null,
        extraHeaders: parseExtraHeaders(env.ZTO_REQUEST_HEADERS_JSON),
        userAgent: String(env.ZTO_USER_AGENT || DEFAULT_USER_AGENT).replace(CONTROL_CHAR_RE, ' ').slice(0, 300),
        acceptLanguage,
        browserOrigin: browserOrigin.origin,
        sendBrowserHeaders: boolEnv(env.ZTO_SEND_BROWSER_HEADERS, null),
        phonePaths: readFieldPaths(env.ZTO_FIELD_PHONE, PHONE_PATHS, 'phone'),
        codPaths: readFieldPaths(env.ZTO_FIELD_COD, COD_PATHS, 'cod'),
        dodPaths: readFieldPaths(env.ZTO_FIELD_DOD, DOD_PATHS, 'dod'),
        barcodePaths: readFieldPaths(env.ZTO_FIELD_BARCODE, BARCODE_PATHS, 'barcode'),
        signed: readSignedConfig(env),
        list: readListConfig(env),
        upstreamTimeoutMs: boundedInteger(env.ZTO_UPSTREAM_TIMEOUT_MS, 6000, 2000, 20000),
        budgetMs: boundedInteger(env.ZTO_REQUEST_BUDGET_MS, 9000, 4000, 24000),
        retries: boundedInteger(env.ZTO_UPSTREAM_RETRIES, 1, 0, 3),
        cacheTtlMs: boundedInteger(env.ZTO_CACHE_TTL_MS, 60000, 0, 600000)
    };

    // ⛔ TTL អវិជ្ជមានត្រូវ **មិនលើស** cache សរុប ➜ `ZTO_CACHE_TTL_MS=0`
    // បិទទាំង ២ ផ្លូវក្នុងកន្លែងតែមួយ។
    config.notFoundCacheTtlMs = Math.min(
        boundedInteger(env.ZTO_NOT_FOUND_CACHE_TTL_MS, NOT_FOUND_CACHE_TTL_DEFAULT_MS, 0, 120000),
        config.cacheTtlMs);

    // ⛔ បញ្ជីប្រែរាល់ការស្កេនថ្មីរបស់ ZTO ➜ TTL របស់វាខ្លីដោយចេតនា ហើយ
    // ឈរ **ក្រោម** `cacheTtlMs` ➜ `ZTO_CACHE_TTL_MS=0` បិទគ្រប់ផ្លូវ cache
    // ក្នុងកន្លែងតែមួយ។
    config.listCacheTtlMs = Math.min(config.cacheTtlMs, LIST_CACHE_TTL_MAX_MS);

    config.budgetMs = Math.min(24000, Math.max(config.budgetMs, config.upstreamTimeoutMs + 1500));
    config.upstreamTimeoutMs = Math.min(config.upstreamTimeoutMs, config.budgetMs - 1000);

    config.fingerprint = crypto.createHash('sha256')
        .update(config.endpoint.href).update(FIELD_SEPARATOR)
        .update(config.method).update(FIELD_SEPARATOR)
        .update(JSON.stringify(config.bodyTemplate || {})).update(FIELD_SEPARATOR)
        .update(String(env.ZTO_AUTHORIZATION || '')).update(FIELD_SEPARATOR)
        .update(String(env.ZTO_TOKEN || '')).update(FIELD_SEPARATOR)
        .update(String(env.ZTO_COOKIE || '')).update(FIELD_SEPARATOR)
        .update(config.phonePaths.join(',') + config.codPaths.join(',') + config.dodPaths.join(','))
        .update(FIELD_SEPARATOR)
        .update(config.signed.paths.join(',') + '|' + config.signed.values.join(','))
        .digest('base64url')
        .slice(0, 22);

    return config;
}

function applyAuthentication(headers, env, cookie) {
    if (env.ZTO_AUTHORIZATION) {
        headers.Authorization = env.ZTO_AUTHORIZATION;
        return 'authorization';
    }
    if (env.ZTO_TOKEN) {
        const tokenHeader = String(env.ZTO_TOKEN_HEADER || 'X-Access-Token').trim();
        if (!HEADER_NAME_RE.test(tokenHeader) || FORBIDDEN_FORWARD_HEADER_RE.test(tokenHeader)) {
            throw new ZtoConfigError('token-header:invalid');
        }
        headers[tokenHeader] = env.ZTO_TOKEN;
        return 'token';
    }
    const effectiveCookie = cookie || sanitizeEnvCookie(env.ZTO_COOKIE);
    if (effectiveCookie) {
        headers.Cookie = effectiveCookie;
        return 'cookie';
    }
    return '';
}

function buildHeaders(config, env, cookie, wantsPost) {
    const credential = {};
    const authKind = applyAuthentication(credential, env, cookie);
    const headers = {
        Accept: 'application/json',
        'Accept-Language': config.acceptLanguage,
        'User-Agent': config.userAgent
    };
    // ⛔ ផ្លូវបញ្ជីជា POST ជានិច្ច ទោះ `ZTO_API_METHOD` ជា GET ➜ header
    // ត្រូវដេរីវេពី **សំណើដែលនឹងចេញពិត** មិនមែនពី method លំនាំដើម។
    if (config.method === 'POST' || wantsPost) headers['Content-Type'] = 'application/json;charset=UTF-8';
    const wantsBrowserHeaders = config.sendBrowserHeaders === null
        ? authKind === 'cookie'
        : config.sendBrowserHeaders === true;
    if (wantsBrowserHeaders) {
        headers.Origin = config.browserOrigin;
        headers.Referer = config.browserOrigin + '/';
        headers['User-Language'] = config.acceptLanguage;
    }
    Object.assign(headers, config.extraHeaders);
    Object.assign(headers, credential);
    return { headers, authKind };
}

function upstreamMessage(upstream, fallback) {
    const raw = upstream && (upstream.error || upstream.message || upstream.msg || upstream.errorMsg);
    if (typeof raw !== 'string') return fallback;
    const safe = raw.replace(CONTROL_CHAR_RE, ' ').trim().slice(0, 180);
    return safe || fallback;
}

function ztoAuthRejected(response, upstream) {
    if (response && (response.status === 401 || response.status === 403)) return true;
    const codes = upstream ? [upstream.code, upstream.errorCode, upstream.statusCode] : [];
    const raw = upstreamMessage(upstream, '');
    const message = raw.toLowerCase();
    if (codes.some((code) => /^(?:401|403|unauthorized|forbidden|not[_-]?login|login[_-]?required)$/.test(String(code ?? '').trim().toLowerCase()))) return true;
    if (LOGIN_REDIRECT_RE.test(raw)) return true;
    return /(?:session|token|cookie|login|auth).{0,32}(?:expired|invalid|required|missing|failed)|(?:expired|invalid).{0,16}(?:session|token|cookie)|not\s+(?:logged|signed)\s+in|unauthori[sz]ed|未登录|登录失效|登录过期/.test(message);
}

// ⛔ ចំណុចច្របាច់ **តែមួយ** នៃការអានកូដរបស់ upstream ៖ `upstreamSucceeded()`
// និង `noteUpstreamReject()` ត្រូវអានវាល **ដដែល** តាមលំដាប់ **ដដែល** —
// ច្បាប់ចម្លងទី ២ នឹងធ្វើឲ្យសាលក្រម និងការវិនិច្ឆ័យនិយាយផ្ទុយគ្នា។
function upstreamCodeText(upstream) {
    if (!upstream || typeof upstream !== 'object' || Array.isArray(upstream)) return '';
    let raw = '';
    if (upstream.code !== undefined && upstream.code !== null) raw = upstream.code;
    else if (upstream.errorCode !== undefined && upstream.errorCode !== null) raw = upstream.errorCode;
    else if (upstream.statusCode !== undefined && upstream.statusCode !== null) raw = upstream.statusCode;
    return String(raw).trim().toLowerCase();
}

function upstreamSucceeded(upstream) {
    if (!upstream || typeof upstream !== 'object' || Array.isArray(upstream)) return false;
    if (upstream.success === false || upstream.status === false || upstream.result === false) return false;
    if (upstream.success === true || upstream.status === true || upstream.result === true) return true;
    const code = upstreamCodeText(upstream);
    if (!code) return true;
    return SUCCESS_CODE_RE.test(code);
}

// ⛔ **ការកត់ត្រា មិនមែនការសម្រេច** ៖ `ZTO_UPSTREAM_REJECTED` ជា **កន្តុំរួម**
// ដែលលាយ «លេខមិនស្គាល់» (សាលក្រមស្ថាពរ — ការសាកម្តងទៀតឥតប្រយោជន៍) ជាមួយ
// «ZTO ដាច់ពិត» (សាលក្រមបណ្តោះអាសន្ន — ការសាកម្តងទៀតត្រឹមត្រូវ)។ client
// ព្យាយាម **២ ដង** លើទាំងពីរ ព្រោះ 5xx ជា retryable។ ⛔ ការបំបែកពួកវាត្រូវការ
// **payload ពិតរបស់ ZTO** ដែលគ្មាននរណាធ្លាប់មើល ➜ ការទាយនឹងបាំងការដាច់ពិត។
// ដូច្នេះជំហានទី ១ គឺ **ធ្វើឲ្យវាមើលឃើញ** ក្នុង `?diag=1` ⛔ ដោយ **មិនប្តូរ
// សាលក្រម មិនប្តូរ cache មិនប្តូរការសាកម្តងទៀត** — ជុំក្រោយទើបសម្រេចដោយលេខ។
function noteUpstreamReject(status, upstream) {
    upstreamRejectSignal.at = Date.now();
    upstreamRejectSignal.count++;
    upstreamRejectSignal.status = Number(status) || 0;
    const code = upstreamCodeText(upstream);
    upstreamRejectSignal.code = SAFE_REASON_RE.test(code) ? code : (code ? 'unsafe' : '');
}

function orderCandidates(upstream) {
    const found = [];
    function push(value) {
        if (!value || typeof value !== 'object' || found.length >= 8) return;
        if (Array.isArray(value)) {
            if (value.length) push(value[0]);
            return;
        }
        if (found.indexOf(value) === -1) found.push(value);
    }
    if (upstream && typeof upstream === 'object') {
        push(upstream.data);
        push(upstream.result);
        push(upstream.data && upstream.data.data);
        push(upstream.result && upstream.result.data);
        push(upstream.body);
        push(upstream.rows);
        push(upstream);
    }
    return found;
}

function getPath(root, pathText) {
    const parts = pathText.split('.');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
        if (!node || typeof node !== 'object') return undefined;
        node = node[parts[i]];
    }
    return node;
}

function pickText(candidates, paths) {
    for (let i = 0; i < candidates.length; i++) {
        for (let j = 0; j < paths.length; j++) {
            const raw = getPath(candidates[i], paths[j]);
            if (raw === null || raw === undefined || typeof raw === 'object' || typeof raw === 'boolean') continue;
            const text = String(raw).replace(CONTROL_CHAR_RE, '').trim();
            if (text) return text.slice(0, 64);
        }
    }
    return '';
}

// ⛔ **`pickNumber()` ជាចំណុចច្របាច់តែមួយនៃលុយ** — កន្លែងហៅទាំង ៤ សុទ្ធតែ
// ជា COD ឬ DOD (ផ្លូវស្កេន និងផ្លូវបញ្ជី) ➜ ការសម្រេចត្រង់នេះគ្រប់ផ្លូវលុយ។
//
// ⛔ **លេខអវិជ្ជមាន clamp ត្រឹម `0`** ៖ ចំនួនទឹកប្រាក់ដែលត្រូវប្រមូល មិនអាច
// អវិជ្ជមានបានទេ។ មុនកំណែ 2.35.1 វាមិនដែលឈានដល់អ្នកប្រើលើផ្លូវស្កេន ព្រោះ
// `arrivalServiceCharge: 0.00` បាំងវាលខាងក្រោយទាំងអស់ — ការបន្ថែម `fcAmount`
// បើកផ្លូវនោះ ➜ ច្រកទ្វារត្រូវឈរត្រង់នេះ (ច្បាប់ដដែលនឹង `revenue-rules-clamp-test`)។
//
// ⛔ **clamp មិនមែន «រំលងទៅវាលបន្ទាប់»** ៖ ការរំលងនឹងធ្វើឲ្យវាលអវិជ្ជមាន
// លើកតម្លៃរបស់វាល *ផ្សេង* ឡើងជំនួសដោយស្ងាត់ ➜ លេខដែលអ្នកប្រើឃើញ លែងមកពី
// វាលដែលឯកសារសន្យា។ ⛔ ហើយ `0` ជាចំនួនទឹកប្រាក់ **ត្រឹមត្រូវ** (កញ្ចប់ Shopee
// មាន `fcAmount: 0.0` ពិតៗ) ➜ វាឈ្នះដដែល មិនត្រូវរំលងឡើយ។
function pickNumber(candidates, paths) {
    for (let i = 0; i < candidates.length; i++) {
        for (let j = 0; j < paths.length; j++) {
            const raw = getPath(candidates[i], paths[j]);
            if (raw === null || raw === undefined || raw === '' || typeof raw === 'object' || typeof raw === 'boolean') continue;
            const value = Number(raw);
            if (Number.isFinite(value)) return value < 0 ? 0 : value;
        }
    }
    return null;
}

// ⛔ សាលក្រមមាន **៣** ៖ `true` (បិទរួចនៅ ZTO) · `false` (មិនទាន់បិទ) ·
// `null` («មិនទាន់វាស់»)។ វាលដែលរកមិនឃើញ ត្រូវជា `null` ⛔ **មិនមែន `false`**
// — នេះជាច្បាប់ «មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស» ដដែលនឹង `license-verify.js`។
function pickSignedVerdict(candidates, signed) {
    if (!signed || !signed.paths.length || !signed.values.length) return null;
    for (let i = 0; i < candidates.length; i++) {
        for (let j = 0; j < signed.paths.length; j++) {
            const raw = getPath(candidates[i], signed.paths[j]);
            if (raw === null || raw === undefined || typeof raw === 'object') continue;
            const text = String(raw).replace(CONTROL_CHAR_RE, '').trim().toLowerCase();
            if (!text) continue;
            return signed.values.indexOf(text) !== -1;
        }
    }
    return null;
}

function extractOrder(config, upstream) {
    const candidates = orderCandidates(upstream);
    if (!candidates.length) return null;
    const phone = pickText(candidates, config.phonePaths);
    const cod = pickNumber(candidates, config.codPaths);
    const dod = pickNumber(candidates, config.dodPaths);
    if (!phone && cod === null && dod === null) return null;
    return {
        barcode: pickText(candidates, config.barcodePaths),
        phone,
        cod: cod === null ? 0 : cod,
        dod: dod === null ? 0 : dod,
        signed: pickSignedVerdict(candidates, config.signed)
    };
}

function abortError() {
    const error = new Error('ZTO_UPSTREAM_TIMEOUT');
    error.name = 'AbortError';
    return error;
}

// ⛔ `plan` ជា **ការបន្ថែមស្រេចចិត្ត** មិនមែនផ្លូវទី ២ ៖ abort · សាលក្រម
// auth · ការបន្តអាយុ Cookie · ការបម្លែង 429/5xx/HTML ត្រូវ **ប្រើរួម**។
// ការចម្លងរង្វិលជុំនេះសម្រាប់បញ្ជី នឹងបង្កើតផ្លូវបណ្តាញដែលគ្មានអ្នកយាម។
async function requestOnce(config, headers, barcode, timeoutMs, session, plan) {
    const controller = new AbortController();
    let timer = null;
    const settleGuard = new Promise((_, reject) => {
        timer = setTimeout(() => {
            try { controller.abort(); } catch (_) {}
            reject(abortError());
        }, timeoutMs);
    });
    settleGuard.catch(() => {});

    async function attempt() {
        const target = new URL(plan ? plan.href : config.endpoint.href);
        const init = {
            method: plan ? 'POST' : config.method,
            headers,
            signal: controller.signal,
            redirect: 'manual'
        };
        if (plan) {
            init.body = JSON.stringify(plan.body);
        } else if (config.method === 'POST') {
            init.body = JSON.stringify(fillTemplate(config.bodyTemplate, barcode, 0));
        } else {
            target.searchParams.set(config.queryParam, barcode);
        }

        const response = await fetch(target.href, init);
        if (controller.signal.aborted) throw abortError();
        noteUpstreamSetCookie(response);
        noteCookieRenewal(session, response);
        const contentType = response.headers && response.headers.get
            ? (response.headers.get('content-type') || '')
            : '';

        if (response.status === 401 || response.status === 403
            || (response.status >= 300 && response.status < 400)
            || (response.ok && /^text\/html\b/i.test(contentType))) {
            return { kind: 'authRejected' };
        }
        if (response.status === 429) {
            return {
                kind: 'fatal',
                response: json(429, { error: 'ZTO rate limit reached', code: 'ZTO_RATE_LIMITED' })
            };
        }
        if (response.status >= 500) {
            return {
                kind: 'transient',
                response: json(502, { error: 'ZTO HTTP ' + response.status, code: 'ZTO_UPSTREAM_UNAVAILABLE' })
            };
        }

        let upstream;
        try {
            upstream = await response.json();
        } catch (_) {
            return {
                kind: 'fatal',
                response: json(502, {
                    error: 'ZTO returned non-JSON (HTTP ' + response.status + ')',
                    code: 'ZTO_INVALID_RESPONSE'
                })
            };
        }

        if (ztoAuthRejected(response, upstream)) return { kind: 'authRejected' };
        if (!response.ok || !upstreamSucceeded(upstream)) {
            noteUpstreamReject(response.status, upstream);
            return {
                kind: 'fatal',
                response: json(502, {
                    error: 'ZTO rejected the request (HTTP ' + response.status + ')',
                    code: 'ZTO_UPSTREAM_REJECTED'
                })
            };
        }

        if (plan) {
            // ⛔ សំបកដែលគ្មានជួរដេកជា **ការធ្លាក់** មិនមែន «រកមិនឃើញ» ៖
            // `found:false` ជាសាលក្រមរបស់ barcode តែមួយ — បញ្ជីទទេពិត
            // មកជា array ទទេ ដែលឆ្លងផ្លូវជោគជ័យដដែល។
            const built = plan.extract(upstream);
            if (!built) {
                return {
                    kind: 'fatal',
                    response: json(502, {
                        error: 'ZTO list response has no rows',
                        code: 'ZTO_UPSTREAM_REJECTED'
                    })
                };
            }
            return { kind: 'ok', body: built };
        }

        const order = extractOrder(config, upstream);
        if (!order) return { kind: 'notFound' };
        return {
            kind: 'ok',
            body: {
                success: true,
                found: true,
                barcode: order.barcode || barcode,
                phone: order.phone,
                cod: order.cod,
                dod: order.dod,
                ztoClosed: order.signed
            }
        };
    }

    const work = attempt();
    work.catch(() => {});
    try {
        return await Promise.race([work, settleGuard]);
    } catch (error) {
        if (error && error.name === 'AbortError') {
            return {
                kind: 'transient',
                response: json(504, { error: 'ZTO request timed out', code: 'ZTO_TIMEOUT' })
            };
        }
        return {
            kind: 'transient',
            response: json(502, { error: 'Unable to reach ZTO', code: 'ZTO_UNAVAILABLE' })
        };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function fetchOrder(config, headers, barcode, startedAt, session, plan) {
    let attempt = 0;
    let lastTransient = null;
    for (;;) {
        const remaining = config.budgetMs - elapsedSince(startedAt);
        if (remaining <= 1200) {
            return lastTransient || {
                kind: 'fatal',
                response: json(504, { error: 'ZTO request timed out', code: 'ZTO_TIMEOUT' })
            };
        }
        const timeoutMs = Math.max(1000, Math.min(config.upstreamTimeoutMs, remaining - 200));
        const outcome = await requestOnce(config, headers, barcode, timeoutMs, session, plan);
        if (outcome.kind !== 'transient') return outcome;
        lastTransient = { kind: 'fatal', response: outcome.response };
        attempt += 1;
        if (attempt > config.retries) return lastTransient;
        const backoffMs = 250 * attempt;
        if (config.budgetMs - elapsedSince(startedAt) <= backoffMs + 1500) return lastTransient;
        await delay(backoffMs);
    }
}

function budgetLeftMs(config, startedAt) {
    return config.budgetMs - elapsedSince(startedAt);
}

// ⛔ **ការអាន Cookie លើ container *ត្រជាក់* មិនមែនការងារស្រេចចិត្តទេ។**
// ពេលមានតម្លៃក្នុងសតិរួច ការអានជាការធ្វើឲ្យស្រស់ ➜ ថវិកាតឹង ➜ រំលងវាបាន
// ដោយសុវត្ថិភាព។ តែពេល **សតិទទេ** (container ទើបត្រជាក់) ការរំលងការអាន
// មិនសន្សំពេលទេ — វា **ធានាការធ្លាក់** ៖ គ្មាន Cookie ➜ គ្មានការហៅ upstream
// សោះ ➜ HTTP 503 `ZTO_AUTH_NOT_CONFIGURED` ខណៈ Cookie ពិតអង្គុយក្នុង store។
//
// 🔴 វាស់បាន (2026-09-10) ៖ `ZTO_UPSTREAM_TIMEOUT_MS = 7500` (កំណត់ក្នុង
// Netlify env ពិត) បូក budget លំនាំដើម ៩០០០ ➜ បង្អួច = ៣០០ ms នៅ elapsed 0
// ហើយ **០** នៅ elapsed ១ ms ➜ ការស្កេនលើ container ត្រជាក់ធ្លាក់ 503។
// ដូច្នេះកក់បង្អួចអប្បបរមាឲ្យការអាន ដរាបណាថវិកានៅសល់ពិត។ `fetchOrder()`
// កាត់ `timeoutMs` តាម `remaining − 200` រួចហើយ ➜ ការចំណាយនេះ **មិនអាច
// ធ្វើឲ្យលើសពិដាន ១០ វិនាទីរបស់ Netlify** បានទេ។
// ⛔ ការទាញវិញ្ញាបនបត្រឈរ **ក្នុង** ថវិកា (ច្បាប់ដដែលនឹង Cookie store) ៖
// ការដាក់វាក្រៅ នឹងធ្វើឲ្យ Netlify សម្លាប់ Function មុនវាឆ្លើយ។
function certsTimeoutMs(config, startedAt) {
    const left = budgetLeftMs(config, startedAt) - config.upstreamTimeoutMs;
    if (left >= FIREBASE_CERTS_MAX_TIMEOUT_MS) return FIREBASE_CERTS_MAX_TIMEOUT_MS;
    return left > FIREBASE_CERTS_MIN_TIMEOUT_MS ? left : FIREBASE_CERTS_MIN_TIMEOUT_MS;
}

function cookieReadTimeoutMs(config, startedAt) {
    const left = budgetLeftMs(config, startedAt);
    // ⛔ សតិទទេ ➜ គ្មាន Cookie ➜ គ្មានការហៅ upstream សោះ ➜ ការអាន **ជា
    // សំណើទាំងមូល**។ វាត្រូវទទួលពិដានរបស់ store ពេញ ដរាបណាថវិកានៅសល់
    // អាចផ្ទុកការហៅ upstream អប្បបរមា ១។ 🔴 វាស់បាន (2026-09-15) ៖ តាម
    // រូបមន្តចាស់ (កក់ `upstreamTimeoutMs` ពេញមុនការអាន) ការកំណត់ផលិតកម្ម
    // `upstream 7000 · budget 9000` ផ្តល់បង្អួច **៨០០ ms** ➜ Blobs ដែល
    // ឆ្លើយ ២,៥ វិ. លើ container ត្រជាក់ ធ្លាក់ 503 `ZTO_AUTH_NOT_CONFIGURED`
    // ខណៈថវិកា **៧,២ វិ. នៅមិនទាន់ប្រើសោះ** ហើយ Cookie ពិតអង្គុយក្នុង store។
    if (!cookieState.value) {
        const cold = Math.min(COOKIE_STORE_TIMEOUT_MS,
            left - COOKIE_BUDGET_RESERVE_MS - COOKIE_COLD_UPSTREAM_RESERVE_MS);
        if (cold >= COOKIE_READ_MIN_TIMEOUT_MS) return cold;
        // ថវិកាតឹងខ្លាំង ➜ កក់បង្អួចអប្បបរមា តែ **មិនលើសអ្វីដែលនៅសល់ពិត**
        const floor = Math.min(COOKIE_READ_MIN_TIMEOUT_MS, left - COOKIE_BUDGET_RESERVE_MS);
        return floor > 0 ? floor : 0;
    }
    // ⛔ ទិសផ្ទុយ ៖ សតិមានតម្លៃ ➜ ការអានជាការធ្វើឲ្យស្រស់ **សុទ្ធសាធ** ➜
    // វាមិនត្រូវលួចពេលរបស់ upstream ទេ ➜ រំលងពេលថវិកាតឹង។
    const room = left - COOKIE_BUDGET_RESERVE_MS - config.upstreamTimeoutMs;
    if (room >= COOKIE_READ_MIN_TIMEOUT_MS) return Math.min(COOKIE_STORE_TIMEOUT_MS, room);
    return 0;
}

function cookieRenewTimeoutMs(config, startedAt) {
    const room = budgetLeftMs(config, startedAt) - COOKIE_BUDGET_RESERVE_MS;
    if (room < COOKIE_WRITE_MIN_TIMEOUT_MS) return 0;
    return Math.min(COOKIE_RENEW_WRITE_TIMEOUT_MS, room);
}

async function retryAfterAuthRejected(netlifyEvent, config, barcode, startedAt, previousCookie, plan) {
    if (process.env.ZTO_AUTHORIZATION || process.env.ZTO_TOKEN) return null;
    if (budgetLeftMs(config, startedAt) < COOKIE_REFRESH_RETRY_RESERVE_MS) return null;
    const readMs = cookieReadTimeoutMs(config, startedAt);
    if (!(readMs > 0)) return null;
    let fresh;
    try {
        fresh = await resolveCookieCredential(netlifyEvent, process.env, { fresh: true, timeoutMs: readMs });
    } catch (_) {
        return null;
    }
    if (!fresh.cookie || fresh.cookie === previousCookie) {
        // ⛔ ការអានឡើងវិញ **ចាក់ cache ៦០ វិ. សាជាថ្មី** ជាផលរំខាន។ បើ
        // Cookie មិនប្រែ នោះគ្មាន credential ថ្មីសម្រាប់សាក ➜ លុប cache ម្តងទៀត
        // បើមិនដូច្នេះ Cookie ថ្មីដែល helper សរសេរក្រោយមក ត្រូវរង់ចាំ ៦០ វិ.
        invalidateCookieCache(fresh);
        return null;
    }
    let built;
    try {
        built = buildHeaders(config, process.env, fresh.cookie, !!plan);
    } catch (_) {
        return null;
    }
    if (!built.authKind) return null;
    const flightKey = (plan ? plan.cacheKey : config.fingerprint + '|' + barcode.toUpperCase())
        + '|' + (cookieFingerprint(fresh.cookie) || '-');
    let outcome;
    try {
        outcome = await runSharedLookup(flightKey, config, built.headers, barcode, fresh, startedAt, plan);
    } catch (_) {
        return null;
    }
    return { outcome: outcome, session: fresh };
}

function storeCachedBody(key, body, negative) {
    resultCache.delete(key);
    resultCache.set(key, { at: Date.now(), body, negative: !!negative });
    while (resultCache.size > CACHE_MAX) {
        resultCache.delete(resultCache.keys().next().value);
    }
}

// ⛔ សាលក្រម ២ ប្រភេទចែក cache តែមួយ តែ **អាយុខុសគ្នា** ៖ លទ្ធផលពិត
// រស់តាម `ttlMs`; «រកមិនឃើញ» រស់តាម `negativeTtlMs` ដែលខ្លីជាង។ ការវាស់
// អាយុឆ្លងកាត់ `elapsedSince()` ➜ នាឡិកាថយក្រោយ ➜ `Infinity` ➜ ធាតុផុត
// ភ្លាម (fail-open ក្នុងទិសសុវត្ថិភាព — ច្បាប់ `monotonic-gate-test`)។
function readCachedBody(key, ttlMs, negativeTtlMs) {
    const hit = resultCache.get(key);
    if (!hit) return null;
    const limit = hit.negative ? (negativeTtlMs || 0) : ttlMs;
    if (limit <= 0) {
        resultCache.delete(key);
        return null;
    }
    if (elapsedSince(hit.at) >= limit) {
        resultCache.delete(key);
        return null;
    }
    return hit.body;
}

function runSharedLookup(key, config, headers, barcode, session, startedAt, plan) {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const run = fetchOrder(config, headers, barcode, startedAt, session, plan);
    inFlight.set(key, run);
    run.then(() => {}, () => {}).then(() => {
        if (inFlight.get(key) === run) inFlight.delete(key);
    });
    return run;
}

function configErrorResponse(error) {
    const body = { error: 'ZTO proxy configuration is invalid', code: 'ZTO_CONFIG_INVALID' };
    const reason = error instanceof ZtoConfigError ? error.reason : '';
    if (reason && SAFE_REASON_RE.test(reason)) body.reason = reason;
    return json(503, body);
}

// ⛔ ការត្រៀម (OPTIONS) ឈរ **ក្រៅ** ផ្លូវស្កេន ➜ វាត្រូវ **បញ្ចប់** ការអាន
// ពិត មិនមែនត្រឹមតាំងវាខាងក្រោយ។ នោះជាចំណុចទាំងមូលរបស់ការត្រៀម ៖ បង់ថ្លៃ
// ការអាន Blobs នៅទីនេះ ដើម្បីកុំឲ្យការស្កេនបង់វា។
async function prewarmCookieCredential(netlifyEvent) {
    if (cookieState.value && elapsedSince(cookieState.at) < COOKIE_CACHE_TTL_MS) return;
    try {
        await resolveCookieCredential(netlifyEvent, process.env, { blocking: true });
    } catch (_) {}
}

function diagnosticsBody(config, headers, authKind, credential) {
    const verdictMatches = credential && credential.identity === cookieState.authIdentity;
    return {
        ok: true,
        code: 'ZTO_DIAG',
        auth: authKind || 'none',
        cookie: {
            source: (credential && credential.source) || 'none',
            fingerprint: cookieFingerprint(credential && credential.cookie) || null,
            ageMs: cookieState.at ? elapsedSince(cookieState.at) : null,
            storeReason: cookieState.storeReason || null,
            renewals: cookieState.renewals,
            authRejectedAgeMs: verdictMatches && cookieState.authRejectedAt
                ? elapsedSince(cookieState.authRejectedAt)
                : null,
            authAcceptedAgeMs: verdictMatches && cookieState.authAcceptedAt
                ? elapsedSince(cookieState.authAcceptedAt)
                : null
        },
        endpoint: {
            host: config.endpoint.hostname,
            path: config.endpoint.pathname,
            method: config.method
        },
        requestHeaders: Object.keys(headers).sort(),
        browserHeaders: Object.prototype.hasOwnProperty.call(headers, 'Origin'),
        fields: {
            phone: config.phonePaths.slice(0, 4),
            cod: config.codPaths.slice(0, 4),
            dod: config.dodPaths.slice(0, 4),
            barcode: config.barcodePaths.slice(0, 4),
            signed: config.signed.paths.slice(0, 4),
            signedValues: config.signed.values.length,
            signedReason: config.signed.reason || null
        },
        // ⛔ ស្ថានភាព **បើក/បិទ + មូលហេតុ** ប៉ុណ្ណោះ ៖ លេខសាខាជាការកំណត់
        // របស់អាជីវកម្ម ➜ វាមិនត្រូវលេចក្នុងចម្លើយវិនិច្ឆ័យទេ (ច្បាប់ដដែល
        // នឹង `signedValues` ដែលរាយត្រឹម **ចំនួន**)។ ⛔ `siteFromRequest`
        // ជា **ការពិតអំពីកំណែកូដ** មិនមែនតម្លៃ ៖ វាប្រាប់ថា server លែង
        // កាន់លេខសាខា ➜ `site:missing` លែងលេចក្នុង `?diag=1` ទៀតហើយ។
        list: {
            enabled: config.list.enabled,
            siteFromRequest: true,
            reason: config.list.reason || null,
            host: config.list.url ? config.list.url.hostname : null,
            path: config.list.url ? config.list.url.pathname : null,
            pageSize: config.list.pageSize,
            maxPages: config.list.maxPages,
            scanTypeIsDefault: config.list.scanType === DEFAULT_LIST_SCAN_TYPE,
            scanDescIsDefault: config.list.scanDesc === DEFAULT_LIST_SCAN_DESC,
            scanDescEnforced: !!config.list.scanDesc,
            cacheTtlMs: config.listCacheTtlMs
        },
        timing: {
            upstreamTimeoutMs: config.upstreamTimeoutMs,
            budgetMs: config.budgetMs,
            retries: config.retries,
            cacheTtlMs: config.cacheTtlMs,
            notFoundCacheTtlMs: config.notFoundCacheTtlMs
        },
        cacheEntries: resultCache.size,
        upstreamReject: {
            observed: upstreamRejectSignal.count > 0,
            count: upstreamRejectSignal.count,
            status: upstreamRejectSignal.status || null,
            code: upstreamRejectSignal.code || null,
            ageMs: upstreamRejectSignal.at ? elapsedSince(upstreamRejectSignal.at) : null
        },
        sessionRenewal: {
            observed: upstreamCookieSignal.seenAt > 0,
            setCookie: upstreamCookieSignal.setCookie,
            names: upstreamCookieSignal.names,
            ageMs: upstreamCookieSignal.seenAt ? elapsedSince(upstreamCookieSignal.seenAt) : null
        }
    };
}

exports.handler = async function handler(event) {
    const startedAt = Date.now();
    if (event.httpMethod === 'OPTIONS') {
        await prewarmCookieCredential(event);
        return { statusCode: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' }, body: '' };
    }
    if (event.httpMethod !== 'GET') {
        return json(405, { error: 'Method not allowed' });
    }

    const proxyKey = process.env.ZTO_PROXY_KEY || '';
    const suppliedKey = (event.headers && (event.headers['x-zoe-proxy-key'] || event.headers['X-Zoe-Proxy-Key'])) || '';
    if (!proxyKey) {
        return json(503, { error: 'ZTO proxy is not configured', code: 'ZTO_PROXY_NOT_CONFIGURED' });
    }
    if (!timingSafeEqualText(proxyKey, suppliedKey)) {
        return json(401, { error: 'Invalid proxy key' });
    }

    let config;
    try {
        config = readConfig(process.env);
    } catch (error) {
        return configErrorResponse(error);
    }

    const query = event.queryStringParameters || {};
    const wantsDiagnostics = String(query.diag || '') === '1';
    const wantsFreshCookie = wantsDiagnostics && String(query.fresh || '') === '1';
    const barcode = String(query.barcode || '').trim();

    // ⛔ សាខាបញ្ជីឈរ **មុន** ការត្រួតពិនិត្យ `BARCODE_RE` ៖ សំណើបញ្ជី
    // គ្មាន barcode សោះ ➜ ការដាក់វាក្រោយធ្វើឲ្យវាធ្លាក់ 400 ជានិច្ច។
    const wantsList = !wantsDiagnostics && String(query.list || '') === '1';
    let plan = null;
    if (wantsList) {
        // ⛔ មុខងារបិទ ≠ កំហុស ➜ HTTP 200 **គ្មានវាល `error`** (ច្បាប់ដដែល
        // នឹង `found:false` ៖ វាល `error` បង្ខំ client ចូល cooldown)។
        // ⛔ លេខសាខាមកពី **អត្តសញ្ញាណ** មិនមែនពី `?site=` — មើលការពន្យល់
        // នៅលើ `verifyIdToken()`។ `query.site` ត្រូវបោះចោលទាំងស្រុង។
        const projectIds = readProjectIds(process.env);
        const idToken = (event.headers && (event.headers[ID_TOKEN_HEADER] || event.headers['X-Zoe-Id-Token'])) || '';
        const auth = await verifyIdToken(idToken, projectIds, certsTimeoutMs(config, startedAt));
        const site = auth.ok
            ? listSiteCodeOf(siteCodeFromEmail(auth.email, siteEmailPrefix(process.env)))
            : { code: '', reason: auth.reason };
        if (!auth.ok && site.reason === auth.reason) {
            return json(200, {
                success: false, list: true, enabled: false,
                code: 'ZTO_LIST_NOT_CONFIGURED', reason: auth.reason
            });
        }
        if (auth.ok && site.reason) {
            return json(200, {
                success: false, list: true, enabled: false,
                code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'site:no-account'
            });
        }
        if (!config.list.enabled || site.reason) {
            return json(200, {
                success: false,
                list: true,
                enabled: false,
                code: 'ZTO_LIST_NOT_CONFIGURED',
                reason: config.list.reason || site.reason
            });
        }
        const range = listRange(query.from, query.to);
        if (!range) {
            return json(400, {
                error: 'Invalid list date range',
                code: 'ZTO_LIST_RANGE_INVALID'
            });
        }
        const page = Number(String(query.page || '1').trim());
        if (!Number.isInteger(page) || page < 1 || page > config.list.maxPages) {
            return json(400, { error: 'Invalid list page', code: 'ZTO_LIST_PAGE_INVALID' });
        }
        plan = {
            href: config.list.url.href,
            body: listRequestBody(config.list, site.code, range, page),
            extract: (upstream) => {
                const container = listContainerOf(upstream);
                return container ? listResponseBody(config, container, page, site.code) : null;
            },
            // ⛔ កូនសោបញ្ជីត្រូវ **ផ្សេងតាមរចនាសម្ព័ន្ធ** ពីកូនសោ barcode ៖
            // `BARCODE_RE` មិនអនុញ្ញាត `|` ➜ បច្ច័យ `|L|` មិនអាចប៉ះគ្នាបាន។
            // ⛔ **លេខសាខាឈរក្នុងកូនសោដែរ** ៖ instance តែមួយបម្រើសាខាច្រើន
            // ➜ កូនសោគ្មានសាខា នឹងបម្រើបញ្ជីរបស់សាខាមុនទៅសាខាបន្ទាប់
            // (`LIST_SITE_CODE_RE` មិនអនុញ្ញាត `|` ➜ ប៉ះគ្នាមិនបាន)។
            cacheKey: config.fingerprint + '|L|' + config.list.fingerprint
                + '|' + site.code + '|' + range.from + '|' + range.to + '|' + page,
            cacheTtlMs: config.listCacheTtlMs
        };
    }

    if (!wantsDiagnostics && !plan && !BARCODE_RE.test(barcode)) {
        return json(400, { error: 'Invalid barcode', code: 'ZTO_BARCODE_INVALID' });
    }

    // ⛔ **កូនសោ cache មិនត្រូវផ្ទុក fingerprint នៃ Cookie ទេ។** លទ្ធផលរបស់
    // barcode មួយ ជាទិន្នន័យបញ្ជាទិញ — វា **មិនអាស្រ័យលើ session ណាដែលទៅយក**។
    // ការដាក់ Cookie ចូលកូនសោធ្វើឲ្យ **រាល់ការបន្តអាយុ Cookie បោះ cache
    // ទាំងមូលចោល** ហើយបង្ខំឲ្យអានឡើងវិញពី store មុនឆ្លើយ។ ការប្តូរ config
    // (endpoint · field · method) នៅតែផ្លាស់កូនសោដដែល តាម `config.fingerprint`។
    // ផលដែលវាស់បាន ៖ ការស្កេនដដែលក្នុង TTL ឆ្លើយ **ដោយមិនប៉ះ Netlify Blobs**។
    const cacheKey = plan ? plan.cacheKey : config.fingerprint + '|' + barcode.toUpperCase();
    if (!wantsDiagnostics) {
        const early = plan
            ? readCachedBody(cacheKey, plan.cacheTtlMs, 0)
            : readCachedBody(cacheKey, config.cacheTtlMs, config.notFoundCacheTtlMs);
        if (early) return json(200, Object.assign({}, early, { cached: true }));
    }

    let session;
    let headers;
    let authKind;
    try {
        session = await resolveCookieCredential(event, process.env, {
            fresh: wantsFreshCookie,
            timeoutMs: wantsDiagnostics ? COOKIE_STORE_TIMEOUT_MS : cookieReadTimeoutMs(config, startedAt)
        });
        const built = buildHeaders(config, process.env, session.cookie, !!plan);
        headers = built.headers;
        authKind = built.authKind;
    } catch (error) {
        return configErrorResponse(error);
    }

    if (wantsDiagnostics) {
        return json(200, Object.assign(diagnosticsBody(config, headers, authKind, session), { fresh: wantsFreshCookie }));
    }

    if (!authKind) {
        return json(503, {
            error: 'ZTO authentication is not configured',
            code: 'ZTO_AUTH_NOT_CONFIGURED'
        });
    }

    // ⛔ ការចែក run (single-flight) នៅតែត្រូវ **ដាច់តាម Cookie** — សំណើ ២
    // ដែលកាន់ session ខុសគ្នា មិនត្រូវចែកលទ្ធផលនៃការហៅដែលកំពុងដំណើរការទេ។
    const flightKey = cacheKey + '|' + (cookieFingerprint(session.cookie) || '-');

    let outcome;
    try {
        outcome = await runSharedLookup(flightKey, config, headers, barcode, session, startedAt, plan);
    } catch (_) {
        return json(502, { error: 'Unable to reach ZTO', code: 'ZTO_UNAVAILABLE' });
    }

    if (outcome.kind === 'authRejected') {
        session.renewal = '';
        invalidateCookieCache(session);
        noteCookieRejected(session);
        // ⛔ មូលហេតុទី ១ នៃ 401 គឺ **cache សតិ ៦០ វិ. របស់ instance នេះ**
        // ដែលនៅកាន់ Cookie ចាស់ ខណៈ helper ទើបសរសេរ Cookie ថ្មីចូល Blobs។
        // ដូច្នេះអានឡើងវិញដោយ `fresh` ១ ដង ហើយសាកម្តងទៀត **តែពេល
        // fingerprint ប្រែ** — បើមិនប្រែ ➜ ឆ្លើយការបដិសេធ 401
        // ភ្លាមដោយគ្មានការហៅ upstream ឥតប្រយោជន៍។
        const retried = await retryAfterAuthRejected(event, config, barcode, startedAt, session.cookie, plan);
        if (!retried) {
            return json(401, { error: 'ZTO authentication rejected', code: 'ZTO_AUTH_EXPIRED' });
        }
        session = retried.session;
        outcome = retried.outcome;
        if (outcome.kind === 'authRejected') {
            session.renewal = '';
            invalidateCookieCache(session);
            noteCookieRejected(session);
            return json(401, { error: 'ZTO authentication rejected', code: 'ZTO_AUTH_EXPIRED' });
        }
    }

    if (outcome.kind === 'ok' || outcome.kind === 'notFound') noteCookieAccepted(session);

    await flushCookieRenewal(session, cookieRenewTimeoutMs(config, startedAt));

    if (outcome.kind === 'ok') {
        const ttlMs = plan ? plan.cacheTtlMs : config.cacheTtlMs;
        if (ttlMs > 0) storeCachedBody(cacheKey, outcome.body);
        return json(200, Object.assign({}, outcome.body, { cached: false }));
    }
    if (outcome.kind === 'notFound') {
        // ⛔ រូបរាងត្រូវនៅដដែល ៖ `found:false` **គ្មានវាល `error`** — បើដាក់
        // `error` ចូល នោះ client បោះ «Lookup rejected» ➜ cooldown ៣០ វិ.
        // (មេរៀន 2.25.0)។ ការ cache ប៉ះតែ *ចំនួនសំណើ* មិនប៉ះរូបរាងទេ។
        const notFoundBody = { success: false, found: false, barcode, code: 'ZTO_NOT_FOUND' };
        if (config.notFoundCacheTtlMs > 0) storeCachedBody(cacheKey, notFoundBody, true);
        return json(200, Object.assign({}, notFoundBody, { cached: false }));
    }
    return outcome.response;
};

exports.expireCookieCacheForTests = function expireCookieCacheForTests() {
    if (cookieState.at) cookieState.at = 1;
};

exports.resetCachesForTests = function resetCachesForTests() {
    resultCache.clear();
    inFlight.clear();
    certsState.at = 0;
    certsState.keys = null;
    certsState.inFlight = null;
    cookieRefreshInFlight = false;
    cookieWriteInFlight = null;
    cookieState.mustRevalidate = false;
    cookieState.value = '';
    cookieState.source = '';
    cookieState.at = 0;
    cookieState.storeReason = '';
    cookieState.renewAt = 0;
    cookieState.renewals = 0;
    cookieState.authRejectedAt = 0;
    cookieState.authAcceptedAt = 0;
    cookieState.authIdentity = '';
    cookieState.version += 1;
    cookieState.storeCookie = '';
    cookieState.storeEtag = '';
    cookieState.storeMissing = false;
    cookieState.pendingRenewal = null;
    cookieState.obsolete.clear();
    cookieState.renewAttemptValue = '';
    cookieState.renewAttemptEtag = '';
};

// ⛔ ច្រកសម្រាប់អ្នកយាមតែប៉ុណ្ណោះ ៖ បង្អួចអានរបស់ Cookie store ជា **អនុគមន៍
// សុទ្ធ** នៃ (config · elapsed · តើមាន Cookie ក្នុងសតិឬទេ) ➜ អ្នកយាមអាចវាស់
// វា **ដោយកំណត់ជាក់លាក់** ជំនួសការប្រណាំងលើគែម ១ ms ក្នុង handler ពិត។
exports.cookieReadWindowForTests = function cookieReadWindowForTests(config, startedAt, hasMemoryCookie) {
    const saved = cookieState.value;
    cookieState.value = hasMemoryCookie ? 'probe=1' : '';
    try {
        return cookieReadTimeoutMs(config, startedAt);
    } finally {
        cookieState.value = saved;
    }
};

exports.setBlobsModuleForTests = function setBlobsModuleForTests(blobsModule) {
    blobsModuleForTests = blobsModule || null;
};
