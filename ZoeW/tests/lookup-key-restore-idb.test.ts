// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright-core';
import { build } from 'esbuild';
import path from 'node:path';

let browser: Browser;
let bundle = '';
beforeAll(async () => {
    const built = await build({ stdin: { contents: `
        export { restoreLookupSecretKey, rememberLookupSecretKey } from './src/services/crypto';
        export { securityState, firebaseState } from './src/core/state';
        export { showAppLockScreen, appLockShouldArm } from './src/features/app-lock';
        export { logoutApp, setupAuthListener } from './src/features/auth';
        export { clearSensitiveModalFields } from './src/features/session';
        export { appLocalStore, appSessionStore } from './src/core/storage';
    `, resolveDir: path.resolve('.') }, bundle: true, write: false, format: 'iife', globalName: 'keyAudit',
        define: { __APP_VERSION__: '"test"', __CACHE_VERSION__: '"test"', __FCM_CONFIGURED__: 'false', 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_NATIVE_WEB_ORIGIN': '""' } });
    bundle = built.outputFiles[0].text;
    browser = await chromium.launch({ executablePath: process.env.ZOEW_TEST_BROWSER || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
}, 30000);

it.each(['initial-auth', 'early-auth', 'logout-off', 'config-change', 'reset', 'retry-session-change', 'retry-user-change', 'no-config'])('boot restore with real queued IndexedDB and initial auth callback: %s', async (action) => {
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:38133/')
            ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Boot key audit</title>' }) : route.abort());
        await page.goto('http://127.0.0.1:38133/');
        await page.addScriptTag({ content: bundle });
        const result = await page.evaluate(async (mode) => {
            const api = (window as any).keyAudit;
            const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            if (!await api.rememberLookupSecretKey(key)) throw new Error('Could not persist real CryptoKey');
            api.appLocalStore.setItem('zoew_security_pin_hash', 'synthetic-pin-hash');
            api.appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://shop-a.firebaseio.com' }));
            if (mode === 'no-config') api.appLocalStore.removeItem('zoew_firebase_config');
            api.appSessionStore.setItem('zoew_app_unlocked', '1');
            if (mode === 'logout-off') api.appLocalStore.setItem('zoew_app_lock_v1', '0');
            api.securityState.lookupSecretKey = null;
            api.securityState.appIsLocked = false;
            api.firebaseState.auth = null;
            let authSignal: (() => void) | undefined;
            api.firebaseState.fb = {
                onAuthStateChanged: (auth: any, callback: any) => {
                    if (mode === 'early-auth') authSignal = () => callback(auth.currentUser);
                    else setTimeout(() => callback(auth.currentUser), 10);
                    return () => {};
                },
                signOut: async (auth: any) => { auth.currentUser = null; }
            };
            // A native readwrite transaction queues the real restore read until after initial auth.
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open('zoew_lookup_key_v1', 1);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            let held = true;
            const tx = db.transaction('k', 'readwrite');
            const store = tx.objectStore('k');
            const keepAlive = () => { const read = store.get('lookupSecretKey'); read.onsuccess = () => { if (held) keepAlive(); }; };
            keepAlive();
            let reads = 0;
            const realTransaction = IDBDatabase.prototype.transaction;
            IDBDatabase.prototype.transaction = function (...args: Parameters<typeof realTransaction>) {
                const transaction = realTransaction.apply(this, args);
                if (args[1] === 'readonly' && ++reads === 2 && (mode === 'retry-session-change' || mode === 'retry-user-change')) {
                    if (mode === 'retry-session-change') api.firebaseState.authGeneration++;
                    api.firebaseState.auth.currentUser = { uid: 'different-user' };
                }
                return transaction;
            };
            const generation = api.firebaseState.authGeneration;
            const restoring = api.restoreLookupSecretKey(true);
            api.firebaseState.auth = { currentUser: { uid: 'boot-user' } };
            api.setupAuthListener();
            await new Promise(resolve => setTimeout(resolve, 40));
            if (mode === 'logout-off') {
                await api.logoutApp();
                if (api.appLockShouldArm()) throw new Error('Logout control must keep app-lock preference off');
            }
            if (mode === 'reset') api.clearSensitiveModalFields();
            if (mode === 'config-change') api.appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://shop-b.firebaseio.com' }));
            held = false;
            const restored = await restoring;
            authSignal?.();
            db.close();
            return { restored, hasKey: !!api.securityState.lookupSecretKey,
                authCallbackRan: api.firebaseState.authGeneration > generation,
                extractable: api.securityState.lookupSecretKey?.extractable ?? null, reads };
        }, action);
        const successful = action === 'initial-auth' || action === 'early-auth';
        expect(result).toEqual({ restored: successful, hasKey: successful, authCallbackRan: true,
            extractable: successful ? false : null, reads: ['initial-auth', 'retry-session-change', 'retry-user-change'].includes(action) ? 2 : 1 });
    } finally { await context.close(); }
}, 30000);
afterAll(async () => { await browser?.close(); });

it.each(['current', 'logout', 'lock', 'already-locked', 'replacement', 'session-change', 'session-reset', 'user-change', 'auth-change'])('real IndexedDB restore while %s occurs', async (action) => {
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await page.route('**/*', (route) => route.request().url().startsWith('http://127.0.0.1:38133/')
            ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Lookup key audit</title>' }) : route.abort());
        await page.goto('http://127.0.0.1:38133/');
        await page.addScriptTag({ content: bundle });
        const result = await page.evaluate(async (mode) => {
            const api = (window as any).keyAudit;
            const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            if (!await api.rememberLookupSecretKey(key)) throw new Error('Could not persist real CryptoKey');
            api.appLocalStore.setItem('zoew_security_pin_hash', 'synthetic-pin-hash');
            api.appSessionStore.setItem('zoew_app_unlocked', '1');
            api.securityState.lookupSecretKey = null;
            api.securityState.appIsLocked = false;
            api.firebaseState.auth = { currentUser: { uid: 'audit-user' } };
            api.firebaseState.fb = { signOut: async (auth: any) => { auth.currentUser = null; } };
            const replacement = mode === 'replacement' ? await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) : null;
            if (mode === 'already-locked') api.showAppLockScreen();
            const restoring = api.restoreLookupSecretKey();
            if (mode === 'logout') await api.logoutApp();
            if (mode === 'lock') api.showAppLockScreen();
            if (mode === 'replacement') api.securityState.lookupSecretKey = replacement;
            if (mode === 'session-change') api.firebaseState.authGeneration++;
            if (mode === 'session-reset') api.clearSensitiveModalFields();
            if (mode === 'user-change') api.firebaseState.auth.currentUser = { uid: 'another-user' };
            if (mode === 'auth-change') api.firebaseState.auth = { currentUser: api.firebaseState.auth.currentUser };
            const restored = await restoring;
            return { restored, hasKey: !!api.securityState.lookupSecretKey,
                signedIn: !!api.firebaseState.auth.currentUser, locked: api.securityState.appIsLocked,
                replacementPreserved: !replacement || api.securityState.lookupSecretKey === replacement };
        }, action);
        expect(result).toEqual({ restored: action === 'current', hasKey: action === 'current' || action === 'replacement',
            signedIn: action !== 'logout', locked: action === 'lock' || action === 'already-locked', replacementPreserved: true });
    } finally { await context.close(); }
}, 30000);
