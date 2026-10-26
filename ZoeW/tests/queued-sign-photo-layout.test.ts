// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright-core';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
let browser: Browser, bundle: string, css: string, fontCssUrl: string;
beforeAll(async () => {
    const appHtml = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    fontCssUrl = appHtml.match(/<link id="webFontCss"[^>]+href="([^"]+)"/)?.[1] || '';
    expect(new URL(fontCssUrl).hostname).toBe('fonts.googleapis.com');
    const store = path.join(ROOT, 'src/core/store.ts').replaceAll('\\', '/');
    const built = await build({ stdin: { resolveDir: ROOT, loader: 'tsx', contents: `
        import React from 'react'; import { createRoot } from 'react-dom/client';
        import { PalmSignQueueModal } from './src/app/components/modals/PalmSignQueueModal';
        import { palmSignOutboxState } from './src/features/palm-sign-outbox';
        window.queueEvents = []; window.queueState = palmSignOutboxState;
        palmSignOutboxState.recoveryRows = [
            { id:'one', code:'77130500000012', signMan:'សុខា', phase:'action', recovery:true, busy:false, signed:true, photoVerified:false, cleanupAt:1793088000000, message:'Sign រួចតែរូបដើមរបស់ការងារនេះមិនទាន់មានភស្តុតាង។ រូបនៅរក្សាទុក មិនផ្ញើស្ទួន។' },
            { id:'two', code:'77130500000013', signMan:'អ្នកទទួលសាកល្បង', phase:'action', recovery:true, busy:false, signed:false, message:'សំណើចាស់ខ្វះភស្តុតាងសម្រាប់បន្ត។ មិនផ្ញើរូប ឬ Sign ស្ទួនទេ; រូបនៅរក្សាទុកក្នុងឧបករណ៍នេះ។' }
        ];
        createRoot(document.getElementById('root')).render(<PalmSignQueueModal />);
    ` }, bundle: true, write: false, format: 'iife', jsx: 'automatic', plugins: [{ name: 'queue-ui-fixtures', setup(b) {
        b.onResolve({ filter: /(?:features\/(?:palm-sign-outbox|queued-sign-photo)|core\/state|ui\/modal|^\.\/state)$/ }, args => ({ path: args.path.endsWith('core/state') || args.path === './state' ? 'core/state' : args.path.endsWith('ui/modal') ? 'ui/modal' : path.basename(args.path), namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
            let contents: string;
            if (args.path.endsWith('palm-sign-outbox')) contents = `import {createStore} from '${store}'; export const palmSignOutboxState=createStore('queue-layout',{rows:[],recoveryRows:[],message:''}); export const actOnQueuedSign=(id,action)=>{window.queueEvents.push([id,action]);if(action==='dismiss'||action==='show')palmSignOutboxState.recoveryRows=palmSignOutboxState.recoveryRows.map(r=>r.id===id?{...r,dismissed:action==='dismiss'}:r);}; export const refreshPalmSignQueue=()=>{};`;
            else if (args.path.endsWith('queued-sign-photo')) contents = `export const exportQueuedSignPhoto=(...args)=>window.queueEvents.push(['export',...args]);`;
            else if (args.path.endsWith('core/state')) contents = `import {createStore} from '${store}'; export const securityState=createStore('layout-security',{appIsLocked:false,appLockVeiled:false}); export const uiState=createStore('layout-ui',{modalDisplay:{palmSignQueueModal:'flex'},modalStack:['palmSignQueueModal'],modalKeyboardFit:null});`;
            else if (args.path.endsWith('ui/modal')) contents = `export const closeModal=()=>{}; export const openModalHelper=()=>{};`;
            else throw new Error('Unexpected fixture: ' + args.path);
            return { contents, loader: 'tsx', resolveDir: ROOT };
        });
    } }] });
    bundle = built.outputFiles[0].text;
    css = (await Promise.all(['app.css', 'react-root.css'].map(f => readFile(path.join(ROOT, 'src/styles', f), 'utf8')))).join('\n');
    browser = await chromium.launch({ executablePath: process.env.ZOEW_TEST_BROWSER || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
}, 30000);
afterAll(async () => { await browser?.close(); });
it.each([[320,800], [360,800], [390,844], [430,932], [768,1024], [1024,768], [1440,900], [640,360], [360,480]])('អេក្រង់ %sx%s៖ ម៉ឺនុយជ្រុងស្តាំ · មិនហៀរ · scroll ដល់បិទ', async (width, height) => {
    const page = await browser.newPage({ viewport: { width, height } });
    const realFonts = process.env.ZOEW_QUEUE_REAL_FONTS === '1';
    const fontHosts = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
    const fontResponses: { url: string; status: number; contentType: string }[] = [];
    page.on('response', response => {
        if (fontHosts.has(new URL(response.url()).hostname)) fontResponses.push({ url: response.url(), status: response.status(), contentType: response.headers()['content-type'] || '' });
    });
    const noOverflow = async () => expect(await page.locator('#palmSignQueueModal').evaluate(modal =>
        [...modal.querySelectorAll<HTMLElement>('section, p, button, summary, .modal-content, .sign-queue-actions')].some(el => el.scrollWidth > el.clientWidth + 1))).toBe(false);
    try {
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (realFonts && url.protocol === 'https:' && fontHosts.has(url.hostname)) return route.continue();
            return route.abort();
        });
        await page.setContent('<!doctype html><html lang="km"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>');
        await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle });
        if (realFonts) {
            await page.addStyleTag({ url: fontCssUrl });
            const fontChecks = await page.evaluate(async () => {
                const requests = [
                    ...[400, 500, 600, 700].map(weight => ({ family: 'Kantumruy Pro', weight, sample: 'ការងារ សង្គ្រោះ ពិនិត្យ រក្សាទុករូបដើម' })),
                    ...[400, 500, 600, 700, 800].map(weight => ({ family: 'Inter', weight, sample: 'Sign ZTO 0123456789' }))
                ];
                const checks = await Promise.all(requests.map(async request => {
                    const descriptor = `${request.weight} 16px "${request.family}"`;
                    const faces = await document.fonts.load(descriptor, request.sample);
                    return { ...request, loadedFaces: faces.length, statuses: faces.map(face => face.status), checked: document.fonts.check(descriptor, request.sample) };
                }));
                await document.fonts.ready;
                return checks;
            });
            fontChecks.forEach(check => {
                expect(check.loadedFaces).toBeGreaterThan(0);
                expect(check.statuses.every(status => status === 'loaded')).toBe(true);
                expect(check.checked).toBe(true);
            });
            expect(fontResponses.some(response => response.url === fontCssUrl && response.status === 200)).toBe(true);
            expect(fontResponses.some(response => new URL(response.url).hostname === 'fonts.gstatic.com' && response.status === 200)).toBe(true);
            expect(fontResponses.every(response => response.status === 200)).toBe(true);
        }
        await page.locator('#palmSignQueueModal h3').waitFor(); await page.evaluate(() => document.fonts.ready);
        await page.locator('#palmSignQueueModal').evaluate(async modal => {
            await Promise.all(modal.getAnimations({ subtree: true })
                .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
                .map(animation => animation.finished));
        });
        if (realFonts) {
            const cdp = await page.context().newCDPSession(page);
            await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
            const { root } = await cdp.send('DOM.getDocument');
            const renderedFonts = [];
            for (const selector of ['#palmSignQueueModal h3', '#palmSignQueueModal h4', '#palmSignQueueModal section [role="status"]']) {
                const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
                const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
                renderedFonts.push({ selector, fonts });
            }
            await cdp.detach();
            const fontsUsed = renderedFonts.flatMap(sample => sample.fonts);
            expect(fontsUsed.some(font => font.familyName === 'Kantumruy Pro' && font.isCustomFont && font.glyphCount > 0)).toBe(true);
            expect(fontsUsed.every(font => font.isCustomFont && ['Kantumruy Pro', 'Inter'].includes(font.familyName))).toBe(true);
        }
        expect(await page.locator('section').count()).toBe(2);
        expect(await page.locator('.sign-queue-actions').count()).toBe(0);
        expect(await page.locator('section [role="status"]').allTextContents()).toEqual(['Sign រួច · រូបមិនទាន់ផ្ទៀង', 'ZTO មិនទាន់ Sign']);
        const toggles = page.locator('.sign-queue-menu-toggle');
        for (const toggle of await toggles.all()) {
            const rect = await toggle.boundingBox();
            expect(rect!.width).toBeGreaterThanOrEqual(44); expect(rect!.height).toBeGreaterThanOrEqual(44);
            expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
        }
        await noOverflow();
        const compact = await page.locator('section').first().boundingBox();
        await toggles.first().click();
        expect(await toggles.first().getAttribute('aria-expanded')).toBe('true');
        expect(await page.locator('.sign-queue-actions').count()).toBe(1);
        expect(await page.locator('.sign-queue-actions button').count()).toBe(3);
        expect(await page.locator('details[open]').count()).toBe(0);
        const menu = await page.locator('.sign-queue-actions').boundingBox();
        expect(menu!.x).toBeGreaterThanOrEqual(12); expect(menu!.x + menu!.width).toBeLessThanOrEqual(width - 12);
        const opened = await page.locator('section').first().boundingBox();
        expect(opened!.height - compact!.height).toBeGreaterThanOrEqual(130);
        const geometry = await page.locator('.sign-queue-actions button').evaluateAll(buttons => buttons.map(b => {
            const r = b.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, height:r.height };
        }));
        geometry.forEach((rect, n) => { expect(rect.height).toBeGreaterThanOrEqual(44); if (n) expect(rect.top).toBeGreaterThanOrEqual(geometry[n-1].bottom); });
        const typeScale = await page.locator('#palmSignQueueModal').evaluate(modal => {
            const probe = document.createElement('span'); probe.style.fontSize = 'calc(1 * var(--fs-unit))'; modal.append(probe);
            const unit = parseFloat(getComputedStyle(probe).fontSize); probe.remove();
            const samples = [['.sign-queue-tabs button', 13], ['h4', 15], ['section p', 13], ['.sign-queue-secondary', 13], ['summary', 12]] as const;
            return { unit, sizes:samples.map(([selector, base]) => ({ base, actual:parseFloat(getComputedStyle(modal.querySelector(selector)!).fontSize) })) };
        });
        expect(typeScale.unit).toBeGreaterThanOrEqual(1);
        typeScale.sizes.forEach(size => expect(size.actual).toBeCloseTo(size.base * typeScale.unit, 2));
        await noOverflow();
        await page.getByRole('button', { name:'ពិនិត្យ (មិនផ្ញើ Sign)', exact:true }).click();
        expect(await page.evaluate(() => (window as any).queueEvents)).toEqual([['one', 'recover']]);
        expect(await page.locator('.sign-queue-actions').count()).toBe(0);
        await toggles.first().click(); await toggles.nth(1).click();
        expect(await toggles.first().getAttribute('aria-expanded')).toBe('false');
        expect(await toggles.nth(1).getAttribute('aria-expanded')).toBe('true');
        await toggles.nth(1).press('Escape'); expect(await page.locator('.sign-queue-actions').count()).toBe(0);
        await toggles.first().click(); await page.locator('summary').click();
        expect(await page.locator('details[open]').textContent()).toContain('Server');
        await page.getByRole('button', {name:'លុបអចិន្ត្រៃយ៍',exact:true}).click();
        expect(await page.evaluate(() => (window as any).queueEvents)).toEqual([['one','recover'], ['one','delete']]);
        await page.evaluate(() => { const s = (window as any).queueState; s.recoveryRows = s.recoveryRows.map((r: any) => ({ ...r, statusUnavailable:true })); });
        expect(await page.locator('section [role="status"]').allTextContents()).toEqual(['លើកមុន៖ Sign រួច · រូបមិនទាន់ផ្ទៀង', 'លើកមុន៖ ZTO មិនទាន់ Sign']);
        expect(await page.locator('section > .sign-queue-hint').allTextContents()).toContain('ពិនិត្យ ZTO ថ្មីមិនបាន');
        await noOverflow();
        await page.evaluate(() => { const s = (window as any).queueState; s.recoveryRows = s.recoveryRows.map((r: any) => r.id === 'two' ? {...r, signed:undefined} : r); });
        expect(await page.locator('section [role="status"]').allTextContents()).toEqual(['លើកមុន៖ Sign រួច · រូបមិនទាន់ផ្ទៀង', 'ពិនិត្យស្ថានភាព ZTO មិនបាន']);
        const shell = await page.locator('.modal-content').evaluate(card => {
            const r = card.getBoundingClientRect(), style = getComputedStyle(card);
            const standard = document.createElement('div'); standard.className = 'modal-content'; document.body.append(standard);
            const shared = getComputedStyle(standard); const result = {x:r.x,y:r.y,right:r.right,bottom:r.bottom,maxWidth:style.maxWidth,maxHeight:style.maxHeight,sharedMaxWidth:shared.maxWidth,sharedMaxHeight:shared.maxHeight,scroll:style.overflowY}; standard.remove(); return result;
        });
        expect(shell.maxWidth).toBe(shell.sharedMaxWidth); expect(shell.maxHeight).toBe(shell.sharedMaxHeight);
        expect(shell.scroll).toBe('auto'); expect(shell.x).toBeGreaterThanOrEqual(12); expect(shell.right).toBeLessThanOrEqual(width - 12);
        expect(shell.y).toBeGreaterThanOrEqual(0); expect(shell.bottom).toBeLessThanOrEqual(height);
        await page.locator('.modal-content').evaluate(card => { card.scrollTop = card.scrollHeight; });
        const close = await page.getByRole('button', {name:'បិទ',exact:true}).boundingBox();
        expect(close!.y).toBeGreaterThanOrEqual(0); expect(close!.y + close!.height).toBeLessThanOrEqual(height);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        await page.evaluate(() => { (window as any).queueState.recoveryRows = []; });
        expect(await page.locator('section').count()).toBe(0); expect(await page.locator('[aria-pressed]').count()).toBe(0);
    } finally { await page.close(); }
}, 30000);
