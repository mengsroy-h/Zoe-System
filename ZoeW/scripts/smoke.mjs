import { chromium } from 'playwright-core';
import { serveDir } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const { server, port } = await serveDir(path.join(ROOT, '..', 'dist'));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (e) => {
        (window.__rejections ||= []).push(String((e.reason && e.reason.message) || e.reason));
    });
});
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => ({
    ids: document.querySelectorAll('[id]').length,
    root: !!document.getElementById('root'),
    navbar: !!document.querySelector('.app-navbar'),
    pages: !!document.getElementById('appPages'),
    modals: document.querySelectorAll('.modal').length,
    drawerGroups: document.querySelectorAll('.drawer-group').length,
    rejections: window.__rejections || [],
    versionLabel: (document.getElementById('appVersionLabel') || {}).textContent || null,
    bodyChildren: document.body.children.length
}));

console.log(JSON.stringify(info, null, 2));
const noisy = errors.filter((e) => !/favicon|sentry|gstatic|fonts\.googleapis|ERR_/i.test(e));
if (noisy.length) { console.log('\n⛔ កំហុស runtime ៖'); noisy.forEach((e) => console.log('   ' + e)); }
else console.log('\n✅ គ្មានកំហុស runtime');

await browser.close();
server.close();
process.exit(noisy.length ? 1 : 0);
