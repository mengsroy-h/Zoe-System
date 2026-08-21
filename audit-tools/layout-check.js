let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const CHROME = process.env.LAYOUT_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs');
const http = require('http');
const path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.LAYOUT_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const SIZES = [{ w: 320, h: 568 }, { w: 360, h: 640 }, { w: 412, h: 780 }, { w: 768, h: 1024 }];

let pass = 0, fail = 0;
const ok = (n) => { console.log('  ok    ' + n); pass++; };
const bad = (n, d) => { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; };
const check = (c, n, d) => (c ? ok(n) : bad(n, d));

function serve(dir, port) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(port, () => res(s));
    });
}

// ធាតុដែលមានហេតុផលឲ្យលើសទទឹង (តារាង/ដុំកូដ ដែលមាន overflow-x ផ្ទាល់ខ្លួន)
const ALLOW_OVERFLOW = /^(TABLE|PRE|CODE)$/;

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    let port = 8660;
    for (const app of ['ZoeAdmin', 'ZoeW', 'Zoescan', 'ZoeKeyGen']) {
        console.log('\n=== ' + app + ' ===');
        const dir = path.join(ROOT, app);
        const server = await serve(dir, port);
        for (const size of SIZES) {
            const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h } });
            const page = await ctx.newPage();
            page.on('dialog', (d) => d.dismiss().catch(() => {}));
            await page.route('**', (route) => route.request().url().startsWith('http://127.0.0.1:' + port) ? route.continue() : route.abort());
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(1200);

            const report = await page.evaluate((allowSrc) => {
                const allow = new RegExp(allowSrc);
                const out = { pageScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, offenders: [], tiny: [], modals: [] };
                const vw = document.documentElement.clientWidth;
                const seen = new Set();
                document.querySelectorAll('*').forEach((el) => {
                    const cs = getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') return;
                    const r = el.getBoundingClientRect();
                    if (r.width === 0 && r.height === 0) return;
                    // លើសគែមស្តាំ ឬចេញក្រៅឆ្វេង
                    if ((r.right > vw + 1 || r.left < -1) && !allow.test(el.tagName)) {
                        let p = el.parentElement, scrollable = false;
                        while (p) {
                            const pcs = getComputedStyle(p);
                            if (/(auto|scroll)/.test(pcs.overflowX)) { scrollable = true; break; }
                            p = p.parentElement;
                        }
                        if (!scrollable) {
                            const key = el.tagName + '#' + (el.id || '') + '.' + (el.className || '').toString().slice(0, 40);
                            if (!seen.has(key)) { seen.add(key); out.offenders.push({ key, right: Math.round(r.right), vw }); }
                        }
                    }
                    // គោលដៅចុចតូចពេក (ប៊ូតុងពិត ដែលមើលឃើញ)
                    if ((el.tagName === 'BUTTON' || (el.tagName === 'A' && el.getAttribute('href'))) && r.width > 0 && (r.height < 24 || r.width < 24)) {
                        const key = el.tagName + '#' + (el.id || '') + '.' + (el.className || '').toString().slice(0, 30);
                        if (!seen.has('t' + key)) { seen.add('t' + key); out.tiny.push({ key, w: Math.round(r.width), h: Math.round(r.height) }); }
                    }
                });
                return out;
            }, ALLOW_OVERFLOW.source);

            const label = app + ' @' + size.w + 'px';
            check(!report.pageScrollX, label + ': គ្មាន scroll ផ្តេកលើទំព័រ');
            check(report.offenders.length === 0, label + ': គ្មានធាតុលើសទទឹងអេក្រង់',
                report.offenders.slice(0, 4).map((o) => o.key + ' right=' + o.right + ' vw=' + o.vw).join('\n        '));
            if (report.tiny.length) {
                console.log('  note  ' + label + ': ប៊ូតុងតូចជាង 24px ' + report.tiny.length + ' (ជម្រើសរចនា មិនរាប់ជាកំហុស)');
            }

            // modal នីមួយៗ ត្រូវបើកដាច់ដោយឡែក — នេះជាកន្លែងកំហុស CSS ធ្លាប់លាក់ខ្លួន
            const modalIds = await page.evaluate(() => [...document.querySelectorAll('.modal')].map((m) => m.id).filter(Boolean));
            const modalBad = [];
            for (const mid of modalIds) {
                const r = await page.evaluate((id) => {
                    const m = document.getElementById(id);
                    if (!m) return null;
                    const prevAll = [...document.querySelectorAll('.modal')].map((x) => [x, x.style.display]);
                    prevAll.forEach(([x]) => { x.style.display = 'none'; });
                    m.style.display = 'flex';
                    const vw = document.documentElement.clientWidth;
                    const vh = document.documentElement.clientHeight;
                    let over = null;
                    const box = m.querySelector('.modal-content') || m.firstElementChild;
                    m.querySelectorAll('*').forEach((el) => {
                        if (over) return;
                        const cs = getComputedStyle(el);
                        if (cs.display === 'none' || cs.visibility === 'hidden') return;
                        const b = el.getBoundingClientRect();
                        if (b.width === 0 && b.height === 0) return;
                        if (b.right > vw + 1 || b.left < -1) {
                            let p = el.parentElement, scrollable = false;
                            while (p && p !== m) {
                                if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) { scrollable = true; break; }
                                p = p.parentElement;
                            }
                            if (!scrollable) over = el.tagName + '#' + (el.id || '') + '.' + String(el.className || '').slice(0, 30) + ' right=' + Math.round(b.right) + '/' + vw;
                        }
                    });
                    // ប្រអប់ត្រូវនៅក្នុងអេក្រង់ ហើយអាចរមូរបាន បើវាខ្ពស់ជាង
                    let boxIssue = null;
                    if (box) {
                        const bb = box.getBoundingClientRect();
                        if (bb.top < -1) boxIssue = 'ផ្នែកខាងលើចេញក្រៅអេក្រង់ top=' + Math.round(bb.top);
                        else if (bb.height > vh + 1 && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) boxIssue = 'ខ្ពស់ជាងអេក្រង់ តែរមូរមិនបាន h=' + Math.round(bb.height) + '/' + vh;
                    }
                    prevAll.forEach(([x, d]) => { x.style.display = d; });
                    return { over, boxIssue };
                }, mid);
                if (r && r.over) modalBad.push(mid + ' ➜ លើសទទឹង: ' + r.over);
                if (r && r.boxIssue) modalBad.push(mid + ' ➜ ' + r.boxIssue);
            }
            check(modalBad.length === 0, label + ': modal ទាំងអស់សមនឹងអេក្រង់', modalBad.slice(0, 5).join('\n        '));

            await ctx.close();
        }
        server.close();
        port++;
    }
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
