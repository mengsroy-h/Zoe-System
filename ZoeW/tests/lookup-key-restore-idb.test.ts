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
        export { showAppLockScreen } from './src/features/app-lock';
        export { logoutApp } from './src/features/auth';
        export { appLocalStore, appSessionStore } from './src/core/storage';
    `, resolveDir: path.resolve('.') }, bundle: true, write: false, format: 'iife', globalName: 'keyAudit',
        define: { __APP_VERSION__: '"test"', __CACHE_VERSION__: '"test"', __FCM_CONFIGURED__: 'false', 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_NATIVE_WEB_ORIGIN': '""' } });
    bundle = built.outputFiles[0].text;
    browser = await chromium.launch({ executablePath: process.env.ZOEW_TEST_BROWSER || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
}, 30000);
afterAll(async () => { await browser?.close(); });

it.each(['current', 'logout', 'lock', 'already-locked', 'replacement', 'session-change'])('real IndexedDB restore while %s occurs', async (action) => {
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
            const restored = await restoring;
            return { restored, hasKey: !!api.securityState.lookupSecretKey,
                signedIn: !!api.firebaseState.auth.currentUser, locked: api.securityState.appIsLocked,
                replacementPreserved: !replacement || api.securityState.lookupSecretKey === replacement };
        }, action);
        expect(result).toEqual({ restored: action === 'current', hasKey: action === 'current' || action === 'replacement',
            signedIn: action !== 'logout', locked: action === 'lock' || action === 'already-locked', replacementPreserved: true });
    } finally { await context.close(); }
}, 30000);
