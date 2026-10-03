// ⛔ cache `zoe_docs` របស់ហាង Supabase (IndexedDB) ក្នុង Chromium ពិត — ប្រភព TS ពិត (esbuild) មិនមែនច្បាប់ចម្លង។
//
// cache នេះសម្រាប់កាត់ egress តែប៉ុណ្ណោះ (Free 5 GB/ខែ) ៖ បើក App ម្តងទៀត ➜ ទាញតែ delta ពី cursor ជំនួសទិន្នន័យទាំងមូល។
// vitest (`ZoeW/tests/supabase-pull-paging.test.ts`) វាស់ adapter ជាមួយ cache ក្លែងក្នុងសតិ · emu/supabase-adapter-parity វាស់ SQL ពិត។
// ឯកសារនេះវាស់ផ្នែកដែលពួកវាមើលមិនឃើញ ៖ IndexedDB **ពិត** និងថ្នេរ adapter ↔ cache ពិត។
//
//   ១. រក្សាទុក ➜ ផ្ទុកវិញ (រួមទាំងក្រោយ reload ទំព័រ) ស្មើបេះបិទ · scope ផ្សេង ➜ null · កំណត់ត្រាតែមួយ (scope ថ្មីលុបចាស់)
//   ២. កំណត់ត្រាខូច/កំណែផ្សេង ➜ null (មិនជឿ) · clear ➜ null · forgetSupabaseDocsCache() លុប database ទាំងមូល (ចាកចេញ)
//   ៣. ⛔ storage ត្រូវរាំង (getter `indexedDB` បោះ) ➜ គ្រប់ប្រតិបត្តិការ fail-open ភ្លាម · គ្មាន unhandledrejection
//   ៤. ⛔ `indexedDB.open()` ព្យួរ ➜ load ដោះស្រាយ null ក្នុងពិដាន (ព្យួរ ≠ ធ្លាក់)
//   ៥. ថ្នេរ ៖ adapter ពិត (`createSupabaseDatabase`) + cache IndexedDB ពិត + transport ក្លែង ៖ សម័យ ១ ទាញពេញ ➜ រក្សាទុក ➜
//      សម័យ ២ (ទំព័រថ្មី) ទាញតែពី cursor · listener ស្មើ server · ចាកចេញ ➜ cache ទទេ
'use strict';
process.exitCode = 1;

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = process.env.DOCSCACHE_APP_DIR ? path.resolve(process.env.DOCSCACHE_APP_DIR) : path.join(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : ROOT;
const SRC = path.join(ROOT, 'ZoeW', 'src', 'services');
const MODULES = [path.join(REPO, 'ZoeW', 'node_modules'), path.join(ROOT, 'ZoeW', 'node_modules'), path.join(__dirname, '..', 'ZoeW', 'node_modules')]
    .find((d) => fs.existsSync(path.join(d, 'esbuild')));
const CHROME = process.env.DOCSCACHE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let pass = 0, fail = 0;
function check(cond, label, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 1500) : '')); }
}
function finish(skip) {
    if (skip) console.log('SKIP ' + skip);
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : (skip ? 'PARTIAL PASS (' + pass + '; SKIP 1)' : '✅ ជោគជ័យទាំងអស់ ' + pass)));
    process.exitCode = fail ? 1 : 0;
}

console.log('=== supabase-docs-cache ៖ cache zoe_docs លើ IndexedDB ពិត (Chromium) · ថ្នេរ adapter ↔ cache ===');

const SOURCES = ['supabase-docs-cache.ts', 'supabase-rtdb.ts'].map((f) => path.join(SRC, f));
const missing = SOURCES.filter((f) => !fs.existsSync(f));
check(!missing.length, 'ប្រភព TS មាន (supabase-docs-cache.ts · supabase-rtdb.ts)', missing);

async function bundle() {
    const esbuild = require(path.join(MODULES, 'esbuild'));
    const entry = path.join(os.tmpdir(), 'docscache-entry-' + process.pid + '.ts');
    fs.writeFileSync(entry, 'export { createIdbDocsCache, forgetSupabaseDocsCache, docsCacheRecordIsValid, SB_DOCS_CACHE_DB, SB_DOCS_CACHE_TIMEOUT_MS } from '
        + JSON.stringify(path.join(SRC, 'supabase-docs-cache.ts')) + ';\n'
        + 'export { createSupabaseDatabase } from ' + JSON.stringify(path.join(SRC, 'supabase-rtdb.ts')) + ';\n');
    try {
        const out = await esbuild.build({ entryPoints: [entry], bundle: true, platform: 'browser', format: 'iife', globalName: 'ZoeDocsCache',
            write: false, target: 'es2020', logLevel: 'silent' });
        return out.outputFiles[0].text;
    } finally {
        try { fs.unlinkSync(entry); } catch (e) {}
    }
}

function serve(js) {
    return new Promise((resolve) => {
        const s = http.createServer((req, res) => {
            if (req.url.split('?')[0] === '/cache.js') {
                res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
                res.end(js);
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
            res.end('<!doctype html><meta charset="utf-8"><script src="/cache.js"></script>');
        });
        s.listen(0, '127.0.0.1', () => resolve(s));
    });
}

const REJECTION_WATCH = `window.__rejections = [];
window.addEventListener('unhandledrejection', function (ev) {
    var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
    window.__rejections.push(m);
});`;

async function main() {
    if (missing.length) return finish();
    let chromium;
    try { chromium = require(path.join(MODULES || '', 'playwright-core')).chromium; } catch (e) {
        try { chromium = require('playwright-core').chromium; } catch (x) { return finish('ត្រូវការ playwright-core (npm ci --prefix ZoeW)'); }
    }
    if (!MODULES) return finish('ត្រូវការ esbuild (npm ci --prefix ZoeW)');
    if (!fs.existsSync(CHROME)) return finish('រកមិនឃើញ Chromium នៅ ' + CHROME);
    const js = await bundle();
    check(/createIdbDocsCache/.test(js) && /zoew_sb_docs_v1|SB_DOCS_CACHE_DB/.test(js), 'bundle ប្រភព TS ពិត (esbuild)');
    const server = await serve(js);
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    try {
        console.log('\n── ១–២. រក្សាទុក · ផ្ទុក · scope · កំណត់ត្រាខូច · លុប ──');
        const ctx = await browser.newContext({ serviceWorkers: 'block' });
        const page = await ctx.newPage();
        await page.addInitScript(REJECTION_WATCH);
        await page.goto(base + '/');
        const r1 = await page.evaluate(async () => {
            const M = window.ZoeDocsCache;
            const cache = M.createIdbDocsCache();
            const docs = [];
            for (let i = 1; i <= 700; i++) docs.push(['zoew_scan_history_cod_dod', 'item' + i, { phone: '0' + (12000000 + i), cod: i / 4, barcodes: { ['B' + i]: { cod: i, isClosed: i % 2 === 0 } } }, i]);
            const rec = { v: 1, scope: 'https://p.supabase.co|u1', tenant: 'T1', cursor: 700, docs };
            const t0 = performance.now();
            const saved = await cache.save(rec.scope, rec);
            const loaded = await cache.load(rec.scope);
            const ms = Math.round(performance.now() - t0);
            const other = await cache.load('https://p.supabase.co|u2');
            const rec2 = { v: 1, scope: 'https://p.supabase.co|u2', tenant: 'T2', cursor: 3, docs: [['r', 'k', { a: 1 }, 3]] };
            const saved2 = await cache.save(rec2.scope, rec2);
            const firstAfter = await cache.load(rec.scope);
            const second = await cache.load(rec2.scope);
            return { saved, same: JSON.stringify(loaded) === JSON.stringify(rec), ms, other, saved2, firstAfter, second: JSON.stringify(second) === JSON.stringify(rec2) };
        });
        check(r1.saved === true && r1.same, 'រក្សាទុក ➜ ផ្ទុកវិញស្មើបេះបិទ (៧០០ doc · object ជាន់)', r1);
        check(r1.ms < 3000, 'រក្សាទុក + ផ្ទុក ៧០០ doc < ៣ វិ. (' + r1.ms + ' ms)', r1.ms);
        check(r1.other === null, 'scope ផ្សេង (គណនីផ្សេង) ➜ null');
        check(r1.saved2 === true && r1.firstAfter === null && r1.second, 'កំណត់ត្រាតែមួយ ៖ រក្សាទុក scope ថ្មី ➜ scope ចាស់បាត់', r1);
        await page.reload();
        const r2 = await page.evaluate(async () => {
            const M = window.ZoeDocsCache;
            const cache = M.createIdbDocsCache();
            const kept = await cache.load('https://p.supabase.co|u2');
            const db = await new Promise((res) => { const q = indexedDB.open(M.SB_DOCS_CACHE_DB); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
            await new Promise((res) => { const tx = db.transaction('c', 'readwrite'); tx.objectStore('c').put({ v: 2, scope: 'bad', tenant: 'T', cursor: 1, docs: [] }, 'bad'); tx.oncomplete = res; tx.onerror = res; });
            await new Promise((res) => { const tx = db.transaction('c', 'readwrite'); tx.objectStore('c').put({ v: 1, scope: 'nul', tenant: 'T', cursor: 5, docs: [['r', 'k', null, 5]] }, 'nul'); tx.oncomplete = res; tx.onerror = res; });
            await new Promise((res) => { const tx = db.transaction('c', 'readwrite'); tx.objectStore('c').put({ v: 1, scope: 'other', tenant: 'T', cursor: 5, docs: [] }, 'mine'); tx.oncomplete = res; tx.onerror = res; });
            db.close();
            const wrongScope = await cache.load('mine');
            const badVersion = await cache.load('bad');
            const nullDoc = await cache.load('nul');
            const cleared = await cache.clear();
            const afterClear = await cache.load('https://p.supabase.co|u2');
            await cache.save('s', { v: 1, scope: 's', tenant: 'T', cursor: 1, docs: [] });
            const forgot = await M.forgetSupabaseDocsCache();
            const names = (await indexedDB.databases()).map((d) => d.name);
            return { kept: !!kept && kept.tenant === 'T2', wrongScope, badVersion, nullDoc, cleared, afterClear, forgot, names, dbName: M.SB_DOCS_CACHE_DB };
        });
        check(r2.kept, 'reload ទំព័រ ➜ cache នៅ (IndexedDB ពិតរក្សាទុកពិត)', r2);
        check(r2.badVersion === null && r2.nullDoc === null && r2.wrongScope === null, 'កំណត់ត្រាកំណែផ្សេង · doc តម្លៃ null · scope ក្នុងកំណត់ត្រាខុសពីសោ ➜ null (មិនជឿ)', r2);
        check(r2.cleared === true && r2.afterClear === null, 'clear() ➜ ទទេ', r2);
        check(r2.forgot === true && !r2.names.includes(r2.dbName), 'forgetSupabaseDocsCache() (ចាកចេញ) ➜ database ' + r2.dbName + ' បាត់ពី indexedDB.databases()', r2);
        const rej1 = await page.evaluate(() => window.__rejections);
        check(rej1.length === 0, 'គ្មាន unhandledrejection', rej1);
        await ctx.close();

        console.log('\n── ៣. ⛔ storage ត្រូវរាំង (getter indexedDB បោះ) ──');
        const ctxB = await browser.newContext({ serviceWorkers: 'block' });
        const pageB = await ctxB.newPage();
        await pageB.addInitScript(REJECTION_WATCH);
        await pageB.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } }); });
        await pageB.goto(base + '/');
        const rb = await pageB.evaluate(async () => {
            const M = window.ZoeDocsCache;
            const cache = M.createIdbDocsCache();
            const t0 = performance.now();
            const out = { load: await cache.load('s'), save: await cache.save('s', { v: 1, scope: 's', tenant: 'T', cursor: 1, docs: [] }), clear: await cache.clear(), forget: await M.forgetSupabaseDocsCache() };
            out.ms = Math.round(performance.now() - t0);
            await new Promise((r) => setTimeout(r, 50));
            out.rejections = window.__rejections;
            return out;
        });
        check(rb.load === null && rb.save === false && rb.clear === false && rb.forget === false, 'storage ត្រូវរាំង ➜ load null · save/clear/forget false (fail-open)', rb);
        check(rb.ms < 500 && rb.rejections.length === 0, 'storage ត្រូវរាំង ➜ ភ្លាម (' + rb.ms + ' ms) · គ្មាន unhandledrejection', rb);
        await ctxB.close();

        console.log('\n── ៤. ⛔ indexedDB.open() ព្យួរ ──');
        const ctxH = await browser.newContext({ serviceWorkers: 'block' });
        const pageH = await ctxH.newPage();
        await pageH.addInitScript(() => { IDBFactory.prototype.open = function () { return {}; }; });
        await pageH.goto(base + '/');
        const rh = await pageH.evaluate(async () => {
            const M = window.ZoeDocsCache;
            const t0 = performance.now();
            const v = await M.createIdbDocsCache().load('s');
            return { v, ms: Math.round(performance.now() - t0), ceiling: M.SB_DOCS_CACHE_TIMEOUT_MS };
        });
        check(rh.v === null && rh.ms >= rh.ceiling - 200 && rh.ms <= rh.ceiling * 2 + 500, 'open() ព្យួរ ➜ load ដោះស្រាយ null ក្នុងពិដាន (' + rh.ms + ' ms · ពិដាន ' + rh.ceiling + ')', rh);
        await ctxH.close();

        console.log('\n── ៥. ថ្នេរ ៖ adapter ពិត + IndexedDB ពិត ──');
        const ctxS = await browser.newContext({ serviceWorkers: 'block' });
        const pageS = await ctxS.newPage();
        await pageS.addInitScript(REJECTION_WATCH);
        await pageS.goto(base + '/');
        const SEAM = `(async (phase) => {
            const M = window.ZoeDocsCache;
            const HIST = 'zoew_scan_history_cod_dod';
            const head = phase === 1 ? 5 : 7;
            const rows = [];
            for (let i = 1; i <= 5; i++) rows.push({ r: HIST, k: 'i' + i, v: { n: i }, s: i });
            if (phase === 2) { rows[1] = { r: HIST, k: 'i2', v: null, s: 6 }; rows.push({ r: HIST, k: 'i6', v: { n: 6 }, s: 7 }); }
            const calls = [];
            const transport = {
                rpc: async (fn, args) => {
                    calls.push(args.p_since);
                    const since = args.p_since > head ? 0 : args.p_since;
                    const full = since === 0;
                    const out = rows.filter((x) => x.s > since && (!full || x.v !== null)).sort((a, b) => a.s - b.s);
                    return { seq: head, more: false, reset: full, head, tenant: 'T1', now: Date.now(), rows: out };
                },
                ping: async () => true,
                subscribe: () => () => {}
            };
            const db = M.createSupabaseDatabase(transport, { onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {} },
                { docsCache: M.createIdbDocsCache(), docsCacheFirstSaveMs: 20, pollFallbackMs: 600000 });
            let view = 'unset';
            db.onValue(db.ref(HIST), (s) => { view = s.val(); });
            db.setAuthed(true, 'https://p.supabase.co|u1');
            for (let i = 0; i < 100 && (view === 'unset'); i++) await new Promise((r) => setTimeout(r, 20));
            await new Promise((r) => setTimeout(r, 200));
            const stored = await M.createIdbDocsCache().load('https://p.supabase.co|u1');
            let afterSignOut = 'n/a';
            if (phase === 2) {
                db.resetForSignOut();
                await new Promise((r) => setTimeout(r, 100));
                afterSignOut = await M.createIdbDocsCache().load('https://p.supabase.co|u1');
            }
            db.close();
            return { calls, keys: view && view !== 'unset' ? Object.keys(view).sort() : view, storedCursor: stored && stored.cursor, afterSignOut };
        })`;
        const s1 = await pageS.evaluate(SEAM + '(1)');
        check(s1.calls[0] === 0 && s1.keys.join() === 'i1,i2,i3,i4,i5' && s1.storedCursor === 5, 'សម័យ ១ ៖ ទាញពេញពី 0 ➜ IndexedDB ពិតរក្សាទុក cursor 5', s1);
        await pageS.reload();
        const s2 = await pageS.evaluate(SEAM + '(2)');
        check(s2.calls[0] === 5 && s2.calls.length === 1 && s2.keys.join() === 'i1,i3,i4,i5,i6', 'សម័យ ២ (ទំព័រថ្មី) ៖ ទាញតែពី cursor 5 · listener ស្មើ server (i2 លុប · i6 ថ្មី)', s2);
        check(s2.storedCursor === 7 && s2.afterSignOut === null, 'cache ឡើង cursor 7 · ចាកចេញ ➜ cache ទទេ', s2);
        const rejS = await pageS.evaluate(() => window.__rejections);
        check(rejS.length === 0, 'ថ្នេរ ៖ គ្មាន unhandledrejection', rejS);
        await ctxS.close();
    } finally {
        await browser.close();
        server.close();
    }
    return finish();
}

main().catch((e) => {
    check(false, 'ការវាស់មិនគាំង', String(e && e.stack || e));
    finish();
});
