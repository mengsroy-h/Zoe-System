/** ផ្ទៀងផ្ទាត់ថា Service Worker ចុះឈ្មោះ និង cache សំបកពិត។ */
import { chromium } from 'playwright-core';
import { serveDir } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { server, port } = await serveDir(process.env.DIST_DIR || path.join(HERE, '..', 'dist'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.route('**', (r) => (r.request().url().includes('127.0.0.1') ? r.continue() : r.abort()));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(4000);

const info = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    const cache = keys.length ? await caches.open(keys[0]) : null;
    const cached = cache ? (await cache.keys()).map((r) => new URL(r.url).pathname).sort() : [];
    return { registered: !!reg, active: !!(reg && (reg.active || reg.installing || reg.waiting)), cacheNames: keys, cachedCount: cached.length, cached };
});
console.log(JSON.stringify({ registered: info.registered, active: info.active, cacheNames: info.cacheNames, cachedCount: info.cachedCount }, null, 2));
console.log('សំបកដែល cache ៖');
info.cached.forEach((p) => console.log('   ' + p));

await browser.close();
server.close();
const ok = info.registered && info.active && info.cachedCount >= 8;
console.log(ok ? '\n✅ Service Worker ចុះឈ្មោះ និង cache សំបកពេញលេញ' : '\n❌ Service Worker មិនពេញលេញ');
process.exit(ok ? 0 : 1);
