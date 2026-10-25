// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright-core';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
let browser: Browser, bundle: string, css: string;
beforeAll(async () => {
    const store = path.join(ROOT, 'src/core/store.ts');
    const built = await build({ stdin: { resolveDir: ROOT, loader: 'tsx', contents: `
        import React from 'react'; import { createRoot } from 'react-dom/client';
        import { PalmSignQueueModal } from './src/app/components/modals/PalmSignQueueModal';
        import { palmSignOutboxState } from './src/features/palm-sign-outbox';
        window.queueEvents = []; window.queueState = palmSignOutboxState;
        palmSignOutboxState.recoveryRows = [
            { id:'one', code:'77130500000012', signMan:'សុខា', phase:'action', recovery:true, busy:false, signed:true, photoVerified:false, message:'Sign រួចតែរូបដើមរបស់ការងារនេះមិនទាន់មានភស្តុតាង។ រូបនៅរក្សាទុក មិនផ្ញើស្ទួន។' },
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
it.each([[320,800], [360,800], [390,844], [768,1024], [1440,900], [640,360], [360,480]])('អេក្រង់ %sx%s៖ modal រួម · ប៊ូតុងមិនប៉ះ · អក្សរខ្មែរមិនហៀរ និង scroll ដល់បិទ', async (width, height) => {
    const page = await browser.newPage({ viewport: { width, height } });
    try {
        await page.route('**/*', route => route.abort());
        await page.setContent('<!doctype html><html lang="km"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>');
        await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle });
        await page.locator('#palmSignQueueModal h3').waitFor(); await page.evaluate(() => document.fonts.ready);
        const screenshotDir = process.env.ZOEW_QUEUE_SCREENSHOT_DIR;
        if (screenshotDir) { await mkdir(screenshotDir, { recursive: true }); await page.screenshot({ animations: 'disabled', path: path.join(screenshotDir, `queue-${width}x${height}-active.png`) }); }
        expect(await page.locator('section').count()).toBe(0);
        const retained = page.getByRole('button', { name: /^រក្សាទុក/ });
        await retained.click(); expect(await retained.getAttribute('aria-pressed')).toBe('true');
        expect(await page.locator('section').count()).toBe(2);
        expect(await page.locator('section [role="status"]').allTextContents()).toEqual(['Sign រួច · រូបមិនទាន់ផ្ទៀង', 'ZTO មិនទាន់ Sign']);
        expect(await page.locator('details[open]').count()).toBe(0);
        const typeScale = await page.locator('#palmSignQueueModal').evaluate(modal => {
            const probe = document.createElement('span'); probe.style.fontSize = 'calc(1 * var(--fs-unit))'; modal.append(probe);
            const unit = parseFloat(getComputedStyle(probe).fontSize); probe.remove();
            const samples = [['.sign-queue-tabs button', 13], ['h4', 15], ['section p', 13], ['.sign-queue-secondary', 13], ['summary', 12], ['.sign-queue-help p', 12]] as const;
            return { unit, sizes: samples.map(([selector, base]) => ({ base, actual: parseFloat(getComputedStyle(modal.querySelector(selector)!).fontSize) })) };
        });
        expect(typeScale.unit).toBeGreaterThanOrEqual(1);
        for (const size of typeScale.sizes) expect(size.actual).toBeCloseTo(size.base * typeScale.unit, 2);
        if (screenshotDir) await page.screenshot({ animations: 'disabled', path: path.join(screenshotDir, `queue-${width}x${height}-retained.png`) });
        const geometry = await page.locator('#palmSignQueueModal').evaluate(modal => {
            const cards = [...modal.querySelectorAll('section')];
            return { overflow: [...modal.querySelectorAll<HTMLElement>('section, button, summary, .modal-content')].some(el => el.scrollWidth > el.clientWidth + 1),
                buttons: cards.map(card => [...card.querySelectorAll('button')].filter(b => !b.closest('details:not([open])')).map(b => { const r = b.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height, right:r.right, bottom:r.bottom }; })) };
        });
        expect(geometry.overflow).toBe(false);
        for (const buttons of geometry.buttons) {
            expect(buttons).toHaveLength(2);
            for (const b of buttons) { expect(b.h).toBeGreaterThanOrEqual(44); expect(b.x).toBeGreaterThanOrEqual(0); expect(b.right).toBeLessThanOrEqual(width); }
            expect(buttons[1].y - buttons[0].bottom).toBeGreaterThanOrEqual(8);
            expect(buttons[0].x).toBe(buttons[1].x); expect(buttons[0].w).toBe(buttons[1].w);
        }
        if (screenshotDir) await page.screenshot({ animations: 'disabled', path: path.join(screenshotDir, `queue-${width}x${height}-retained.png`) });
        const shell = await page.locator('.modal-content').evaluate(card => {
            const r = card.getBoundingClientRect(), style = getComputedStyle(card);
            const standard = document.createElement('div'); standard.className = 'modal-content'; document.body.append(standard);
            const shared = getComputedStyle(standard); const result = { x:r.x, y:r.y, right:r.right, bottom:r.bottom, maxWidth:style.maxWidth, maxHeight:style.maxHeight, sharedMaxWidth:shared.maxWidth, sharedMaxHeight:shared.maxHeight, scroll:style.overflowY };
            standard.remove(); return result;
        });
        expect(shell.maxWidth).toBe(shell.sharedMaxWidth); expect(shell.maxHeight).toBe(shell.sharedMaxHeight);
        expect(shell.scroll).toBe('auto'); expect(shell.x).toBeGreaterThanOrEqual(12); expect(shell.right).toBeLessThanOrEqual(width-12);
        expect(shell.y).toBeGreaterThanOrEqual(0); expect(shell.bottom).toBeLessThanOrEqual(height);
        await page.locator('.modal-content').evaluate(card => { card.scrollTop=card.scrollHeight; });
        const close = await page.getByRole('button', {name:'បិទ', exact:true}).boundingBox();
        expect(close!.y).toBeGreaterThanOrEqual(0); expect(close!.y+close!.height).toBeLessThanOrEqual(height);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        if(screenshotDir) await page.screenshot({ animations: 'disabled',path:path.join(screenshotDir, `queue-${width}x${height}-footer.png`)});
        await page.locator('.modal-content').evaluate(card => {card.scrollTop=0;});
        await page.getByRole('button', { name: /ពិនិត្យ/ }).first().click();
        expect(await page.evaluate(() => (window as any).queueEvents)).toEqual([['one', 'recover']]);
        await page.locator('summary').first().click(); expect(await page.locator('details[open]').count()).toBe(1);
        expect(await page.locator('details[open]').textContent()).toContain('មិនផ្ញើស្ទួន');
        await page.getByRole('button', {name:'ដកពីបញ្ជីត្រូវពិនិត្យ',exact:true}).click();
        expect(await page.evaluate(() => (window as any).queueEvents)).toEqual([['one','recover']]);
        await page.getByRole('button', {name:'បញ្ជាក់ដកពីបញ្ជី',exact:true}).scrollIntoViewIfNeeded();
        if(screenshotDir) await page.screenshot({ animations: 'disabled',path:path.join(screenshotDir, `queue-${width}x${height}-confirm.png`)});
        await page.getByRole('button', {name:'បញ្ជាក់ដកពីបញ្ជី',exact:true}).click();
        expect(await page.locator('section').count()).toBe(1);
        await page.evaluate(() => {const s=(window as any).queueState; s.recoveryRows=s.recoveryRows.map((r: any)=>({...r,dismissed:true}));});
        await page.getByRole('button', {name:/បង្ហាញរូបដែលដកពីបញ្ជី/}).waitFor();
        expect(await page.locator('section').count()).toBe(0);
        await page.locator('.modal-content').evaluate(card=>{card.scrollTop=0;});
        if(screenshotDir) await page.screenshot({ animations: 'disabled',path:path.join(screenshotDir, `queue-${width}x${height}-cleared.png`)});
        await page.getByRole('button', {name:/បង្ហាញរូបដែលដកពីបញ្ជី/}).click();
        expect(await page.locator('section').count()).toBe(2);
        if(screenshotDir) await page.screenshot({ animations: 'disabled',path:path.join(screenshotDir, `queue-${width}x${height}-originals.png`)});
    } finally { await page.close(); }
}, 30000);
