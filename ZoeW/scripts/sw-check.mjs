/** ផ្ទៀងផ្ទាត់ថា Service Worker ចុះឈ្មោះ និង cache សំបកពិត។ */
import { chromium } from 'playwright-core';
import { serveDir } from './serve.mjs';
import { assertCurrentBuild } from './assert-current-build.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.DIST_DIR || path.join(HERE, '..', 'dist');
const { cacheVersion } = assertCurrentBuild(path.join(HERE, '..'), DIST);
const { server, port } = await serveDir(DIST);
const browser = await chromium.launch({ executablePath: process.env.ZOEW_TEST_BROWSER || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.route('**', (r) => (r.request().url().includes('127.0.0.1') ? r.continue() : r.abort()));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.evaluate(async () => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        if ((await navigator.serviceWorker.getRegistration())?.active?.state === 'activated') return;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
});

const info = await page.evaluate(async (expectedCache) => {
    const reg = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    const cache = keys.includes(expectedCache) ? await caches.open(expectedCache) : null;
    const cached = cache ? (await cache.keys()).map((r) => new URL(r.url).pathname).sort() : [];
    return { registered: !!reg, active: reg?.active?.state === 'activated', cacheNames: keys, cachedCount: cached.length, cached };
}, cacheVersion);
console.log(JSON.stringify({ registered: info.registered, active: info.active, cacheNames: info.cacheNames, cachedCount: info.cachedCount }, null, 2));
console.log('សំបកដែល cache ៖');
info.cached.forEach((p) => console.log('   ' + p));

await browser.close();
server.close();
const ok = info.registered && info.active && info.cacheNames.includes(cacheVersion) && info.cachedCount >= 8;
console.log(ok ? '\n✅ Service Worker ចុះឈ្មោះ និង cache សំបកពេញលេញ' : '\n❌ Service Worker មិនពេញលេញ');
process.exit(ok ? 0 : 1);
