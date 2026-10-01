import { modalIsOpen } from '../core/modals';
import { fieldValue, setFieldValue } from '../app/refs';
import { securityState } from '../core/state';
import { viewState } from '../core/view-state';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { cancelPendingLookupUnlock } from './auto-lookup';
import { applyPinPromptText, requestPinBeforeConfig } from './pin';
import { initFirebase } from '../services/firebase-init';
import { isSupabaseConfig, looksLikeSupabaseConfig, normalizeSupabaseConfig, supabaseConfigErrorMessage } from '../services/supabase-config';
import { rememberSetupInvite } from './account';
import { closeModal, openModalHelper } from '../ui/modal';
import { showLiveToast, showToast } from '../ui/toast';

export function checkPinAndOpenConfig(isFirstTime = false) {
    if (isPinFlowPending()) return;
    securityState.pinTargetAction = null;
    applyPinPromptText('config');
    let savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
    if (!savedPin) {
        openModalHelper('pinSetupModal');
    } else {
        requestPinBeforeConfig(null, 'config');
    }
}

export function savedConfigObject() {
    const savedConfig = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    if (!savedConfig) return null;
    try {
        const parsed = JSON.parse(savedConfig);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        return null;
    }
}

export function fillConfigFields(config) {
    if (isSupabaseConfig(config)) {
        viewState.configBackend = 'supabase';
        setFieldValue('sbUrlInput', String(config.supabaseUrl || ''));
        setFieldValue('sbKeyInput', String(config.supabaseKey || ''));
        setFieldValue('sbDomainInput', typeof config.loginDomain === 'string' ? config.loginDomain : '');
        return;
    }
    viewState.configBackend = 'firebase';
    setFieldValue('firebaseConfigInput', JSON.stringify(config, null, 2));
}

export function openConfigModal() {
    const savedConfig = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    const saved = savedConfigObject();
    if (saved && isSupabaseConfig(saved)) {
        fillConfigFields(saved);
    } else {
        viewState.configBackend = 'firebase';
        if (savedConfig) {
            setFieldValue('firebaseConfigInput', savedConfig);
        }
    }
    setFieldValue('setupLinkInput', '');
    if (window.ZoeErrors) setFieldValue('sentryDsnInput', ZoeErrors.getDsn());
    openModalHelper('configModal');
}

export function selectConfigBackend(kind) {
    viewState.configBackend = kind === 'supabase' ? 'supabase' : 'firebase';
}

export function configInputText() {
    if (viewState.configBackend !== 'supabase') return fieldValue('firebaseConfigInput').trim();
    const config: any = { supabaseUrl: fieldValue('sbUrlInput').trim(), supabaseKey: fieldValue('sbKeyInput').trim() };
    const domain = fieldValue('sbDomainInput').trim();
    if (domain) config.loginDomain = domain;
    return JSON.stringify(config);
}

export const FIREBASE_CONFIG_KEYS = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];

export function stripJsCommentsOutsideStrings(source) {
    let out = '';
    let quote = '';
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        const next = source[i + 1];
        if (quote) {
            out += ch;
            if (ch === '\\') {
                if (next !== undefined) out += next;
                i += 2;
                continue;
            }
            if (ch === quote) quote = '';
            i++;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
            out += ch;
            i++;
            continue;
        }
        if (ch === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n') i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

export function matchingBraceIndex(source, start) {
    const text = typeof source === 'string' ? source : '';
    let from = Math.floor(Number(start));
    if (!Number.isFinite(from) || from < 0) from = 0;
    let depth = 0;
    let quote = '';
    for (let i = from; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === '\\') {
                i++;
                continue;
            }
            if (ch === quote) quote = '';
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
            continue;
        }
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

export function extractFirebaseConfigObject(source) {
    const marker = /firebaseConfig\s*=\s*\{/.exec(source);
    if (marker) {
        const open = source.indexOf('{', marker.index);
        const close = matchingBraceIndex(source, open);
        if (close !== -1) return source.slice(open, close + 1);
    }
    let from = source.indexOf('{');
    while (from !== -1) {
        const close = matchingBraceIndex(source, from);
        if (close !== -1) {
            const text = source.slice(from, close + 1);
            if (text.indexOf('apiKey') !== -1) return text;
        }
        from = source.indexOf('{', from + 1);
    }
    return '';
}

export function firebaseObjectTextToJson(text) {
    let out = '';
    let quote = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === '\\') {
                out += ch + (text[i + 1] === undefined ? '' : text[i + 1]);
                i++;
                continue;
            }
            if (ch === quote) {
                out += '"';
                quote = '';
                continue;
            }
            if (ch === '"') {
                out += '\\"';
                continue;
            }
            out += ch;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            out += '"';
            continue;
        }
        out += ch;
    }
    return out
        .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":')
        .replace(/,(\s*[}\]])/g, '$1');
}

export function normalizeFirebaseConfig(raw) {
    const text = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!text) throw new Error('EMPTY');
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch (strictErr) {
        const objectText = extractFirebaseConfigObject(stripJsCommentsOutsideStrings(text));
        if (!objectText) throw new Error('NO_OBJECT');
        try {
            parsed = JSON.parse(firebaseObjectTextToJson(objectText));
        } catch (looseErr) {
            throw new Error('BAD_SYNTAX');
        }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('NO_OBJECT');
    if (looksLikeSupabaseConfig(parsed)) return normalizeSupabaseConfig(parsed);
    const config: any = {};
    const extras = [];
    Object.keys(parsed).forEach((key) => {
        const value = parsed[key];
        if (FIREBASE_CONFIG_KEYS.indexOf(key) === -1) {
            extras.push(key);
            return;
        }
        if (value === null || value === undefined || value === '') return;
        config[key] = String(value);
    });
    const missing = [];
    if (!config.apiKey) missing.push('apiKey');
    if (!config.databaseURL) missing.push('databaseURL');
    if (missing.length) {
        const err: any = new Error('MISSING');
        err.missing = missing;
        throw err;
    }
    return { config: config, extras: extras };
}

export function firebaseConfigErrorMessage(err) {
    const code = err && err.message ? err.message : '';
    const missing = err && err.missing ? err.missing : [];
    if (code === 'EMPTY') return 'សូមបញ្ចូល Firebase Config!';
    const supabaseText = supabaseConfigErrorMessage(code);
    if (supabaseText) return supabaseText;
    if (code === 'MISSING' && (missing.indexOf('supabaseUrl') !== -1 || missing.indexOf('supabaseKey') !== -1)) return 'Config Supabase ត្រូវមាន supabaseUrl និង supabaseKey (Publishable key)!';
    if (code === 'NO_OBJECT') return 'រកមិនឃើញ Firebase Config ក្នុងអត្ថបទដែលបានបិទភ្ជាប់ទេ។ សូម copy ទាំងស្រុងពី Firebase Console ➜ Project settings ➜ Your apps។';
    if (code === 'BAD_SYNTAX') return 'អានទម្រង់ Config មិនកើតទេ។ សូម copy ពី Firebase Console ម្តងទៀត ដោយកុំកែអ្វីសោះ។';
    if (code === 'MISSING' && missing.indexOf('databaseURL') !== -1) return 'Config នេះគ្មាន databaseURL ទេ។ Firebase មិនដាក់វាក្នុង snippet ទេ បើមិនទាន់បង្កើត Realtime Database — សូមបើក Firebase Console ➜ Realtime Database ➜ Create Database រួច copy Config ម្តងទៀត។';
    if (code === 'MISSING') return 'Config ត្រូវមាន apiKey និង databaseURL!';
    return 'Firebase Config មិនត្រឹមត្រូវទេ!';
}

export function saveFirebaseConfig() {
    const raw = configInputText();
    const dsnEntered = fieldValue('sentryDsnInput').trim();
    if (window.ZoeErrors) {
        ZoeErrors.setDsn(fieldValue('sentryDsnInput'));
        const sentryInit = ZoeErrors.init('zoew');
        if (dsnEntered && sentryInit && typeof sentryInit.then === 'function') {
            const warnSentry = () => showToast("⚠️ មិនអាចភ្ជាប់ Sentry បានទេ! សូមពិនិត្យ DSN ឬការតភ្ជាប់អ៊ីនធឺណិត");
            sentryInit.then((sentryOk) => { if (!sentryOk) warnSentry(); }, warnSentry);
        }
    }
    if (!raw) {
        alert("សូមបញ្ចូល Firebase Config!");
        return;
    }
    let normalized;
    try {
        normalized = normalizeFirebaseConfig(raw);
    } catch (e) {
        alert(firebaseConfigErrorMessage(e));
        return;
    }
    fillConfigFields(normalized.config);
    if (!safeStoreSet(appLocalStore, 'zoew_firebase_config', JSON.stringify(normalized.config))) {
        alert("រក្សាទុក Config មិនបានទេ! សូមពិនិត្យទំហំផ្ទុករបស់ browser។");
        return;
    }
    if (normalized.extras.length) {
        showToast(normalized.config.supabaseUrl
            ? "ℹ️ រំលងវាលដែលមិនមែនរបស់ Supabase៖ " + normalized.extras.join(', ')
            : "ℹ️ រំលងវាលដែលមិនមែនរបស់ Firebase៖ " + normalized.extras.join(', '));
    }
    closeModal('configModal');
    initFirebase();
    showLiveToast('config');
}

export function decodeSetupPayload(setupParam) {
    const json = decodeURIComponent(escape(atob(setupParam)));
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad setup payload');
    if (parsed.supabaseUrl || parsed.supabaseKey) {
        if (!parsed.supabaseUrl || !parsed.supabaseKey) throw new Error('missing supabaseUrl/supabaseKey');
        return parsed;
    }
    if (!parsed.apiKey || !parsed.databaseURL) throw new Error('missing apiKey/databaseURL');
    return parsed;
}

export function setupLinkDsnIsValid(dsn) {
    if (typeof dsn !== 'string' || !dsn) return false;
    let parsed;
    try { parsed = new URL(dsn); } catch (e) { return false; }
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'sentry.io' || host.endsWith('.sentry.io');
}

export function applySetupPayload(parsed) {
    const linkDsn = setupLinkDsnIsValid(parsed.dsn) ? parsed.dsn : '';
    const linkInvite = parsed.supabaseUrl && typeof parsed.invite === 'string' ? parsed.invite : '';
    const linkConfig = Object.assign({}, parsed);
    delete linkConfig.dsn;
    delete linkConfig.invite;
    if (linkDsn && window.ZoeErrors) {
        ZoeErrors.setDsn(linkDsn);
        ZoeErrors.init('zoew');
        setFieldValue('sentryDsnInput', linkDsn);
    }
    rememberSetupInvite(linkInvite);
    fillConfigFields(linkConfig);
    setFieldValue('setupLinkInput', '');
    return linkDsn;
}

export function setupParamFromText(text) {
    const value = String(text === null || text === undefined ? '' : text).trim();
    if (!value) return '';
    try {
        const fromUrl = new URL(value).searchParams.get('setup');
        if (fromUrl) return fromUrl;
    } catch (e) {}
    const bare = value.replace(/^\??setup=/, '');
    if (!/^[A-Za-z0-9+/=_%-]{16,}$/.test(bare)) return '';
    try {
        return decodeURIComponent(bare);
    } catch (e) {
        return '';
    }
}

export function parseSetupLinkText(text) {
    const setupParam = setupParamFromText(text);
    if (!setupParam) return { error: 'not-link' };
    try {
        return { parsed: decodeSetupPayload(setupParam) };
    } catch (e) {
        return { error: 'bad' };
    }
}

export function applySetupLinkText(text) {
    const result: any = parseSetupLinkText(text);
    if (!result.parsed) {
        showToast("❌ Setup Link មិនត្រឹមត្រូវទេ!");
        return false;
    }
    announceSetupApplied(applySetupPayload(result.parsed));
    return true;
}

export function announceSetupApplied(linkDsn) {
    showToast(linkDsn
        ? '✅ Setup Link បានបំពេញ Config និងបើកការរាយការណ៍កំហុស! សូមពិនិត្យ ហើយចុច "រក្សាទុក និងភ្ជាប់"'
        : '✅ Setup Link បានបំពេញ Config ដោយស្វ័យប្រវត្តិ! សូមពិនិត្យ ហើយចុច "រក្សាទុក និងភ្ជាប់"');
}

export function applySetupLinkFromInput() {
    if (!modalIsOpen('configModal')) return;
    applySetupLinkText(fieldValue('setupLinkInput'));
}

export function applySetupLinkFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const setupParam = params.get('setup');
    if (!setupParam) return;

    history.replaceState(null, '', window.location.pathname + window.location.hash);

    let parsed;
    try {
        parsed = decodeSetupPayload(setupParam);
    } catch (e) {
        showToast("❌ Setup Link មិនត្រឹមត្រូវទេ!");
        return;
    }

    requestPinBeforeConfig(() => {
        openConfigModal();
        announceSetupApplied(applySetupPayload(parsed));
    }, 'setupLink');
}

export function cancelPinSetupFlow() {
    cancelPendingLookupUnlock();
    securityState.pinTargetAction = null;
    closeModal('pinSetupModal');
}

export function cancelPinEntryFlow() {
    cancelPendingLookupUnlock();
    securityState.pinTargetAction = null;
    closeModal('pinModal');
}

export function isPinFlowPending() {
    return modalIsOpen('pinModal') || modalIsOpen('pinSetupModal');
}
