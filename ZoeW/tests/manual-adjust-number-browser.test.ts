// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright-core';
import { build } from 'esbuild';
import path from 'node:path';

let browser: Browser;
let bundle: string;

beforeAll(async () => {
    const built = await build({
        stdin: {
            contents: `
                import { createElement } from 'react';
                import { createRoot } from 'react-dom/client';
                import { flushSync } from 'react-dom';
                import { ManualAdjustModal } from './src/app/components/modals/ManualAdjustModal';
                export { dataState, firebaseState, uiState } from './src/core/state';
                export { viewState } from './src/core/view-state';
                export { openManualAdjustModal } from './src/features/stats-modals';
                export function mount() { flushSync(() => createRoot(document.getElementById('root')).render(createElement(ManualAdjustModal))); }
            `,
            resolveDir: path.resolve('.'),
            loader: 'ts'
        },
        bundle: true, write: false, format: 'iife', globalName: 'manualLab', jsx: 'automatic',
        define: { __APP_VERSION__: '"test"', __CACHE_VERSION__: '"test"', __FCM_CONFIGURED__: 'false', 'import.meta.env': '{}' }
    });
    bundle = built.outputFiles[0].text;
    browser = await chromium.launch({ executablePath: process.env.ZOEW_TEST_BROWSER || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
}, 30000);

afterAll(async () => { await browser?.close(); });

for (const field of ['manualCodChangeInput', 'manualDodChangeInput', 'manualCountChangeInput']) {
    for (const typed of ['1e309', '-1e309', '1e']) {
        it(`វាយ ${typed} ក្នុង ${field}៖ browser បង្ហាញ value ទទេ តែការកែមិនត្រូវអនុវត្តពាក់កណ្តាល`, async () => {
            const page = await browser.newPage();
            try {
                await page.setContent('<!doctype html><div id="root"></div>');
                await page.addScriptTag({ content: bundle });
                await page.evaluate(() => {
                    const w = window as any;
                    const api = w.manualLab;
                    w.writeCalls = 0;
                    w.alerts = [];
                    window.alert = (message) => { w.alerts.push(message); };
                    Object.assign(api.firebaseState, {
                        db: {}, dbRefDailyRevenue: {}, dbRefMonthlyRevenue: {},
                        fb: { ref: (_db: any, p: string) => ({ path: p }), runTransaction: () => { w.writeCalls++; return new Promise(() => {}); } }
                    });
                    api.dataState.dailyRevenueData = {};
                    api.dataState.monthlyRevenueData = {};
                    api.mount();
                    api.openManualAdjustModal();
                });
                await page.locator('#manualCodChangeInput').fill('5');
                await page.locator('#manualDodChangeInput').fill('1');
                await page.locator('#manualCountChangeInput').fill('2');
                await page.locator('#' + field).fill('');
                await page.locator('#' + field).pressSequentially(typed);
                const invalid = await page.locator('#' + field).evaluate((el: HTMLInputElement) => ({ value: el.value, badInput: el.validity.badInput }));
                expect(invalid).toEqual({ value: '', badInput: true });
                await page.locator('#manualAdjustSubmitBtn').click();
                const result = await page.evaluate(() => {
                    const w = window as any;
                    return { writes: w.writeCalls, alerts: w.alerts.length, busy: w.manualLab.viewState.manualAdjustBusy, daily: w.manualLab.dataState.dailyRevenueData };
                });
                expect(result).toEqual({ writes: 0, alerts: 1, busy: false, daily: {} });
            } finally { await page.close(); }
        });
    }
}

it('វាលទទេពិត និង 1e2 ត្រឹមត្រូវ៖ អាចរក្សាទុកចំនួន ១០០ បាន', async () => {
    const page = await browser.newPage();
    try {
        await page.setContent('<!doctype html><div id="root"></div>');
        await page.addScriptTag({ content: bundle });
        await page.evaluate(() => {
            const w = window as any;
            const api = w.manualLab;
            w.values = [];
            window.alert = () => { throw new Error('Unexpected alert'); };
            Object.assign(api.firebaseState, {
                db: {}, dbRefDailyRevenue: {}, dbRefMonthlyRevenue: {},
                fb: { ref: (_db: any, p: string) => ({ path: p }), runTransaction: (_ref: any, updater: any) => {
                    w.values.push(updater(null));
                    return new Promise(() => {});
                } }
            });
            api.mount();
            api.openManualAdjustModal();
        });
        await page.locator('#manualCountChangeInput').pressSequentially('1e2');
        expect(await page.locator('#manualCodChangeInput').evaluate((el: HTMLInputElement) => el.validity.badInput)).toBe(false);
        await page.locator('#manualAdjustSubmitBtn').click();
        expect(await page.evaluate(() => (window as any).values[0])).toMatchObject({ codDollar: 0, dodDollar: 0, totalCount: 100 });
    } finally { await page.close(); }
});
