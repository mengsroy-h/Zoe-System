// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest';
import { build as bundle } from 'esbuild';
import { build as viteBuild } from 'vite';
import { chromium, type Browser } from 'playwright-core';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serveDir } from '../scripts/serve.mjs';

let browser: Browser;
let wireBundle: string;
let output: string;
let production: Awaited<ReturnType<typeof serveDir>>;

beforeAll(async () => {
    const built = await bundle({ stdin: { contents: `
        export * as sdk from 'firebase/database';
        export { initializeApp, deleteApp } from 'firebase/app';
        export { firebaseState } from './src/core/state';
        export { dbListenerPendingPaths } from './src/core/text';
        export { attachInfoListeners, probeDatabaseLiveness, DB_LISTENER_PROGRESS_GRACE_MS, DB_LIVENESS_PROBE_TIMEOUT_MS } from './src/services/connection';
    `, resolveDir: path.resolve('.'), loader: 'ts' }, bundle: true, write: false, format: 'iife', globalName: 'wireLab',
    define: { __APP_VERSION__: '"test"', __CACHE_VERSION__: '"test"', __FCM_CONFIGURED__: 'false', 'import.meta.env': '{}' } });
    wireBundle = built.outputFiles[0].text;
    output = mkdtempSync(path.join(tmpdir(), 'zoe-connection-production-'));
    await viteBuild({ configFile: path.resolve('vite.config.mts'), logLevel: 'error',
        plugins: [{ name: 'connection-boundary-observer', transform(code, id) {
            if (id === path.resolve('src/main.tsx')) return code + `
                import { initFirebase as boundaryInit } from './services/firebase-init';
                import { firebaseState as boundaryState, uiState as boundaryUi } from './core/state';
                import { connectionFlowSnapshot as boundaryFlow } from './services/connection-flow';
                window.__connectionBoundary = { init: boundaryInit, state: boundaryState, ui: boundaryUi, flow: boundaryFlow };
            `;
        } }], build: { outDir: output } });
    const backendFiles = readdirSync(path.join(output, 'assets')).filter(name => /^supabase-backend-.*\.js$/.test(name));
    expect(backendFiles).toHaveLength(1);
    const importers = readdirSync(path.join(output, 'assets')).filter(name => name.endsWith('.js')).filter(name =>
        new RegExp('(?:from|import)\\s*["\']\\./' + backendFiles[0].replaceAll('.', '\\.') + '["\']').test(readFileSync(path.join(output, 'assets', name), 'utf8')));
    expect(importers).toEqual([]);
    production = await serveDir(output);
    browser = await chromium.launch({ executablePath: process.env.ZOEW_TEST_BROWSER || '/usr/bin/chromium', args: ['--no-sandbox'] });
}, 60000);

afterAll(async () => {
    await browser?.close();
    await new Promise<void>(resolve => production?.server.close(() => resolve()) ?? resolve());
    if (output) rmSync(output, { recursive: true, force: true });
});

it('Firebase ➜ Supabase៖ HTTP404 ពិតលើ chunk បង្ហាញ banner ដោយរក្សា journal និងបិទ write admission', async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const chunkHits: string[] = [];
    await page.route('**/supabase-backend-*.js', route => {
        chunkHits.push(route.request().url());
        return route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing deployment chunk' });
    });
    await page.route(/^https:\/\//, route => route.abort('internetdisconnected'));
    await page.addInitScript(() => {
        const app = { options: {} };
        const db = { app };
        const auth = { app, currentUser: null };
        let apps: unknown[] = [];
        (window as any).firebaseSDK = { getApps: () => apps, initializeApp: () => { apps = [app]; return app; },
            deleteApp: async () => { apps = []; }, getDatabase: () => db, getAuth: () => auth,
            ref: (_db: unknown, p: string) => ({ database: db, path: p }), off() {}, goOnline() {}, goOffline() {},
            onValue: () => () => {}, onAuthStateChanged: () => () => {} };
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'synthetic', databaseURL: 'https://boundary.firebaseio.com', projectId: 'boundary' }));
        (window as any).__preloadFailures = [];
        window.addEventListener('vite:preloadError', (event: any) => (window as any).__preloadFailures.push(String(event.payload?.cause || event.payload)));
    });
    try {
        await page.goto(`http://127.0.0.1:${production.port}/`, { waitUntil: 'load' });
        await page.waitForFunction(() => !!(window as any).__connectionBoundary?.state.db);
        expect(chunkHits).toEqual([]);
        const result = await page.evaluate(async () => {
            const api = (window as any).__connectionBoundary;
            const old = api.state.fb;
            const journalKey = 'zoew_pickup_journal_v2:connection-boundary';
            const journal = JSON.stringify({ state: 'unknown', operation: 'preserve-original-intent' });
            localStorage.setItem(journalKey, journal);
            localStorage.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://boundary.supabase.co', supabaseKey: 'sb_publishable_synthetic' }));
            const initialized = await api.init();
            return { initialized, unavailable: api.state.firebaseSdkUnavailable, canWrite: api.flow().canWrite,
                banner: api.ui.updateBannerOpen, updateReady: api.ui.updateReady, errors: (window as any).__preloadFailures,
                oldSdkRetained: api.state.fb === old, journalPreserved: localStorage.getItem(journalKey) === journal };
        });
        expect(chunkHits).toHaveLength(1);
        expect(result).toMatchObject({ initialized: false, unavailable: true, canWrite: false, banner: true,
            updateReady: true, oldSdkRetained: true, journalPreserved: true });
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatch(/supabase-backend|Failed to fetch dynamically imported module/);
        expect(await page.locator('.app-update-banner').isVisible()).toBe(true);
    } finally { await context.close(); }
}, 30000);

it.each([true, false])('listener ដំបូង pending៖ SDK Firebase/WebSocket ពិត · zombie=%s · មិនបង្កើត write', async blackholeInitial => {
    const server = createServer((_req, response) => response.end('<!doctype html>'));
    const sockets = new WebSocketServer({ server });
    const actions: string[] = [];
    let connections = 0;
    sockets.on('connection', socket => {
        const initial = ++connections === 1;
        const address = server.address() as { port: number };
        socket.send(JSON.stringify({ t: 'c', d: { t: 'h', d: { ts: Date.now(), v: '5', h: '127.0.0.1:' + address.port, s: 'synthetic-session' } } }));
        socket.on('message', raw => {
            let message: any;
            try { message = JSON.parse(raw.toString()); } catch { return; }
            const request = message.d;
            if (message.t !== 'd' || !request?.a) return;
            actions.push(request.a);
            if (initial && blackholeInitial) return;
            if (request.a === 'q') {
                if (initial) return;
                socket.send(JSON.stringify({ t: 'd', d: { a: 'd', b: { p: request.b.p, d: { recovered: true } } } }));
                socket.send(JSON.stringify({ t: 'd', d: { r: request.r, b: { s: 'ok', d: {} } } }));
            } else if (request.a === 'g') socket.send(JSON.stringify({ t: 'd', d: { r: request.r, b: { s: 'ok', d: null } } }));
        });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        const port = (server.address() as { port: number }).port;
        await page.goto(`http://127.0.0.1:${port}/`);
        await page.addScriptTag({ content: wireBundle });
        await page.evaluate(port => {
            const api = (window as any).wireLab;
            api.sdk.forceWebSockets();
            const app = api.initializeApp({ databaseURL: 'https://demo-boundary.firebaseio.com', projectId: 'demo-boundary' });
            const db = api.sdk.getDatabase(app);
            api.sdk.connectDatabaseEmulator(db, '127.0.0.1', port);
            Object.assign(api.firebaseState, { db, fb: api.sdk, dbRefConnected: api.sdk.ref(db, '.info/connected'),
                dbRefServerTimeOffset: api.sdk.ref(db, '.info/serverTimeOffset'), dbLivenessProbe: null,
                lastForcedReconnectAt: 0, lastDbLivenessCycleAt: 0, dbListenerProgressAt: 0 });
            api.attachInfoListeners();
            api.dbListenerPendingPaths.add('history');
            (window as any).__wireSnapshots = [];
            api.sdk.onValue(api.sdk.ref(db, 'zoew_scan_history_cod_dod'), (snapshot: any) => {
                (window as any).__wireSnapshots.push(snapshot.val()); api.dbListenerPendingPaths.delete('history');
            });
        }, port);
        await page.waitForFunction(() => (window as any).wireLab.firebaseState.isDatabaseConnected === true);
        expect(connections).toBe(1);
        expect(await page.evaluate(() => [...(window as any).wireLab.dbListenerPendingPaths])).toEqual(['history']);
        const outcome = await page.evaluate(async () => {
            const api = (window as any).wireLab;
            api.firebaseState.lastDbLivenessOkAt = Date.now() - api.DB_LISTENER_PROGRESS_GRACE_MS;
            const verdict = await api.probeDatabaseLiveness('initial-browser-zombie');
            return { verdict, pending: [...api.dbListenerPendingPaths] };
        });
        expect(actions).toContain('g');
        expect(outcome).toEqual({ verdict: !blackholeInitial, pending: ['history'] });
        if (blackholeInitial) {
            await page.waitForFunction(() => (window as any).__wireSnapshots.length > 0);
            expect(connections).toBeGreaterThanOrEqual(2);
            expect(await page.evaluate(() => (window as any).__wireSnapshots)).toEqual([{ recovered: true }]);
            expect(await page.evaluate(() => [...(window as any).wireLab.dbListenerPendingPaths])).toEqual([]);
        } else {
            expect(connections).toBe(1);
            expect(await page.evaluate(() => (window as any).__wireSnapshots)).toEqual([]);
        }
        expect(actions.filter(action => ['p', 'm', 'o'].includes(action))).toEqual([]);
    } finally {
        await context.close();
        for (const client of sockets.clients) client.terminate();
        await new Promise<void>(resolve => sockets.close(() => server.close(() => resolve())));
    }
}, 30000);
