import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { parse } from 'acorn';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeSetupLookup, decryptSetupLookup } from '../src/services/setup-lookup';
import { applySetupLinkFromUrl, connectSetupPayload, decodeSetupPayload } from '../src/features/config';
import { appLocalStore } from '../src/core/storage';
import { securityState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { ConfigModal } from '../src/app/components/modals/ConfigModal';
import { byId, mount, step, unmount } from './native/react-harness';
import { deriveLookupSecretKey, decryptLookupSecret } from '../src/services/crypto';

vi.mock('../src/services/firebase-init', () => ({ initFirebase: vi.fn() }));
vi.mock('../src/features/customer-table', async (original) => ({ ...await original() as any, clearCustomerDataTableCache: vi.fn(), prefetchCustomerDataTableRowsIfConfigured: vi.fn() }));
const source = readFileSync(resolve(__dirname, '../../ZoeKeyGen/app.js'), 'utf8');
const ast: any = parse(source, { ecmaVersion: 'latest' });
const funcs = ast.body.filter((n: any) => n.type === 'FunctionDeclaration' && /^(lookupSetup|encryptSetupLookup)/.test(n.id.name));
const seller = runInNewContext(funcs.map((n: any) => source.slice(n.start, n.end)).join('\n') + '\n({ encryptSetupLookup, lookupSetupCode })',
    { crypto: webcrypto, TextEncoder, Uint8Array, Uint32Array, URL, btoa, atob });
const metadata = { url: 'https://api.example.com/search?barcode={barcode}', enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key', phoneField: 'phone', codField: 'cod', dodField: 'dod' };
function producerHarness() {
    const elements: any = {};
    const writes: any[] = [];
    const element = (id: string) => elements[id] ||= { value: '', checked: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {} } };
    const ctx: any = { crypto: webcrypto, TextEncoder, Uint8Array, Uint32Array, URL, btoa, atob,
        auth: { currentUser: { uid: 'seller' } }, authGeneration: 1, sensitiveSessionGeneration: 1, isSignedInUiActive: true,
        lookupSetupGeneration: 0, lastGeneratedSetupLink: '', SETUP_LINK_URL_KEY: 'base', appLocalStore: {},
        document: { getElementById: element }, safeStoreSet: (_store: any, key: string, value: string) => writes.push([key, value]),
        sbTenantCache: [], sbAdminSession: null, sbTenantReadFailed: false,
        sbAdminIsCurrent: (session: any) => !!session && session === ctx.sbAdminSession,
        getServerNow: () => Date.now(), switchKgTab: vi.fn(), showToast: vi.fn(),
        renderQrInto: (_el: any, link: string) => { element('setupLinkQrContainer').textContent = link; }, alert: vi.fn() };
    const names = ['captureSensitiveSession', 'isSensitiveSessionCurrent', 'invalidateSensitiveSession', 'setupLinkDsnIsValid', 'generateLookupSetupLink', 'prepareSbLookupSetup', 'renderSbLookupTargets', 'sbTenantState', 'escapeHtml', 'sbAdminConfigProblem', 'sbAdminJwtRole'];
    const declared = ast.body.filter((n: any) => n.type === 'FunctionDeclaration' && (names.includes(n.id.name) || /^(lookupSetup|encryptSetupLookup)/.test(n.id.name)));
    runInNewContext(declared.map((n: any) => source.slice(n.start, n.end)).join('\n'), ctx);
    element('setupLinkUrlInput').value = 'https://zoew.example/';
    element('setupLookupUrlInput').value = metadata.url;
    element('setupLookupHeaderInput').value = metadata.headerName;
    element('setupLookupSecretInput').value = 'seller-private-header';
    element('setupLookupEnabledCheckbox').checked = true;
    return { ctx, element, writes };
}

const zoewSetupSource = readFileSync(resolve(__dirname, '../src/services/setup-lookup.ts'), 'utf8');
function secretWordLists(text: string) {
    const start = text.indexOf('function lookupSetupSecretName(');
    const end = text.indexOf('\n}\n', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const patterns: string[] = [];
    (function walk(node: any) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'Literal' && node.regex) patterns.push(node.regex.pattern);
        for (const key of Object.keys(node)) walk(node[key]);
    })(parse(text.slice(start, end + 2), { ecmaVersion: 'latest' }));
    const lists = patterns.filter((p) => /^[a-z|^(?:)$]+$/.test(p) && p.includes('|'));
    return {
        long: lists.filter((p) => !p.startsWith('^')).flatMap((p) => p.split('|')),
        short: lists.filter((p) => p.startsWith('^(?:') && p.endsWith(')$')).flatMap((p) => p.slice(4, -2).split('|'))
    };
}
const REQUIRED_LONG_WORDS = ['token', 'secret', 'password', 'passwd', 'passphrase', 'passcode', 'credential', 'signature', 'apikey', 'accesskey', 'privatekey', 'bearer', 'authorization'];
const REQUIRED_SHORT_WORDS = ['key', 'pin', 'pass', 'pwd', 'otp', 'sig', 'auth', 'jwt', 'hmac', 'session', 'cookie'];
const encoded = (payload: any) => btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
const sealed = async () => ({ ...metadata, keyEnc: await seller.encryptSetupLookup(metadata, 'seller-private-header', '123456') });
beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('prompt', vi.fn(() => '123456'));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'key', databaseURL: 'https://shop.firebaseio.com' }));
    securityState.lookupSecretKey = await deriveLookupSecretKey('654321');
    mount(<ConfigModal />);
    uiState.modalDisplay = { configModal: 'flex' };
    viewState.configPendingLink = null;
    firebaseState.authGeneration++;
    firebaseState.isInitializingFirebase = false;
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); vi.restoreAllMocks(); firebaseState.isInitializingFirebase = false; firebaseState.auth = null as any; firebaseState.fb = null as any; appLocalStore.clear(); securityState.lookupSecretKey = null; viewState.configPendingLink = null; });
describe('Setup Lookup ៖ កូដលក់ពិត ➜ កូដទទួលពិត', () => {
    it('អ្នកលក់បង្កើត Link ពិត ៖ កូដបង្ហាញដាច់ដោយឡែក · QR គ្មានកូដ · Header មិន persist', async () => {
        const h = producerHarness();
        await h.ctx.generateLookupSetupLink();
        const url = h.ctx.lastGeneratedSetupLink;
        const code = h.element('setupLookupCodeOutput').textContent.match(/\d{6}/)[0];
        const payload = decodeSetupPayload(new URL(url).searchParams.get('setup'));
        expect(await decryptSetupLookup(payload.lookup, code)).toBe('seller-private-header');
        expect(h.element('setupLookupSecretInput').value).toBe('');
        expect(h.element('setupLinkQrContainer').textContent).toBe(url);
        expect(JSON.stringify(h.writes)).not.toMatch(/seller-private-header|keyEnc/);
        h.ctx.invalidateSensitiveSession();
        expect(h.element('setupLookupCodeOutput').textContent).toBe('');
    });
    it('អ្នកលក់ logout កណ្ដាល crypto ➜ Link/កូដ/QR មិនលេចក្រោយមក', async () => {
        const h = producerHarness();
        const task = h.ctx.generateLookupSetupLink();
        h.ctx.invalidateSensitiveSession();
        h.ctx.isSignedInUiActive = false;
        await task;
        expect(h.ctx.lastGeneratedSetupLink).toBe('');
        expect(h.element('setupLookupCodeOutput').textContent).toBe('');
        expect(h.writes).toEqual([]);
    });
    it('ZTO URL ចាប់ផ្ដើម / ➜ domain របស់ ZoeW គោលដៅ · Header បើកបាន និងរក្សាទុក', async () => {
        const h = producerHarness();
        h.element('setupLinkUrlInput').value = 'https://shop.zoew.example/app/?old=1#tab';
        h.element('setupLookupUrlInput').value = '/.netlify/functions/zto-order-detail?barcode={barcode}';
        h.element('setupLookupFastCheckbox').checked = true;
        await h.ctx.generateLookupSetupLink();
        expect(h.ctx.alert).not.toHaveBeenCalled();
        const payload = decodeSetupPayload(new URL(h.ctx.lastGeneratedSetupLink).searchParams.get('setup'));
        expect(payload.lookup.url).toBe('https://shop.zoew.example/.netlify/functions/zto-order-detail?barcode={barcode}');
        expect(payload.lookup.fastMode).toBe(true);
        const code = h.element('setupLookupCodeOutput').textContent.match(/\d{6}/)[0];
        expect(await decryptSetupLookup(payload.lookup, code)).toBe('seller-private-header');
        vi.mocked(prompt).mockReturnValue(code);
        expect(await connectSetupPayload(payload, 'Setup Link')).toBe(true);
        const config = JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!);
        expect(config.url).toBe(payload.lookup.url);
        expect(config.fastMode).toBe(true);
        expect(await decryptLookupSecret(config.headerValueEnc)).toBe('seller-private-header');
    });
    it('URL HTTPS ពេញ ➜ មិនប្ដូរ domain ទៅ Base URL', async () => {
        const h = producerHarness();
        h.element('setupLookupUrlInput').value = 'https://proxy.example/.netlify/functions/zto-order-detail?barcode={barcode}';
        await h.ctx.generateLookupSetupLink();
        expect(h.ctx.alert).not.toHaveBeenCalled();
        const payload = decodeSetupPayload(new URL(h.ctx.lastGeneratedSetupLink).searchParams.get('setup'));
        expect(payload.lookup.url).toBe(h.element('setupLookupUrlInput').value);
        const code = h.element('setupLookupCodeOutput').textContent.match(/\d{6}/)[0];
        expect(await decryptSetupLookup(payload.lookup, code)).toBe('seller-private-header');
    });
    it('URL ផ្លូវ / ដែលមាន barcode ក្នុង path ➜ placeholder នៅដដែល', async () => {
        const h = producerHarness();
        h.element('setupLookupUrlInput').value = '/api/{barcode}?mode=fast';
        await h.ctx.generateLookupSetupLink();
        expect(h.ctx.alert).not.toHaveBeenCalled();
        const payload = decodeSetupPayload(new URL(h.ctx.lastGeneratedSetupLink).searchParams.get('setup'));
        expect(payload.lookup.url).toBe('https://zoew.example/api/{barcode}?mode=fast');
        const code = h.element('setupLookupCodeOutput').textContent.match(/\d{6}/)[0];
        expect(await decryptSetupLookup(payload.lookup, code)).toBe('seller-private-header');
    });
    it('ផ្លូវ / មិនបើកច្រក URL HTTP · protocol-relative · userinfo · គ្មាន barcode', async () => {
        for (const url of ['http://proxy.example/?barcode={barcode}', '//proxy.example/?barcode={barcode}', 'https://secret@proxy.example/?barcode={barcode}', '/.netlify/functions/zto-order-detail']) {
            const h = producerHarness();
            h.element('setupLookupUrlInput').value = url;
            await h.ctx.generateLookupSetupLink();
            expect(h.ctx.alert).toHaveBeenCalledOnce();
            expect(h.ctx.lastGeneratedSetupLink).toBe('');
            expect(h.element('setupLookupCodeOutput').textContent).toBe('');
            expect(h.writes).toEqual([]);
        }
    });
    it('Apps Script ៖ key ក្នុង URL ចូលផ្នែកសម្ងាត់ (កូដ ៦ ខ្ទង់) — Link/QR គ្មាន key · ឧបករណ៍ទទួលបាន URL ដែលមាន key', async () => {
        const h = producerHarness();
        h.element('setupLookupUrlInput').value = 'https://script.google.com/macros/s/AKfyX/exec?code={barcode}&key=SHEET%2BKEY-9&mode=1';
        h.element('setupLookupHeaderInput').value = '';
        h.element('setupLookupSecretInput').value = '';
        await h.ctx.generateLookupSetupLink();
        expect(h.ctx.alert).not.toHaveBeenCalled();
        const link = h.ctx.lastGeneratedSetupLink;
        const payload = decodeSetupPayload(new URL(link).searchParams.get('setup'));
        expect(JSON.stringify(payload) + link + h.element('setupLinkQrContainer').textContent).not.toMatch(/SHEET|KEY-9/);
        expect(payload.lookup.url).toBe('https://script.google.com/macros/s/AKfyX/exec?code={barcode}&mode=1');
        expect(payload.lookup.secretParam).toBe('key');
        const code = h.element('setupLookupCodeOutput').textContent.match(/\d{6}/)[0];
        expect(await decryptSetupLookup(payload.lookup, code)).toBe('SHEET+KEY-9');
        await expect(decryptSetupLookup({ ...payload.lookup, secretParam: undefined }, code)).rejects.toThrow();
        const { secretParam: _secretParam, ...older } = payload.lookup;
        await expect(decryptSetupLookup(older, code)).rejects.toThrow();
        vi.mocked(prompt).mockReturnValue(code);
        expect(await connectSetupPayload(payload, 'Setup Link')).toBe(true);
        const config = JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!);
        expect(config.url).toBe('https://script.google.com/macros/s/AKfyX/exec?code={barcode}&mode=1&key=SHEET%2BKEY-9');
        expect(config.headerValueEnc).toBeNull();
        expect(config.secretParam).toBeUndefined();
        expect(JSON.stringify(config)).not.toMatch(/keyEnc/);
    });
    it('⛔ URL ដែលមាន key/token/secret ក្នុង query ➜ អ្នកលក់ និងអ្នកទទួលបដិសេធ (គ្មាន Link ដែលដឹក secret ធម្មតា)', async () => {
        for (const url of ['https://api.example/?barcode={barcode}&token=t', 'https://api.example/?barcode={barcode}&api_key=t', 'https://script.google.com/macros/s/X/exec?code={barcode}&key=k&key=j&Key=z']) {
            const h = producerHarness();
            h.element('setupLookupUrlInput').value = url;
            await h.ctx.generateLookupSetupLink();
            expect(h.ctx.alert).toHaveBeenCalledOnce();
            expect(h.ctx.lastGeneratedSetupLink).toBe('');
        }
        const h = producerHarness();
        h.element('setupLookupUrlInput').value = 'https://api.example/?barcode={barcode}&key=k';
        await h.ctx.generateLookupSetupLink();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
        const lookup = await sealed();
        for (const url of ['https://script.google.com/macros/s/X/exec?code={barcode}&key=leak', 'https://api.example/?barcode={barcode}&secret=s'])
            expect(() => normalizeSetupLookup({ ...lookup, url })).toThrow();
        expect(() => normalizeSetupLookup({ ...lookup, secretParam: 'key' })).toThrow();
    });
    it('⛔ ឈ្មោះ query ដែលមានពាក្យសម្ងាត់ជាផ្នែក (auth_token · apiToken · client_secret · sig …) ➜ អ្នកលក់ និងអ្នកទទួលបដិសេធ · ឈ្មោះធម្មតានៅប្រើបាន', async () => {
        const names = ['auth_token', 'api_token', 'apiToken', 'client_secret', 'access_key', 'secret_key', 'sig', 'pwd', 'pass', 'X-Api-Key', 'authorization', 'session', 'signature', 'jwt', 'id_token', 'accessToken', 'APIKEY',
            'authtoken', 'clientsecret', 'apisecret', 'secretkey', 'refreshtoken', 'idtoken', 'privatekey', 'xapikey', 'AUTHTOKEN', 'ClientSecret', 'XApiKey', 'mypassword', 'otp', 'pin', 'authCode', 'session_id', 'cookie', 'bearer'];
        const lookup = await sealed();
        for (const name of names) {
            const url = 'https://api.example/lookup?barcode={barcode}&' + name + '=TOPSECRET42';
            const h = producerHarness();
            h.element('setupLookupUrlInput').value = url;
            await h.ctx.generateLookupSetupLink();
            expect(h.ctx.alert, name).toHaveBeenCalledOnce();
            expect(h.ctx.lastGeneratedSetupLink, name).toBe('');
            expect(h.element('setupLinkQrContainer').textContent, name).not.toMatch(/TOPSECRET42/);
            expect(() => normalizeSetupLookup({ ...lookup, url }), name).toThrow();
        }
        for (const name of ['barcode', 'mode', 'code', 'phone', 'keyword', 'lang', 'format', 'page', 'monkey', 'passenger', 'sheet', 'sort', 'id', 'keys', 'signal', 'pinned']) {
            const url = 'https://api.example/lookup?barcode={barcode}&' + name + '=1';
            const h = producerHarness();
            h.element('setupLookupUrlInput').value = url;
            await h.ctx.generateLookupSetupLink();
            expect(h.ctx.alert, name).not.toHaveBeenCalled();
            expect(decodeSetupPayload(new URL(h.ctx.lastGeneratedSetupLink).searchParams.get('setup')).lookup.url, name).toBe(url);
            expect(normalizeSetupLookup({ ...lookup, url }).url, name).toBe(url);
        }
    });
    it('⛔ ពាក្យសម្ងាត់ទាំងអស់ដែលដកពីកូដពិតរបស់ App ទាំងពីរ ៖ ពាក្យវែងនៅកណ្ដាលឈ្មោះ និងអក្សរធំ · ពាក្យខ្លីជាផ្នែកដាច់ ➜ អ្នកលក់ និងអ្នកទទួលបដិសេធ', async () => {
        const kg = secretWordLists(source);
        const zw = secretWordLists(zoewSetupSource);
        const long = [...new Set([...kg.long, ...zw.long])];
        const short = [...new Set([...kg.short, ...zw.short])];
        const lookup = await sealed();
        const refused = async (name: string, why: string) => {
            const url = 'https://api.example/lookup?barcode={barcode}&' + encodeURIComponent(name) + '=TOPSECRET42';
            expect(() => normalizeSetupLookup({ ...lookup, url }), 'ZoeW ' + why).toThrow();
            const h = producerHarness();
            h.element('setupLookupUrlInput').value = url;
            await h.ctx.generateLookupSetupLink();
            expect(h.ctx.alert, 'ZoeKeyGen ' + why).toHaveBeenCalledOnce();
            expect(h.ctx.lastGeneratedSetupLink, 'ZoeKeyGen ' + why).toBe('');
            expect(h.writes, 'ZoeKeyGen ' + why).toEqual([]);
        };
        for (const word of long) {
            await refused('x' + word + 'y', 'ពាក្យវែង ' + word + ' នៅកណ្ដាលឈ្មោះ');
            await refused(word.toUpperCase(), 'ពាក្យវែង ' + word + ' អក្សរធំ');
        }
        for (const word of short) await refused('a_' + word, 'ពាក្យខ្លី ' + word + ' ជាផ្នែកដាច់');
        expect(zw, 'App ទាំងពីរពិនិត្យពាក្យដូចគ្នា').toEqual(kg);
        expect(long.length).toBeGreaterThanOrEqual(REQUIRED_LONG_WORDS.length);
        expect(short.length).toBeGreaterThanOrEqual(REQUIRED_SHORT_WORDS.length);
        expect(long).toEqual(expect.arrayContaining(REQUIRED_LONG_WORDS));
        expect(short).toEqual(expect.arrayContaining(REQUIRED_SHORT_WORDS));
        for (const name of ['barcode', 'mode', 'code', 'phone', 'keyword', 'lang', 'format', 'page', 'monkey', 'passenger', 'sheet', 'sort', 'id', 'keys', 'signal', 'pinned', 'a_keyword', 'sessions', 'authors']) {
            const url = 'https://api.example/lookup?barcode={barcode}&' + name + '=1';
            expect(normalizeSetupLookup({ ...lookup, url }).url, 'ZoeW ' + name).toBe(url);
            const h = producerHarness();
            h.element('setupLookupUrlInput').value = url;
            await h.ctx.generateLookupSetupLink();
            expect(h.ctx.alert, 'ZoeKeyGen ' + name).not.toHaveBeenCalled();
            expect(decodeSetupPayload(new URL(h.ctx.lastGeneratedSetupLink).searchParams.get('setup')).lookup.url, 'ZoeKeyGen ' + name).toBe(url);
        }
    });
    it('⛔ key របស់ Apps Script ៖ ដកចេញពីវាល URL តែក្រោយបង្កើតជោគជ័យ · បរាជ័យ ➜ កែ ➜ បង្កើតម្តងទៀតនៅដឹក key · ចាក់សោ ➜ បង្កើតត្រូវបដិសេធ', async () => {
        const keyed = 'https://script.google.com/macros/s/AKfyX/exec?code={barcode}&key=SHEETKEY99&mode=1';
        const keyless = 'https://script.google.com/macros/s/AKfyX/exec?code={barcode}&mode=1';
        const appsScript = (h: any, url: string) => {
            h.element('setupLookupUrlInput').value = url;
            h.element('setupLookupHeaderInput').value = '';
            h.element('setupLookupSecretInput').value = '';
        };
        const sealedKeyOf = async (h: any) => {
            const payload = decodeSetupPayload(new URL(h.ctx.lastGeneratedSetupLink).searchParams.get('setup'));
            expect(payload.lookup.secretParam).toBe('key');
            expect(payload.lookup.url).toBe(keyless);
            return decryptSetupLookup(payload.lookup, h.element('setupLookupCodeOutput').textContent.match(/\d{6}/)[0]);
        };
        const ok = producerHarness();
        appsScript(ok, keyed);
        await ok.ctx.generateLookupSetupLink();
        expect(ok.ctx.alert).not.toHaveBeenCalled();
        expect(await sealedKeyOf(ok)).toBe('SHEETKEY99');
        expect(ok.element('setupLookupUrlInput').value).toBe(keyless);
        const failed = producerHarness();
        failed.element('setupLinkUrlInput').value = 'http://not-https.example/';
        appsScript(failed, keyed);
        await failed.ctx.generateLookupSetupLink();
        expect(failed.ctx.alert).toHaveBeenCalledOnce();
        expect(failed.ctx.lastGeneratedSetupLink).toBe('');
        expect(failed.element('setupLookupUrlInput').value).toBe(keyed);
        failed.element('setupLinkUrlInput').value = 'https://zoew.example/';
        await failed.ctx.generateLookupSetupLink();
        expect(failed.ctx.alert).toHaveBeenCalledOnce();
        expect(await sealedKeyOf(failed)).toBe('SHEETKEY99');
        expect(failed.element('setupLookupUrlInput').value).toBe(keyless);
        const locked = producerHarness();
        appsScript(locked, keyed + '&auth_token=TOK1&lang=km#frag');
        locked.ctx.invalidateSensitiveSession();
        expect(locked.element('setupLookupUrlInput').value).toBe(keyless + '&lang=km#frag');
        await locked.ctx.generateLookupSetupLink();
        expect(locked.ctx.alert).toHaveBeenCalledOnce();
        expect(locked.ctx.alert.mock.calls[0][0]).toMatch(/&key=/);
        expect(locked.ctx.lastGeneratedSetupLink).toBe('');
        expect(locked.element('setupLookupCodeOutput').textContent).toBe('');
        locked.element('setupLookupUrlInput').value = '/.netlify/functions/zto-order-detail?barcode={barcode}';
        locked.ctx.invalidateSensitiveSession();
        expect(locked.element('setupLookupUrlInput').value).toBe('/.netlify/functions/zto-order-detail?barcode={barcode}');
        const logout = source.slice(source.indexOf('function showLoginModalWithPrefill()'));
        expect(logout.slice(0, logout.indexOf('\n}\n'))).toMatch(/^function showLoginModalWithPrefill\(\) \{\n    invalidateSensitiveSession\(\);/);
    });
    it('⛔ វាល URL ដែលអ្នកលក់កែកំឡុងពេលបង្កើត Link នៅដដែល · វាលមិនបានកែ ➜ key ត្រូវដកចេញក្រោយបង្កើតជោគជ័យ', async () => {
        const keyed = 'https://script.google.com/macros/s/AKfyX/exec?code={barcode}&key=SHEETKEY99&mode=1';
        const keyless = 'https://script.google.com/macros/s/AKfyX/exec?code={barcode}&mode=1';
        const typedMeanwhile = 'https://script.google.com/macros/s/OTHER/exec?code={barcode}&key=NEWKEY77';
        const run = async (edit: string | null) => {
            const h = producerHarness();
            h.element('setupLookupUrlInput').value = keyed;
            h.element('setupLookupHeaderInput').value = '';
            h.element('setupLookupSecretInput').value = '';
            const task = h.ctx.generateLookupSetupLink();
            expect(h.ctx.lastGeneratedSetupLink).toBe('');
            if (edit !== null) h.element('setupLookupUrlInput').value = edit;
            await task;
            expect(h.ctx.alert).not.toHaveBeenCalled();
            const payload = decodeSetupPayload(new URL(h.ctx.lastGeneratedSetupLink).searchParams.get('setup'));
            expect(payload.lookup.url).toBe(keyless);
            expect(await decryptSetupLookup(payload.lookup, h.element('setupLookupCodeOutput').textContent.match(/\d{6}/)[0])).toBe('SHEETKEY99');
            return h.element('setupLookupUrlInput').value;
        };
        expect(await run(typedMeanwhile), 'អ្វីដែលអ្នកលក់វាយកំឡុង encrypt មិនត្រូវសរសេរពីលើ').toBe(typedMeanwhile);
        expect(await run(null), 'វាលមិនបានកែ ➜ key ដកចេញ').toBe(keyless);
        expect(await run('  ' + keyed + '  '), 'ដកដកឃ្លាខាងចុងដូចគ្នា ➜ key ដកចេញ').toBe(keyless);
    });
    it('⛔ URL Apps Script គ្មាន key ➜ បដិសេធ ទោះមានឈ្មោះ ឬកូនសោ Header (ZoeW មិនផ្ញើ Header ទៅ Apps Script) · សារ &key= មុនសារ Header · API ផ្សេងគ្មានកូនសោ នៅបង្កើតបាន', async () => {
        for (const url of ['https://script.google.com/macros/s/AKfyX/exec?code={barcode}', 'https://script.googleusercontent.com/macros/echo?code={barcode}&lib=X', 'https://SCRIPT.GOOGLE.COM/macros/s/AKfyX/exec?code={barcode}']) {
            for (const headerName of ['', 'X-Sheet-Key']) {
                for (const secret of ['', 'SHEETKEY99']) {
                    const why = url + ' header=' + headerName + ' secret=' + secret;
                    const h = producerHarness();
                    h.element('setupLookupUrlInput').value = url;
                    h.element('setupLookupHeaderInput').value = headerName;
                    h.element('setupLookupSecretInput').value = secret;
                    await h.ctx.generateLookupSetupLink();
                    expect(h.ctx.alert, why).toHaveBeenCalledOnce();
                    expect(h.ctx.alert.mock.calls[0][0], why).toMatch(/&key=/);
                    expect(h.ctx.alert.mock.calls[0][0], why).not.toMatch(/ប្រើ Header ជំនួស/);
                    expect(h.ctx.lastGeneratedSetupLink, why).toBe('');
                    expect(h.element('setupLookupCodeOutput').textContent, why).toBe('');
                    expect(h.element('setupLinkQrContainer').textContent, why).toBe('');
                    expect(h.element('setupLookupSecretInput').value, why).toBe('');
                    expect(h.writes, why).toEqual([]);
                }
            }
        }
        const { lookupApiSendsHeader } = await import('../src/features/lookup-api');
        for (const url of ['https://script.google.com/macros/s/AKfyX/exec?code={barcode}', 'https://script.googleusercontent.com/macros/echo?code={barcode}&lib=X', 'https://SCRIPT.GOOGLE.COM/macros/s/AKfyX/exec?code={barcode}'])
            expect(lookupApiSendsHeader({ ...metadata, url, headerName: 'X-Sheet-Key' }), 'ZoeW មិនផ្ញើ Header ទៅ ' + url).toBe(false);
        expect(lookupApiSendsHeader({ ...metadata, headerName: 'X-Sheet-Key' }), 'ទិសផ្ទុយ ៖ API ផ្សេងផ្ញើ Header').toBe(true);
        const plain = producerHarness();
        plain.element('setupLookupUrlInput').value = 'https://api.example/lookup?barcode={barcode}';
        plain.element('setupLookupHeaderInput').value = '';
        plain.element('setupLookupSecretInput').value = '';
        await plain.ctx.generateLookupSetupLink();
        expect(plain.ctx.alert).not.toHaveBeenCalled();
        expect(plain.ctx.lastGeneratedSetupLink).not.toBe('');
        const bad = producerHarness();
        bad.element('setupLookupUrlInput').value = 'https://api.example/lookup?barcode={barcode}&apisecret=1';
        await bad.ctx.generateLookupSetupLink();
        expect(bad.ctx.alert.mock.calls[0][0]).not.toMatch(/&key=/);
    });
    it('⛔ URL Apps Script ដែលមាន &key= ហើយមានឈ្មោះ ឬកូនសោ Header ➜ សារជាក់លាក់ «ទុក Header ទទេ» (មិនមែន «ប្រើ Header ជំនួស») · គ្មាន Link · ទុក Header ទទេ ➜ បង្កើតបាន', async () => {
        const forms = ['https://script.google.com/macros/s/AKfyX/exec?code={barcode}&key=SHEETKEY99', 'https://script.googleusercontent.com/macros/echo?code={barcode}&lib=X&key=SHEETKEY99', 'https://SCRIPT.GOOGLE.COM/macros/s/AKfyX/exec?code={barcode}&key=SHEETKEY99'];
        const typed = [{ headerName: 'X-Sheet-Key', secret: '' }, { headerName: '', secret: 'OTHERSECRET7' }, { headerName: 'X-Sheet-Key', secret: 'OTHERSECRET7' }];
        for (const url of forms) {
            for (const { headerName, secret } of typed) {
                const why = url + ' header=' + headerName + ' secret=' + secret;
                const h = producerHarness();
                h.element('setupLookupUrlInput').value = url;
                h.element('setupLookupHeaderInput').value = headerName;
                h.element('setupLookupSecretInput').value = secret;
                await h.ctx.generateLookupSetupLink();
                expect(h.ctx.alert, why).toHaveBeenCalledOnce();
                const text = h.ctx.alert.mock.calls[0][0];
                expect(text, why).toMatch(/Apps Script/);
                expect(text, why).toMatch(/ឈ្មោះ Header និងកូនសោ Header សម្ងាត់ឲ្យទទេ/);
                expect(text, why).toMatch(/កូដ ៦ ខ្ទង់/);
                expect(text, why).not.toMatch(/ប្រើ Header ជំនួស/);
                expect(text, why).not.toMatch(/គ្មាន key/);
                expect(h.ctx.lastGeneratedSetupLink, why).toBe('');
                expect(h.element('setupLookupCodeOutput').textContent, why).toBe('');
                expect(h.element('setupLinkQrContainer').textContent, why).toBe('');
                expect(h.element('setupLookupSecretInput').value, why).toBe('');
                expect(h.element('setupLookupUrlInput').value, why + ' ៖ បរាជ័យទុក key ក្នុងវាល').toBe(url);
                expect(h.writes, why).toEqual([]);
                h.element('setupLookupHeaderInput').value = '';
                await h.ctx.generateLookupSetupLink();
                expect(h.ctx.alert, why + ' ៖ ទុក Header ទទេ ➜ បង្កើតបាន').toHaveBeenCalledOnce();
                const payload = decodeSetupPayload(new URL(h.ctx.lastGeneratedSetupLink).searchParams.get('setup'));
                expect(payload.lookup.secretParam, why).toBe('key');
                expect(payload.lookup.headerName, why).toBe('');
                expect(JSON.stringify(payload) + h.ctx.lastGeneratedSetupLink, why).not.toMatch(/SHEETKEY99|OTHERSECRET7/);
                expect(await decryptSetupLookup(payload.lookup, h.element('setupLookupCodeOutput').textContent.match(/\d{6}/)[0]), why).toBe('SHEETKEY99');
            }
        }
        for (const { headerName, secret } of typed) {
            const h = producerHarness();
            h.element('setupLookupUrlInput').value = 'https://api.example/lookup?barcode={barcode}&key=SHEETKEY99';
            h.element('setupLookupHeaderInput').value = headerName;
            h.element('setupLookupSecretInput').value = secret;
            await h.ctx.generateLookupSetupLink();
            expect(h.ctx.alert).toHaveBeenCalledOnce();
            expect(h.ctx.alert.mock.calls[0][0], 'ទិសផ្ទុយ ៖ API ផ្សេងដែលមាន key ក្នុង URL ➜ សារទូទៅ').toMatch(/ប្រើ Header ជំនួស/);
            expect(h.ctx.lastGeneratedSetupLink).toBe('');
        }
    });
    it('សារបដិសេធ ZoeKeyGen និង README រាយពាក្យដូចការពិនិត្យពិត (lookupSetupSecretName)', () => {
        const kg = secretWordLists(source);
        const zw = secretWordLists(zoewSetupSource);
        const words = [...new Set([...kg.long, ...kg.short, ...zw.long, ...zw.short])];
        expect(words).toEqual(expect.arrayContaining([...REQUIRED_LONG_WORDS, ...REQUIRED_SHORT_WORDS]));
        const generate: any = ast.body.find((n: any) => n.type === 'FunctionDeclaration' && n.id.name === 'generateLookupSetupLink');
        const alerts: string[] = [];
        (function walk(node: any) {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'Literal' && typeof node.value === 'string' && node.value.includes('ប្រើ Header ជំនួស')) alerts.push(node.value);
            for (const key of Object.keys(node)) walk(node[key]);
        })(generate);
        expect(alerts).toHaveLength(1);
        const readme = readFileSync(resolve(__dirname, '../../ZoeKeyGen/README.md'), 'utf8');
        for (const word of words) {
            expect(alerts[0], word).toMatch(new RegExp('(^|[^a-z])' + word + '([^a-z]|$)'));
            expect(readme, word).toContain('`' + word + '`');
        }
    });
    it('កូដ ៦ ខ្ទង់មានសូន្យខាងមុខ និងមិនប្រើ Math.random', () => {
        for (let i = 0; i < 30; i++) expect(seller.lookupSetupCode()).toMatch(/^\d{6}$/);
        const fn: any = funcs.find((n: any) => n.id.name === 'lookupSetupCode');
        const draws = [4294000000, 7];
        let attempts = 0;
        const rng: any = { getRandomValues(a: Uint32Array) { a[0] = draws[attempts++] ?? 4294967295; return a; } };
        const code = runInNewContext(source.slice(fn.start, fn.end) + '\nlookupSetupCode', { crypto: rng, Uint32Array });
        expect(code()).toBe('000007');
        expect(attempts).toBe(2);
        attempts = 0;
        draws.length = 0;
        expect(() => code()).toThrow();
        expect(attempts).toBe(16);
    });
    it('Header UTF-8 ៖ ព្រំដែនអ្នកលក់ និងអ្នកទទួលជាបៃដូចគ្នា', async () => {
        const secret = 'ក'.repeat(1365);
        const keyEnc = await seller.encryptSetupLookup(metadata, secret, '123456');
        expect(await decryptSetupLookup({ ...metadata, keyEnc }, '123456')).toBe(secret);
        await expect(seller.encryptSetupLookup(metadata, 'ក'.repeat(1366), '123456')).rejects.toThrow();
    });
    it('Header មិននៅក្នុង link · កូដត្រូវបើកបាន', async () => {
        const lookup = await sealed();
        expect(JSON.stringify(lookup)).not.toContain('seller-private-header');
        expect(await decryptSetupLookup(lookup, '123456')).toBe('seller-private-header');
        expect(lookup.keyEnc.iter).toBe(300000);
    });
    it('កូដខុស · URL ប្តូរ · ciphertext ប្តូរ ➜ បើកមិនបាន', async () => {
        const lookup = await sealed();
        await expect(decryptSetupLookup(lookup, '123457')).rejects.toThrow();
        await expect(decryptSetupLookup({ ...lookup, url: 'https://evil.example/?barcode={barcode}' }, '123456')).rejects.toThrow();
        await expect(decryptSetupLookup({ ...lookup, keyEnc: { ...lookup.keyEnc, ct: btoa('bad') } }, '123456')).rejects.toThrow();
    });
    it('lookup-only · Firebase+lookup · Supabase+lookup ទទួលបាន', async () => {
        const lookup = await sealed();
        for (const backend of [{}, { apiKey: 'k', databaseURL: 'https://s.firebaseio.com' }, { supabaseUrl: 'https://a.supabase.co', supabaseKey: 'sb_publishable_x' }])
            expect(decodeSetupPayload(encoded({ ...backend, lookup })).lookup).toEqual(lookup);
    });
    it('ទប់ URL HTTP · userinfo · គ្មាន barcode · ថវិកា PBKDF ខុស · plaintext', async () => {
        const lookup = await sealed();
        for (const url of ['http://api.example/?barcode={barcode}', 'https://key@api.example/?barcode={barcode}', 'https://api.example/'])
            expect(() => normalizeSetupLookup({ ...lookup, url })).toThrow();
        expect(() => normalizeSetupLookup({ ...lookup, keyEnc: { ...lookup.keyEnc, iter: 999999999 } })).toThrow();
        expect(() => normalizeSetupLookup({ ...lookup, headerValue: 'plaintext' })).toThrow();
    });
    it('null · array · NaN · undefined បរាជ័យដោយមិនរក្សាទុក', () => {
        for (const x of [null, [], NaN, undefined]) expect(() => normalizeSetupLookup(x)).toThrow();
    });
    it('ចុចភ្ជាប់ ➜ encrypt ក្នុងម៉ាស៊ីន និងចងហាង · គ្មានកូដ/Key ធម្មតាក្នុង storage', async () => {
        const lookup = await sealed();
        expect(appLocalStore.getItem('zoew_lookup_api_config')).toBeNull();
        expect(await connectSetupPayload({ lookup }, 'Setup Link')).toBe(true);
        const config = JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!);
        expect(config.shop).toBe('https://shop.firebaseio.com');
        expect(config.headerValueEnc).toBeTruthy();
        expect(await decryptLookupSecret(config.headerValueEnc)).toBe('seller-private-header');
        expect(JSON.stringify(config)).not.toMatch(/seller-private-header|123456|keyEnc/);
    });
    it('ឧបករណ៍ថ្មី Firebase និង Supabase ➜ backend និង lookup ដាច់គ្នា · គ្មាន ciphertext លក់ក្នុង backend', async () => {
        const lookup = await sealed();
        for (const backend of [{ apiKey: 'k2', databaseURL: 'https://new.firebaseio.com' }, { supabaseUrl: 'https://new.supabase.co', supabaseKey: 'sb_publishable_' + 'k'.repeat(24) }]) {
            uiState.modalDisplay = { configModal: 'flex' };
            expect(await connectSetupPayload({ ...backend, lookup }, 'Setup Link')).toBe(true);
            const saved = JSON.parse(appLocalStore.getItem('zoew_firebase_config')!);
            expect(saved).toEqual(backend);
            const api = JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!);
            expect(api.shop || '').toBe('databaseURL' in backend ? backend.databaseURL : '');
            expect(await decryptLookupSecret(api.headerValueEnc)).toBe('seller-private-header');
        }
    });
    it('URL ៖ PIN gate · host API បង្ហាញ · មិនសួរកូដ ឬរក្សាទុកដោយស្វ័យប្រវត្តិ', async () => {
        const lookup = await sealed();
        const before = window.location.href;
        (window as any).happyDOM.setURL('https://zoew.example/?setup=' + encodeURIComponent(encoded({ lookup })));
        try {
            step(() => applySetupLinkFromUrl());
            expect(window.location.search).toBe('');
            expect(typeof securityState.pinTargetAction).toBe('function');
            step(() => (securityState.pinTargetAction as any)());
            expect(byId('configLinkCard').textContent).toContain('api.example.com');
            expect(prompt).not.toHaveBeenCalled();
            expect(appLocalStore.getItem('zoew_lookup_api_config')).toBeNull();
        } finally { (window as any).happyDOM.setURL(before); securityState.pinTargetAction = null; }
    });
    it('Supabase ប្តូរ Project ៖ មិនចង API ជាមួយ tenant ចាស់ · tenant ថ្មីចងពេលអាន', async () => {
        const lookup = await sealed();
        firebaseState.auth = { app: { options: { supabaseUrl: 'https://old.supabase.co' } }, _account: { tenant_id: 'old' } } as any;
        firebaseState.fb = { tenantScope: (user: any) => user._account.tenant_id } as any;
        expect(await connectSetupPayload({ supabaseUrl: 'https://new.supabase.co', supabaseKey: 'sb_publishable_' + 'k'.repeat(24), lookup }, 'Setup Link')).toBe(true);
        expect(JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!).shop).toBeUndefined();
        firebaseState.auth = { app: { options: { supabaseUrl: 'https://new.supabase.co' } }, _account: { tenant_id: 'new' } } as any;
        const { getLookupApiConfig } = await import('../src/features/lookup-config');
        expect(getLookupApiConfig().shop).toBe('https://new.supabase.co#new');
        firebaseState.auth = null as any;
        firebaseState.fb = null as any;
    });
    it('Supabase Project ដដែលពេល reconfig ៖ tenant ចាស់មិនចង API ដែលរង់ចាំហាងថ្មី', async () => {
        const lookup = await sealed();
        firebaseState.auth = { app: { options: { supabaseUrl: 'https://new.supabase.co' } }, _account: { tenant_id: 'old' } } as any;
        firebaseState.fb = { tenantScope: (user: any) => user._account.tenant_id } as any;
        firebaseState.isInitializingFirebase = true;
        expect(await connectSetupPayload({ supabaseUrl: 'https://new.supabase.co', supabaseKey: 'sb_publishable_' + 'k'.repeat(24), lookup }, 'Setup Link')).toBe(true);
        expect(JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!).shop).toBeUndefined();
        firebaseState.isInitializingFirebase = false;
        firebaseState.auth._account.tenant_id = 'new';
        const { getLookupApiConfig } = await import('../src/features/lookup-config');
        expect(getLookupApiConfig().shop).toBe('https://new.supabase.co#new');
    });
    it('ចុចស្ទួន និងបិទ/បើក modal កណ្ដាល crypto ➜ ការឆ្លើយចាស់មិនសរសេរ', async () => {
        const lookup = await sealed();
        const task = connectSetupPayload({ lookup }, 'Setup Link');
        expect(await connectSetupPayload({ lookup }, 'Setup Link')).toBe(false);
        uiState.modalDisplay = {};
        viewState.configPendingLink = null;
        uiState.modalDisplay = { configModal: 'flex' };
        expect(await task).toBe(false);
        expect(appLocalStore.getItem('zoew_lookup_api_config')).toBeNull();
    });
    it('កូដខុស និងបោះបង់ ➜ backend និង Lookup នៅដដែល', async () => {
        const lookup = await sealed();
        const before = appLocalStore.getItem('zoew_firebase_config');
        for (const code of ['999999', null]) {
            vi.mocked(prompt).mockReturnValue(code);
            expect(await connectSetupPayload({ apiKey: 'k2', databaseURL: 'https://other.firebaseio.com', lookup }, 'Setup Link')).toBe(false);
            expect(appLocalStore.getItem('zoew_firebase_config')).toBe(before);
            expect(appLocalStore.getItem('zoew_lookup_api_config')).toBeNull();
        }
    });
    it('Logout កណ្ដាល crypto ➜ គ្មានការរក្សាទុកយឺត', async () => {
        const lookup = await sealed();
        const pending = connectSetupPayload({ lookup }, 'Setup Link');
        securityState.lookupSecretKey = null;
        viewState.configPendingLink = null;
        firebaseState.authGeneration++;
    firebaseState.isInitializingFirebase = false;
        expect(await pending).toBe(false);
        expect(appLocalStore.getItem('zoew_lookup_api_config')).toBeNull();
    });
    it('គ្មាន PIN និង configModal បិទ ➜ មិនប្រើ Link', async () => {
        const lookup = await sealed();
        securityState.lookupSecretKey = null;
        expect(await connectSetupPayload({ lookup }, 'Setup Link')).toBe(false);
        uiState.modalDisplay = {};
        expect(await connectSetupPayload({ lookup }, 'Setup Link')).toBe(false);
    });
});


describe('Deep audit ៖ Link Lookup ចងហាង Supabase ជាក់លាក់', () => {
    const url = 'https://target.supabase.co';
    const target = url + '#11111111-1111-4111-8111-111111111111';
    const targetMetadata = { ...metadata, shop: target };
    const targeted = async () => ({ ...targetMetadata, keyEnc: await seller.encryptSetupLookup(targetMetadata, 'target-secret', '123456') });

    it('combined Link ➜ កត់ហាងគោលដៅ មុនចូលគណនី · ហាងផ្សេងមិនអាចយកទៅប្រើ', async () => {
        const lookup = await targeted();
        expect(await connectSetupPayload({ supabaseUrl: url, supabaseKey: 'sb_publishable_' + 'k'.repeat(24), lookup }, 'Setup Link')).toBe(true);
        expect(JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!).shop).toBe(target);
        firebaseState.fb = { tenantScope: () => '22222222-2222-4222-8222-222222222222' } as any;
        firebaseState.auth = { app: { options: { supabaseUrl: url } } } as any;
        const { getLookupApiConfig } = await import('../src/features/lookup-config');
        expect(getLookupApiConfig()).toBeNull();
        firebaseState.fb = { tenantScope: () => target.split('#')[1] } as any;
        expect(getLookupApiConfig()?.shop).toBe(target);
    });

    it('កែ target tenant ឬដក target ចេញ ➜ AES-GCM បដិសេធ', async () => {
        const lookup = await targeted();
        await expect(decryptSetupLookup({ ...lookup, shop: url + '#22222222-2222-4222-8222-222222222222' }, '123456')).rejects.toThrow();
        const stripped: any = { ...lookup }; delete stripped.shop;
        await expect(decryptSetupLookup(stripped, '123456')).rejects.toThrow();
    });

    it('target Project មិនដូច backend ➜ គ្មានការរក្សាទុក', async () => {
        expect(await connectSetupPayload({ supabaseUrl: 'https://other.supabase.co', supabaseKey: 'sb_publishable_' + 'k'.repeat(24), lookup: await targeted() }, 'Setup Link')).toBe(false);
        expect(appLocalStore.getItem('zoew_lookup_api_config')).toBeNull();
    });
});


describe('ZoeKeyGen ៖ ជ្រើសហាង Supabase ពិតពីបញ្ជីទៅ Setup Link', () => {
    const tenant = { id: '11111111-1111-4111-8111-111111111111', name: '<ហាង A>', branch_code: '881859', expires_at: '2099-01-01T00:00:00Z', revoked: false };
    function selected() {
        const h = producerHarness();
        const session = { url: 'https://target.supabase.co', key: 'sb_publishable_' + 'k'.repeat(24) };
        h.ctx.sbAdminSession = session;
        h.ctx.sbTenantCache = [tenant];
        h.ctx.prepareSbLookupSetup(session, tenant);
        return { ...h, session };
    }
    it('ប៊ូតុងហាង ➜ Config/Supabase/tenant បំពេញ ➜ Link មាន shop ដែល AES-GCM ការពារ', async () => {
        const h = selected();
        expect(h.element('setupLookupTenantSelect').value).toBe(tenant.id);
        expect(h.element('setupLookupIncludeCheckbox').checked).toBe(true);
        expect(h.element('setupLookupTenantSelect').innerHTML).toContain('&lt;ហាង A&gt;');
        await h.ctx.generateLookupSetupLink();
        expect(h.ctx.alert).not.toHaveBeenCalled();
        const payload = decodeSetupPayload(new URL(h.ctx.lastGeneratedSetupLink).searchParams.get('setup'));
        expect(payload.supabaseUrl).toBe(h.session.url);
        expect(payload.lookup.shop).toBe(h.session.url + '#' + tenant.id);
        const code = h.element('setupLookupCodeOutput').textContent.match(/\d{6}/)[0];
        expect(await decryptSetupLookup(payload.lookup, code)).toBe('seller-private-header');
    });
    it('Supabase Admin ចាកចេញក្នុង encrypt ➜ គ្មាន Link/QR/កូដយឺតលេចក្រោយ', async () => {
        const h = selected();
        const task = h.ctx.generateLookupSetupLink();
        h.ctx.sbAdminSession = null;
        await task;
        expect(h.ctx.lastGeneratedSetupLink).toBe('');
        expect(h.element('setupLookupCodeOutput').textContent).toBe('');
    });
    it('ប្តូរ Config ទៅ Project ផ្សេង ខណៈ tenant នៅជ្រើស ➜ បដិសេធ', async () => {
        const h = selected();
        h.element('setupLinkConfigInput').value = JSON.stringify({ supabaseUrl: 'https://other.supabase.co', supabaseKey: h.session.key });
        await h.ctx.generateLookupSetupLink();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
        expect(h.ctx.lastGeneratedSetupLink).toBe('');
    });
});
