// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { chromium, type Browser } from 'playwright-core';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import path from 'node:path';

let browser: Browser;
let bundle: string;
const DAY = '2026-11-15';
const PICKUP_PATH = 'zoew_daily_pickup_cod_dod/' + DAY;

beforeAll(async () => {
    const output = await build({ stdin: { contents: `
        export * as sdk from 'firebase/database';
        export { initializeApp } from 'firebase/app';
        export { firebaseState, dataState } from './src/core/state';
        export { appLocalStore } from './src/core/storage';
        export { liveShopScope } from './src/core/shop-scope';
        export { beginPickupIntent, commitPickupMarks, countPickedUpCustomers, endPickupIntent, patchPickupJournalEntry, pickupContextIsCurrent, readPickupJournal } from './src/domain/pickup';
    `, resolveDir: path.resolve('.'), loader: 'ts' }, bundle: true, write: false,
    format: 'iife', globalName: 'pickupOwnerLab',
    define: { __APP_VERSION__: '"test"', __CACHE_VERSION__: '"test"', __FCM_CONFIGURED__: 'false', 'import.meta.env': '{}' } });
    bundle = output.outputFiles[0].text;
    browser = await chromium.launch({ executablePath: process.env.ZOEW_TEST_BROWSER || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server'] });
}, 60000);

afterAll(async () => { await browser?.close(); });

type WireMessage = { t?: string; d?: { a?: string; r?: number; b?: { p?: string; d?: unknown; h?: string } } };

const cases = [
    { phoneKey: '012345678', keys: ['CODE_A', 'CODE_B'], supported: true },
    { phoneKey: 'constructor', keys: ['CODE_A', 'CODE_B'], supported: true },
    { phoneKey: 'toString', keys: ['CODE_A', 'CODE_B'], supported: true },
    { phoneKey: '__proto__', keys: ['CODE_A', 'CODE_B'], supported: false },
    { phoneKey: 'hasOwnProperty', keys: ['CODE_A', 'CODE_B'], supported: false },
    { phoneKey: '012345678', keys: ['__proto__', 'CODE_B'], supported: false },
    { phoneKey: '012345678', keys: ['hasOwnProperty', 'CODE_B'], supported: false },
    { phoneKey: '__proto__', keys: ['CODE_A', 'CODE_B'], supported: false, unproven: true },
    { phoneKey: '012345678', keys: ['__proto__', 'CODE_B'], supported: false, unproven: true }
];

it.each(cases)('SDK Firebase ពិត៖ $phoneKey / $keys / $unproven រក្សាទិន្នន័យពេញលេញ ឬរក្សាការងារ HOLD មុនសរសេរ', async ({ phoneKey, keys, supported, unproven = false }) => {
    const server = createServer((_request, response) => response.end('<!doctype html>'));
    const sockets = new WebSocketServer({ server });
    let saved: unknown = { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 };
    const writes: unknown[] = [];
    const unexpected: string[] = [];
    sockets.on('connection', socket => {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Missing loopback port');
        socket.send(JSON.stringify({ t: 'c', d: { t: 'h', d: { ts: Date.now(), v: '5', h: '127.0.0.1:' + address.port, s: 'pickup-owner-session' } } }));
        socket.on('message', raw => {
            let message: WireMessage;
            try { message = JSON.parse(raw.toString()); } catch { return; }
            const request = message.d;
            if (message.t !== 'd' || !request?.a) return;
            const target = String(request.b?.p || '').replace(/^\//, '');
            if (['p', 'g', 'q'].includes(request.a) && target !== PICKUP_PATH) unexpected.push(request.a + ':' + target);
            if (request.a === 'p' && !request.b?.h) {
                socket.send(JSON.stringify({ t: 'd', d: { r: request.r, b: { s: 'datastale', d: saved } } }));
                return;
            }
            if (request.a === 'p') { saved = request.b?.d; writes.push(saved); }
            if (request.a === 'q' || request.a === 'p') socket.send(JSON.stringify({ t: 'd', d: { a: 'd', b: { p: request.b?.p, d: saved } } }));
            socket.send(JSON.stringify({ t: 'd', d: { r: request.r, b: { s: 'ok', d: request.a === 'g' ? saved : {} } } }));
        });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing loopback port');
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        await page.goto('http://127.0.0.1:' + address.port + '/');
        await page.addScriptTag({ content: bundle });
        const result = await page.evaluate<{ committed: boolean | null; readOwn: boolean; readCount: unknown; memoryOwn: boolean; memoryCount: unknown; customers: number; current: boolean; failures: string[]; ended: boolean; journalBefore: Record<string, unknown>; journalAfter: Record<string, unknown> | null }>(`(async () => {
            const { phoneKey, keys, unproven, port, day } = ${JSON.stringify({ phoneKey, keys, unproven, port: address.port, day: DAY })};
            const lab = pickupOwnerLab;
            lab.sdk.forceWebSockets();
            const config = { databaseURL: 'https://demo-pickup-owners.firebaseio.com', projectId: 'demo-pickup-owners' };
            const app = lab.initializeApp(config);
            const db = lab.sdk.getDatabase(app);
            lab.sdk.connectDatabaseEmulator(db, '127.0.0.1', port);
            const failures = [];
            const sdk = { ...lab.sdk, runTransaction: async (...args) => {
                try { return await lab.sdk.runTransaction(...args); }
                catch (error) { failures.push(String(error.stack || error)); throw error; }
            } };
            Object.assign(lab.firebaseState, { db, fb: sdk, auth: { app, currentUser: { uid: 'fixture-owner' } },
                firebaseConfig: config, authGeneration: 1, isInitializingFirebase: false, isDatabaseConnected: true });
            lab.appLocalStore.setItem('zoew_firebase_config', JSON.stringify(config));
            const intent = lab.beginPickupIntent(day, keys);
            if (!intent) throw new Error('Missing durable pickup intent');
            if (!lab.patchPickupJournalEntry(intent, { stage: 'started', pickupResetEpoch: 0, allowedAddKeys: unproven ? [] : keys, at: Date.now() - 9 * 24 * 60 * 60 * 1000 })) throw new Error('Missing started marker');
            const journalBefore = lab.readPickupJournal().find(entry => entry.id === intent);
            const owner = { db, sdk, generation: 1, scope: lab.liveShopScope(), uid: 'fixture-owner', date: day, revision: 1, epoch: 0, intent };
            const marks = keys.map(key => ({ key, phoneKey, closed: true }));
            const committed = await lab.commitPickupMarks(day, marks, false, true, undefined, owner);
            const ended = await lab.endPickupIntent(intent, committed);
            const journalAfter = lab.readPickupJournal().find(entry => entry.id === intent) || null;
            const readback = (await lab.sdk.get(lab.sdk.ref(db, 'zoew_daily_pickup_cod_dod/' + day))).val();
            const memory = lab.dataState.dailyPickupData[day];
            const readOwn = Object.prototype.hasOwnProperty.call(readback?.pickedUpPhones || {}, phoneKey);
            const memoryOwn = Object.prototype.hasOwnProperty.call(memory?.pickedUpPhones || {}, phoneKey);
            return { current: lab.pickupContextIsCurrent(owner), failures, committed, readOwn,
                readCount: readOwn ? readback.pickedUpPhones[phoneKey] : null, memoryOwn,
                memoryCount: memoryOwn ? memory.pickedUpPhones[phoneKey] : null, customers: lab.countPickedUpCustomers(memory), ended, journalBefore, journalAfter };
        })()`);
        expect(result).toMatchObject({ current: true, failures: [], committed: supported ? true : null, readOwn: supported,
            readCount: supported ? 2 : null, memoryOwn: supported, memoryCount: supported ? 2 : null, customers: supported ? 1 : 0, ended: supported });
        expect(result.journalAfter).toEqual(supported ? null : { ...result.journalBefore, hold: 'recovery-pending' });
        expect(writes).toHaveLength(supported ? 1 : 0);
        expect(saved).toEqual(supported ? { packagesPickedUp: 2, pickupRevision: 2, pickupResetEpoch: 0,
            pickedUpPhones: Object.fromEntries([[phoneKey, 2]]), pickedUpBarcodes: Object.fromEntries(keys.map(key => [key, phoneKey])) }
            : { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 });
        expect(unexpected).toEqual([]);
    } finally {
        await context.close();
        for (const client of sockets.clients) client.terminate();
        await new Promise<void>(resolve => sockets.close(() => server.close(() => resolve())));
    }
}, 30000);
