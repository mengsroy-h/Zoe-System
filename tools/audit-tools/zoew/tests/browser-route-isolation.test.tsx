import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { parse } from 'acorn';
import { full } from 'acorn-walk';
import { transformSync } from 'esbuild';
import { act as reactAct } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppShell } from '../../../../ZoeW/src/app/components/AppShell';
import { DocumentEffects } from '../../../../ZoeW/src/app/components/shell/DocumentEffects';
import { mount, step, unmount } from './native/react-harness';
import { firebaseState, securityState, sheetImportState, uiState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { resetServerClock, serverClockIsTrustworthy } from '../../../../ZoeW/src/core/clock';
import { sessionUserActionAllowed } from '../../../../ZoeW/src/core/session-verification';
import { attachInfoListeners, detachInfoListeners } from '../../../../ZoeW/src/services/connection';
import { setupAuthListener } from '../../../../ZoeW/src/features/auth';
import { cancelActivationRetry } from '../../../../ZoeW/src/features/license';
import { requestPinBeforeConfig } from '../../../../ZoeW/src/features/pin';
import { openSheetImportModal, clearSheetImportSession, deriveSheetImportKey, encryptSheetImportSecret } from '../../../../ZoeW/src/features/sheet-import';
import { setFieldValue } from '../../../../ZoeW/src/app/refs';
import { hashPin } from '../../../../ZoeW/src/services/crypto';
import { installAuditActionAnnotations } from '../runtime/audit-compat';
import { loadedScriptPromises } from '../../../../ZoeW/src/features/export';

// គំរូដំណើរការ SW និង React ក្នុង happy-dom; មិនអះអាងថាបានបើក browser ពិត។
const ROOT = path.resolve(process.env.BROWSER_ROUTE_ROOT || '..');
const localRequire = createRequire(path.join(ROOT, 'tools/audit-tools/sheet-import-test.js'));
const turn = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const files = ['sheet-import-test.js', 'app-lock-test.js'];
const ORIGIN = 'http://127.0.0.1:9876';
const LICENSE_URL = ORIGIN + '/license-verify.js';
const URL_VALUE = 'https://script.google.com/macros/s/SYNTHETIC/exec';
let now: number;

function checker(file: string) {
    const source = readFileSync(path.join(ROOT, 'tools/audit-tools', file), 'utf8');
    const ast: any = parse(source, { ecmaVersion: 'latest' });
    const declarations = ast.body.flatMap((n: any) => n.declarations || []);
    const init = (name: string) => {
        const node = declarations.find((n: any) => n.id.name === name)?.init;
        expect(node, name).toBeDefined();
        return source.slice(node.start, node.end);
    };
    let context: any, route: any;
    full(ast, (node: any) => {
        if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return;
        if (node.callee.object.name === 'browser' && node.callee.property.name === 'newContext') context = node.arguments[0];
        if (node.callee.object.name === 'page' && node.callee.property.name === 'route') route = node.arguments[1];
    });
    expect(context).toBeDefined(); expect(route).toBeDefined();
    const license = new Function('require', 'return ' + init('LICENSE_STUB'))(localRequire);
    const pageRoute = new Function('LICENSE_STUB', 'port', 'return ' + source.slice(route.start, route.end))(license, 9876);
    return {
        context: new Function('return ' + source.slice(context.start, context.end))(),
        installSdk: new Function('return ' + init('FAKE_SDK'))(),
        routedLicense: async () => pageRoute({ request: () => ({ url: () => LICENSE_URL }),
            fulfill: (data: any) => new Response(data.body, { status: data.status, headers: { 'content-type': data.contentType } }),
            continue: () => { throw new Error('route missed license'); }, abort: () => { throw new Error('license aborted'); } })
    };
}

async function installedWorker() {
    const source = transformSync(readFileSync(path.join(ROOT, 'ZoeW/src/sw/sw.ts'), 'utf8'), { loader: 'ts', target: 'es2020' }).code;
    const config = transformSync(readFileSync(path.join(ROOT, 'ZoeW/vite.config.mts'), 'utf8'), { loader: 'ts' }).code;
    let coreExpression = '';
    full(parse(config, { ecmaVersion: 'latest', sourceType: 'module' }) as any, (node: any) => {
        if (node.type === 'VariableDeclarator' && node.id.name === 'core') coreExpression = config.slice(node.init.start, node.init.end);
    });
    expect(coreExpression).not.toBe('');
    const core = new Function('emitted', 'backend', 'return ' + coreExpression)(['./license-verify.js'], []);
    expect(core).toEqual(['./license-verify.js']);
    const version = /CACHE_VERSION\s*=\s*'([^']+)'/.exec(readFileSync(path.join(ROOT, 'ZoeW/src/sw/cache-version.ts'), 'utf8'))![1];
    const entries = new Map<string, Response>();
    const handlers: Record<string, (event: any) => void> = {};
    const key = (input: string | Request) => new URL(typeof input === 'string' ? input : input.url, ORIGIN + '/sw.js').href;
    const network = vi.fn(async (input: string | Request) => new Response(key(input) === LICENSE_URL
        ? readFileSync(path.join(ROOT, 'ZoeW/public/license-verify.js'), 'utf8') : JSON.stringify(version),
    { headers: { 'content-type': 'application/javascript' } }));
    const cache = {
        match: async (input: string | Request) => entries.get(key(input))?.clone(),
        put: async (input: string | Request, response: Response) => { entries.set(key(input), response.clone()); },
        addAll: async (requests: Request[]) => { for (const request of requests) entries.set(key(request), await network(request)); },
        add: async (request: Request) => { entries.set(key(request), await network(request)); }
    };
    class WorkerRequest extends Request {
        constructor(input: string, init?: RequestInit) { super(key(input), init); }
    }
    const claim = vi.fn(async () => {});
    vm.runInNewContext(source, { __CACHE_VERSION__: version, __CORE_SHELL__: core, __OPTIONAL_SHELL__: [], __BACKEND_SHELL__: [],
        self: { location: new URL(ORIGIN + '/sw.js'), addEventListener(type: string, handler: any) { handlers[type] = handler; }, skipWaiting: async () => {}, clients: { claim } },
        caches: { open: async () => cache, keys: async () => [version] }, navigator: { onLine: true }, fetch: network,
        URL, Request: WorkerRequest, Response, AbortController, setTimeout, clearTimeout });
    let pending: Promise<unknown>;
    for (const type of ['install', 'activate']) {
        handlers[type]({ waitUntil(value: Promise<unknown>) { pending = value; } });
        await pending!;
    }
    expect(claim).toHaveBeenCalledOnce();
    expect(entries.has(LICENSE_URL)).toBe(true);
    return {
        network,
        fetchLicense: async () => {
            let response!: Promise<Response>;
            handlers.fetch({ request: new Request(LICENSE_URL), respondWith(p: Promise<Response>) { response = p; }, waitUntil() {} });
            return response;
        }
    };
}

async function installReloadLicense(file: string, serviceWorkers?: string) {
    const fixture = checker(file);
    const worker = await installedWorker();
    const routed = vi.fn(fixture.routedLicense);
    // page.route មិនទទួល request ដែល SW ឆ្លើយរួច; context បិទ SW ត្រូវកំណត់មុន goto។
    const response = (serviceWorkers ?? fixture.context.serviceWorkers) === 'block' ? await routed() : await worker.fetchLicense();
    new Function(await response.text())();
    return { fixture, routed, worker };
}

async function startSession(fixture: ReturnType<typeof checker>, defect = '') {
    await reactAct(async () => {
    fixture.installSdk();
    const sdk = window.firebaseSDK;
    if (defect === 'missing-token') delete sdk.getIdTokenResult;
    if (defect === 'rejected-token') sdk.getIdTokenResult = async () => { throw new Error('token rejected'); };
    if (defect === 'expired') {
        sdk.getIdTokenResult = async () => ({ authTime: new Date(now - 4 * 60 * 60 * 1000 - 1).toISOString() });
        sdk.signOut = vi.fn(() => new Promise(() => {}));
    }
    Object.assign(firebaseState, { fb: sdk, auth: sdk.getAuth(), db: sdk.getDatabase(),
        firebaseConfig: { databaseURL: 'https://fixture.invalid' }, sessionExpiryCheck: 'pending',
        authGeneration: firebaseState.authGeneration + 1 });
    firebaseState.dbRefConnected = sdk.ref(firebaseState.db, '.info/connected');
    firebaseState.dbRefServerTimeOffset = sdk.ref(firebaseState.db, '.info/serverTimeOffset');
    expect(attachInfoListeners()).toBe(true);
    setupAuthListener();
    await vi.advanceTimersByTimeAsync(50); await turn();
    });
    step(() => {});
}

beforeEach(() => {
    now = Date.UTC(2026, 10, 9);
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(now);
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('alert', vi.fn()); vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('external requests blocked'); }));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    appLocalStore.clear(); sessionStorage.clear(); resetServerClock();
    firebaseState.auth = null as any; firebaseState.sessionExpiryCheck = 'pending';
    securityState.isVerifyingPin = false; securityState.appIsLocked = false; viewState.appLockOpen = false;
    uiState.modalDisplay = {}; uiState.modalStack = []; uiState.isModalOpen = false;
    mount(<><AppShell /><DocumentEffects /></>); installAuditActionAnnotations();
});
afterEach(() => {
    unmount();
    firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null;
    detachInfoListeners(); resetServerClock(); cancelActivationRetry(); clearSheetImportSession();
    delete loadedScriptPromises['xlsx'];
    appLocalStore.clear(); sessionStorage.clear(); delete window.ZoeLicense;
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it.each(files)('%s៖ reload រក្សា route នាឡិកា និង session ពិត', async file => {
    const { fixture, routed } = await installReloadLicense(file);
    await startSession(fixture);
    expect(serverClockIsTrustworthy()).toBe(true);
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    expect(document.body.classList.contains('app-locked')).toBe(false);
    expect(sessionUserActionAllowed('handleSheetImportFileInput')).toBe(true);
    expect(routed).toHaveBeenCalledOnce();
});

it.each(files)('%s៖ ទិសផ្ទុយ SW cache រំលង route ត្រូវបិទ session', async file => {
    const { fixture, routed, worker } = await installReloadLicense(file, 'allow');
    expect(routed).not.toHaveBeenCalled();
    expect(worker.network).toHaveBeenCalled();
    await startSession(fixture);
    expect(window.ZoeLicense.getServerTimeSample()).toBeNull();
    expect(serverClockIsTrustworthy()).toBe(false);
    expect(firebaseState.sessionExpiryCheck).toBe('unverified');
    expect(document.body.classList.contains('app-locked')).toBe(true);
    expect(sessionUserActionAllowed('handleSheetImportFileInput')).toBe(false);
    const input = document.getElementById('siFileInput') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['Barcode,Phone\nZTO0001,0970008508'], 'blocked.csv')] });
    step(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    await turn();
    expect(sheetImportState.sheetImportWorkbook).toBeNull();
});

it.each(['csv', 'xlsx'])('PIN ខុសរក្សា ciphertext ហើយ PIN ត្រូវនាំចូល %s តាម React input ពិត', async format => {
    const { fixture } = await installReloadLicense('sheet-import-test.js');
    await startSession(fixture);
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    appLocalStore.setItem('zoew_security_pin_hash', await hashPin('123456'));
    sheetImportState.sheetImportKey = await deriveSheetImportKey('123456');
    const stored = JSON.stringify({ u: await encryptSheetImportSecret(URL_VALUE), p: await encryptSheetImportSecret('synthetic-password') });
    appLocalStore.setItem('zoew_sheet_import_config', stored);
    step(() => requestPinBeforeConfig(openSheetImportModal, 'sheetImport'));
    expect(document.getElementById('pinModal')!.style.display).toBe('flex');
    setFieldValue('securityPinInput', '999999');
    step(() => document.querySelector<HTMLButtonElement>('#pinConfirmBtn')!.click());
    await reactAct(async () => { await vi.waitFor(() => expect(securityState.isVerifyingPin).toBe(false)); });
    expect(alert).toHaveBeenCalledOnce();
    expect(uiState.modalDisplay.sheetImportModal).not.toBe('flex');
    expect(appLocalStore.getItem('zoew_sheet_import_config')).toBe(stored);
    await reactAct(() => openSheetImportModal('654321'));
    expect(viewState.siParts.siConfigForm).toBe(true);
    expect(viewState.siParts.siFileCard).toBe(false);
    expect(appLocalStore.getItem('zoew_sheet_import_config')).toBe(stored);
    let importRefused = false;
    const sent: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
        const request = JSON.parse(String(init.body));
        sent.push({ ...request, headers: init.headers });
        if (request.action === 'import' && importRefused) return new Response(JSON.stringify({ ok: false, written: false, error: 'synthetic refusal' }));
        return new Response(JSON.stringify({ ok: true, data: request.action === 'import'
            ? { added: 3, updated: 1, unchanged: 0, skippedNoBarcode: 1, duplicatesInFile: 1, rowsAfter: 131, sheetName: 'Data' }
            : request.action === 'prepare'
            ? { signature: 'synthetic', source: 'auto', mapping: { barcode: 0, dod: 1, cod: 2, phone: 3 } }
            : { spreadsheetName: 'Synthetic', sheetName: 'Data', rowCount: 1 } }));
    }));
    await reactAct(() => openSheetImportModal('123456'));
    expect(viewState.siParts.siFileCard).toBe(true);
    const xlsx = localRequire(path.join(ROOT, 'ZoeW/public/vendor/xlsx.full.min.js'));
    vi.stubGlobal('XLSX', xlsx);
    loadedScriptPromises['xlsx'] = Promise.resolve();
    const input = document.getElementById('siFileInput') as HTMLInputElement;
    const rows = [['Barcode', 'DOD', 'COD', 'Phone'], ['ZTO0001', 1.5, 12, '0970008508'], ['ZTO0002', 0, 7.25, '0965551234'], ['ZTO0003', 2, 30, '0888123456'], ['ZTO0003', 2, 30, '0888123456'], ['', 0, 0, '']];
    const wb = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'Data');
    const bytes = format === 'xlsx' ? xlsx.write(wb, { type: 'array', bookType: 'xlsx' }) : rows.map(row => row.join(',')).join('\n');
    const file = new File([bytes], 'synthetic.' + format);
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await reactAct(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await vi.advanceTimersByTimeAsync(0); await turn(); });
    await reactAct(async () => { await vi.waitFor(() => expect(sheetImportState.sheetImportWorkbook, JSON.stringify(uiState.sheetImportView)).not.toBeNull()); });
    expect(viewState.siParts.siMapCard).toBe(true);
    const preview = [...document.querySelectorAll('#siPreviewBody tr')].map(row => [...row.children].map(cell => cell.textContent).join('|'));
    expect(preview).toHaveLength(4);
    expect(preview[0]).toBe('ZTO0001|1.50|12.00|0970008508');
    expect(preview[1]).toBe('ZTO0002|0.00|7.25|0965551234');
    expect(['siMapBarcode', 'siMapDod', 'siMapCod', 'siMapPhone'].map(id => (document.getElementById(id) as HTMLSelectElement).value)).toEqual(['0', '1', '2', '3']);
    const chips = [...document.querySelectorAll('#siChips .si-chip')].map(chip => chip.textContent);
    expect(chips.some(chip => /5$/.test(chip))).toBe(true);
    expect(chips.some(chip => /Barcode 4$/.test(chip))).toBe(true);
    expect(chips.some(chip => /ស្ទួន/.test(chip))).toBe(true);
    expect(appLocalStore.getItem('zoew_sheet_import_config')).toBe(stored);
    step(() => document.querySelector<HTMLButtonElement>('#siImportBtn')!.click());
    await reactAct(async () => { await vi.waitFor(() => expect(document.getElementById('siActionMsg')!.textContent).toContain('131')); });
    const imports = sent.filter(request => request.action === 'import');
    expect(imports).toHaveLength(1);
    expect(imports[0].payload.rows).toHaveLength(4);
    expect(imports[0].payload.rows[0]).toEqual(['ZTO0001', 1.5, 12, '0970008508']);
    expect(new Headers(imports[0].headers).get('content-type')).toBe('text/plain;charset=utf-8');
    expect(document.getElementById('siActionMsg')!.textContent).toMatch(/^✅/);
    importRefused = true;
    step(() => document.querySelector<HTMLButtonElement>('#siImportBtn')!.click());
    await reactAct(async () => { await vi.waitFor(() => expect(document.getElementById('siActionMsg')!.textContent).toContain('synthetic refusal')); });
    expect(document.getElementById('siActionMsg')!.textContent).not.toContain('✅');
    expect((document.getElementById('siImportBtn') as HTMLButtonElement).disabled).toBe(false);
    const beforeOffline = sent.length;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    step(() => document.querySelector<HTMLButtonElement>('#siImportBtn')!.click());
    await reactAct(async () => { await vi.waitFor(() => expect(document.getElementById('siActionMsg')!.textContent).toContain('ក្រៅបណ្ដាញ')); });
    expect(sent).toHaveLength(beforeOffline);
});

it.each(files.flatMap(file => ['missing-token', 'rejected-token', 'expired'].map(defect => [file, defect])))(
'%s៖ route ត្រឹមត្រូវមិនរំលង %s', async (file, defect) => {
    const { fixture } = await installReloadLicense(file, 'block');
    await startSession(fixture, defect);
    expect(serverClockIsTrustworthy()).toBe(true);
    expect(firebaseState.sessionExpiryCheck).toBe(defect === 'expired' ? 'expired' : 'unverified');
    expect(document.querySelector('[data-session-verification]')).not.toBeNull();
    expect(sessionUserActionAllowed('handleSheetImportFileInput')).toBe(false);
    loadedScriptPromises['xlsx'] = Promise.resolve();
    const input = document.getElementById('siFileInput') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['Barcode,Phone\nZTO0001,0970008508'], 'denied.csv')] });
    step(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    await turn();
    expect(sheetImportState.sheetImportWorkbook).toBeNull();
    expect(uiState.sheetImportView.msgs.siFileMsg).toBeNull();
});
