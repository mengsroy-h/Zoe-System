let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const CHROME = process.env.FUZZ_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs');
const http = require('http');
const path = require('path');
if (!fs.existsSync(CHROME)) {
    console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME);
    process.exit(0);
}
const ROOT = process.env.FUZZ_APP_DIR || path.join(__dirname, '..');
const RUNS = parseInt(process.env.FUZZ_RUNS || '6', 10);
const OPS = parseInt(process.env.FUZZ_OPS || '26', 10);
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
function ok(n) { console.log('  ok    ' + n); pass++; }
function bad(n, d) { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; }
function check(c, n, d) { c ? ok(n) : bad(n, d); }

function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

const LICENSE_STUB = `window.ZoeLicense = {
    getStatus: function () { return Promise.resolve({ state: 'active' }); },
    setServerTimeOffset: function () {}, syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ ok: true }); },
    verifyKeyString: function () { return Promise.resolve({ ok: true }); }, clearActivation: function () {}
};`;

const BOOT = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
    const listeners = [];
    function getPath(p) {
        if (!p || p === '/') return store;
        let cur = store;
        for (const part of p.split('/').filter(Boolean)) {
            if (cur === null || cur === undefined || typeof cur !== 'object') return null;
            cur = cur[part];
        }
        return cur === undefined ? null : cur;
    }
    function setPath(p, val) {
        const parts = p.split('/').filter(Boolean);
        if (!parts.length) return;
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        const last = parts[parts.length - 1];
        if (val && typeof val === 'object' && typeof val.__increment === 'number') {
            const base = typeof cur[last] === 'number' ? cur[last] : 0;
            cur[last] = Math.round((base + val.__increment + Number.EPSILON) * 100) / 100;
            return;
        }
        if (val === null) delete cur[last]; else cur[last] = JSON.parse(JSON.stringify(val));
    }
    function snapOf(p) {
        const v = getPath(p);
        return { val: () => (v === undefined || v === null) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v), exists: () => v !== null && v !== undefined };
    }
    function fire(p) { listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) { window.__listenerThrew = String(e && e.message); } }); }
    function fireAll() { [...new Set(listeners.map((l) => l.path))].forEach(fire); }
    window.__fireAll = fireAll;
    window.__setPath = (p, v) => { setPath(p, v); fireAll(); };
    // ការសរសេររបស់ "ឧបករណ៍ផ្សេង" ដែល listener របស់យើងមិនទាន់ទទួល — ថ្នាក់កំហុសរបស់ជុំ ១៣
    window.__otherDevice = (kind, pick) => {
        const hist = store.zoew_scan_history_cod_dod || {};
        const ids = Object.keys(hist);
        if (!ids.length) return null;
        const id = ids[Math.floor(pick * ids.length) % ids.length];
        const it = hist[id];
        if (!it) return null;
        const bcs = Array.isArray(it.barcodes) ? it.barcodes.filter(Boolean) : [];
        if (kind === 'delete') {
            // លុប៖ ផ្លាស់ទៅធុងសំរាម ដោយមិនប៉ះចំណូល (គោលការណ៍ លុប)
            const copy = JSON.parse(JSON.stringify(it));
            copy.deletedAt = Date.now();
            copy.isFromDeletion = true;
            if (Array.isArray(copy.barcodes)) copy.barcodes = copy.barcodes.map((b) => Object.assign({}, b, { isFromDeletion: true }));
            store.zoew_recently_deleted_cod_dod[id] = copy;
            delete hist[id];
            return 'other:delete';
        }
        if (kind === 'remove' && bcs.length > 1) {
            // ដក៖ យក barcode ១ ចេញ ហើយកាត់ចំណូលចេញ (គោលការណ៍ ដក)
            const idx = Math.floor(pick * bcs.length) % bcs.length;
            const gone = bcs[idx];
            const kept = bcs.filter((_, i) => i !== idx);
            const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
            it.barcodes = kept;
            it.count = kept.length;
            it.cod = r2(kept.reduce((a, b) => a + (parseFloat(b.cod) || 0), 0));
            it.dod = r2(kept.reduce((a, b) => a + (parseFloat(b.dod) || 0), 0));
            it.price = r2(it.cod + it.dod);
            const trashId = id + '_rm' + Math.floor(pick * 1e6);
            store.zoew_recently_deleted_cod_dod[trashId] = Object.assign({}, it, {
                id: trashId, deletedAt: Date.now(), isFromDeletion: false, count: 1,
                cod: parseFloat(gone.cod) || 0, dod: parseFloat(gone.dod) || 0,
                price: r2((parseFloat(gone.cod) || 0) + (parseFloat(gone.dod) || 0)),
                barcode: gone.code, isClosed: !!gone.isClosed,
                barcodes: [Object.assign({}, gone, { isDeducted: true, isFromDeletion: false })]
            });
            const rev = (store.zoew_daily_revenue_cod_dod || {})[it.scanDate];
            if (rev) {
                rev.codDollar = r2((parseFloat(rev.codDollar) || 0) - (parseFloat(gone.cod) || 0));
                rev.dodDollar = r2((parseFloat(rev.dodDollar) || 0) - (parseFloat(gone.dod) || 0));
                rev.totalCount = (parseFloat(rev.totalCount) || 0) - 1;
            }
            return 'other:remove';
        }
        return null;
    };

    const user = { uid: 'admin-uid', email: 'a@b.c', getIdToken: () => Promise.resolve('tok'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'fake' }), getApps: () => [], deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }), signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(), browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }),
        ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
        onValue: (r, cb) => {
            listeners.push({ path: r.path, cb });
            setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else cb(snapOf(r.path)); }, 0);
            return () => {};
        },
        off: () => {}, goOnline: () => {},
        increment: (n) => ({ __increment: n }),
        get: (r) => Promise.resolve(snapOf(r.path)),
        set: (r, v) => { setPath(r.path, v); fireAll(); return Promise.resolve(); },
        update: (r, obj) => { Object.keys(obj).forEach((k) => setPath((r.path ? r.path + '/' : '') + k, obj[k])); fireAll(); return Promise.resolve(); },
        runTransaction: (r, fn) => {
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            setPath(r.path, next); fireAll();
            return Promise.resolve({ committed: true, snapshot: snapOf(r.path) });
        }
    };
    window.dispatchEvent(new Event('firebasesdkready'));

    // ---- invariant, evaluated against the SERVER copy ----
    window.__invariant = function (dateKey) {
        const s = window.__fakeStore;
        const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
        const hist = s.zoew_scan_history_cod_dod || {};
        const trash = s.zoew_recently_deleted_cod_dod || {};
        let cod = 0, dod = 0, count = 0;
        const addBc = (b) => { cod += parseFloat(b.cod) || 0; dod += parseFloat(b.dod) || 0; count += 1; };
        const bcsOf = (it) => {
            const v = it.barcodes;
            if (!v) return null;
            if (Array.isArray(v)) return v.filter(Boolean);
            if (typeof v === 'object') return Object.keys(v).sort((a, b) => (+a) - (+b)).map((k) => v[k]).filter(Boolean);
            return null;
        };
        Object.keys(hist).forEach((id) => {
            const it = hist[id];
            if (!it || it.scanDate !== dateKey) return;
            const bcs = bcsOf(it);
            if (bcs && bcs.length) bcs.forEach(addBc);
            else addBc({ cod: it.cod, dod: it.dod });
        });
        Object.keys(trash).forEach((id) => {
            const it = trash[id];
            if (!it || it.scanDate !== dateKey) return;
            const bcs = bcsOf(it);
            if (bcs && bcs.length) bcs.forEach((b) => { if (b.isDeducted !== true) addBc(b); });
            else if (it.isDeducted !== true) addBc({ cod: it.cod, dod: it.dod });
        });
        let closedBarcodes = 0;
        const countClosed = (bag) => Object.keys(bag).forEach((id) => {
            const it = bag[id];
            if (!it || it.scanDate !== dateKey) return;
            const bcs = bcsOf(it);
            if (bcs && bcs.length) bcs.forEach((b) => { if (b.isClosed === true) closedBarcodes++; });
            else if (it.isClosed === true) closedBarcodes++;
        });
        countClosed(hist); countClosed(trash);
        const rev = (s.zoew_daily_revenue_cod_dod || {})[dateKey] || { codDollar: 0, dodDollar: 0, totalCount: 0 };
        const pick = (s.zoew_daily_pickup_cod_dod || {})[dateKey] || {};
        const phones = pick.pickedUpPhones || {};
        const badRef = Object.keys(phones).filter((k) => !(phones[k] > 0));
        return {
            expectCod: r2(cod), gotCod: r2(parseFloat(rev.codDollar) || 0),
            expectDod: r2(dod), gotDod: r2(parseFloat(rev.dodDollar) || 0),
            expectCount: count, gotCount: parseFloat(rev.totalCount) || 0,
            pkg: parseFloat(pick.packagesPickedUp) || 0,
            expectPkg: closedBarcodes,
            zeroRefPhones: badRef
        };
    };
};

function seedData() {
    const t = new Date();
    const d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    const now = Date.now();
    const mk = (id, phone, bcs) => ({
        id, phone, scanDate: d, createdAt: now - 100000,
        cod: Math.round(bcs.reduce((s, b) => s + b.cod, 0) * 100) / 100,
        dod: Math.round(bcs.reduce((s, b) => s + b.dod, 0) * 100) / 100,
        price: Math.round(bcs.reduce((s, b) => s + b.cod + b.dod, 0) * 100) / 100,
        count: bcs.length, barcode: bcs[bcs.length - 1].code, time: '10:00', isClosed: false,
        barcodes: bcs.map((b) => ({ code: b.code, time: '10:00', cod: b.cod, dod: b.dod, locker: 'A1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 100000 }))
    });
    const items = {
        it_a: mk('it_a', '0968490421', [{ code: 'AA1', cod: 10, dod: 0 }, { code: 'AA2', cod: 20.5, dod: 1.25 }]),
        it_b: mk('it_b', '0777123456', [{ code: 'BB1', cod: 5, dod: 2 }]),
        it_c: mk('it_c', '0611234567', [{ code: 'CC1', cod: 7.75, dod: 0 }, { code: 'CC2', cod: 3, dod: 4 }, { code: 'CC3', cod: 1.5, dod: 0 }])
    };
    let cod = 0, dod = 0, cnt = 0;
    Object.values(items).forEach((it) => it.barcodes.forEach((b) => { cod += b.cod; dod += b.dod; cnt++; }));
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: items,
        zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [d]: { codDollar: Math.round(cod * 100) / 100, dodDollar: Math.round(dod * 100) / 100, totalCount: cnt } },
        zoew_monthly_revenue_cod_dod: {},
        zoew_daily_pickup_cod_dod: {},
        zoew_scanner_lookup: {},
        zoew_barcode_registry: {},
        zoew_settings: { exchange_rate: 4100 },
        _dateKey: d
    };
}

// deterministic PRNG so any failure reproduces from its seed
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const OPNAMES = ['scan', 'closeOrder', 'closeBarcode', 'removeBarcode', 'deleteItem', 'restore', 'editPrice', 'sweep'];

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const APPS = (process.env.FUZZ_APPS || 'ZoeW').split(',');
    for (const app of APPS) {
        console.log('\n=== ' + app + ' ===');
        const dir = path.join(ROOT, app);
        const server = await serve(dir);
        const port = server.address().port;
        let appFail = 0, appRuns = 0, lastDetail = '';
        const RUN0 = parseInt(process.env.FUZZ_RUN0 || '0', 10);
        for (let run = RUN0; run < RUN0 + RUNS; run++) {
            const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
            const page = await ctx.newPage();
            page.on('dialog', (d) => d.accept());
            await page.route('**', (route) => {
                const u = route.request().url();
                if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
                if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
                return route.abort();
            });
            const seed = seedData();
            await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
            await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed) + ');');
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(1800);

            const r = rng(1000 + run * 7);
            const trail = [];
            let broke = null;
            for (let i = 0; i < OPS && !broke; i++) {
                const wanted = OPNAMES[Math.floor(r() * OPNAMES.length)];
                const pick = r();
                const amt = Math.round(r() * 4000) / 100;
                if (r() < 0.35) {
                    const kind = r() < 0.45 ? 'delete' : 'remove';
                    const injected = await page.evaluate((a) => window.__otherDevice(a.kind, a.pick), { kind, pick: r() });
                    if (injected) { trail.push(injected); if (process.env.FUZZ_DEBUG === '1') console.log('    ~ ' + injected); }
                }
                const done = await page.evaluate(async (args) => {
                    const { wanted, pick, amt, isAdmin } = args;
                    const live = (typeof scanHistory !== 'undefined' ? scanHistory : []).filter(Boolean);
                    const trash = (typeof deletedItems !== 'undefined' ? deletedItems : []).filter(Boolean);
                    const at = (arr) => arr.length ? arr[Math.floor(pick * arr.length) % arr.length] : null;
                    const bcOf = (it) => (it && Array.isArray(it.barcodes) && it.barcodes.length) ? it.barcodes[Math.floor(pick * it.barcodes.length) % it.barcodes.length] : null;
                    try {
                        if (wanted === 'scan' && isAdmin) {
                            const code = 'FZ' + Math.floor(pick * 1e6);
                            window.triggerScanAction(code);
                            const bcText = document.getElementById('modalBarcodeText');
                            const modal = document.getElementById('phoneModal');
                            const open = modal && getComputedStyle(modal).display !== 'none';
                            if (!open || !bcText || bcText.innerText !== code) return null;
                            const p = document.getElementById('modalPhoneInput'); if (p) p.value = pick > 0.5 ? '0968490421' : '09' + Math.floor(pick * 1e8);
                            const c = document.getElementById('modalCodInput'); if (c) c.value = String(amt);
                            const d2 = document.getElementById('modalDodInput'); if (d2) d2.value = '0';
                            await Promise.resolve(window.confirmPhone()).catch(() => {});
                            return 'scan';
                        }
                        if (wanted === 'closeOrder') { const it = at(live); if (!it) return null; await window.toggleCloseStatus(it.id); return 'closeOrder'; }
                        if (wanted === 'closeBarcode') { const it = at(live); const b = bcOf(it); if (!it || !b) return null; await window.toggleIndividualBarcodeClose(it.id, b.code); return 'closeBarcode'; }
                        if (wanted === 'removeBarcode' && isAdmin) { const it = at(live); const b = bcOf(it); if (!it || !b) return null; await window.removeSingleBarcode(it.id, b.code); return 'removeBarcode'; }
                        if (wanted === 'deleteItem' && isAdmin) { const it = at(live); if (!it) return null; await window.deleteSingleItem(it.id); return 'deleteItem'; }
                        if (wanted === 'restore') { const it = at(trash); if (!it) return null; window.promptRestoreDeletedItem(it.id); await window.executeRestoreItem(); return 'restore'; }
                        if (wanted === 'editPrice' && isAdmin) {
                            const it = at(live); const b = bcOf(it); if (!it || !b) return null;
                            window.openEditBarcodePriceModal(it.id, b.code);
                            const c = document.getElementById('editBcCodInput'); if (c) c.value = String(amt);
                            const d2 = document.getElementById('editBcDodInput'); if (d2) d2.value = '0';
                            window.saveEditedBarcodePrice(); return 'editPrice';
                        }
                        if (wanted === 'sweep') {
                            const s = window.__fakeStore.zoew_scan_history_cod_dod || {};
                            const ids = Object.keys(s); if (!ids.length) return null;
                            const id = ids[Math.floor(pick * ids.length) % ids.length];
                            const old = Date.now() - 9 * 24 * 3600 * 1000;
                            if (s[id].isClosed) window.__setPath('zoew_scan_history_cod_dod/' + id + '/closedAt', Date.now() - 3 * 3600 * 1000);
                            else {
                                window.__setPath('zoew_scan_history_cod_dod/' + id + '/createdAt', old);
                                const bcs = s[id].barcodes || [];
                                for (let k = 0; k < bcs.length; k++) window.__setPath('zoew_scan_history_cod_dod/' + id + '/barcodes/' + k + '/createdAt', old);
                            }
                            window.runAutomaticCleanupRules(); return 'sweep';
                        }
                    } catch (e) { return 'threw:' + wanted + ':' + (e && e.message); }
                    return null;
                }, { wanted, pick, amt, isAdmin: true });
                await page.waitForTimeout(170);
                const dbg = process.env.FUZZ_DEBUG === '1';
                if (done) trail.push(done);
                if (done && String(done).indexOf('threw:') === 0) { broke = 'op threw: ' + done; break; }
                const inv = await page.evaluate((k) => window.__invariant(k), seed._dateKey);
                if (dbg && done) console.log('    #' + i + ' ' + done + ' -> ' + JSON.stringify(inv));
                if (inv.expectCod !== inv.gotCod || inv.expectDod !== inv.gotDod || inv.expectCount !== inv.gotCount) {
                    broke = 'invariant broke after [' + trail.join(' > ') + ']\n        ' + JSON.stringify(inv);
                    if (process.env.FUZZ_DEBUG === '1') {
                        const dump = await page.evaluate(() => ({
                            hist: window.__fakeStore.zoew_scan_history_cod_dod,
                            trash: window.__fakeStore.zoew_recently_deleted_cod_dod,
                            rev: window.__fakeStore.zoew_daily_revenue_cod_dod,
                            memIds: (typeof scanHistory !== 'undefined' ? scanHistory : []).map((x) => x && x.id)
                        }));
                        console.log('    DUMP ' + JSON.stringify(dump, null, 1));
                    }
                    break;
                }
                if (inv.zeroRefPhones.length) { broke = 'pickedUpPhones មាន refCount សូន្យ/អវិជ្ជមាន ក្រោយ [' + trail.join(' > ') + ']\n        ' + JSON.stringify(inv); break; }
                if (inv.pkg < 0) { broke = 'packagesPickedUp អវិជ្ជមាន ក្រោយ [' + trail.join(' > ') + ']'; break; }
                if (inv.pkg !== inv.expectPkg) {
                    broke = 'ស្ថិតិយកកញ្ចប់ខុសពីចំនួន barcode ដែលបិទ ក្រោយ [' + trail.join(' > ') + ']\n        ' + JSON.stringify(inv);
                    if (process.env.FUZZ_DEBUG === '1') {
                        const dump = await page.evaluate(() => ({
                            hist: window.__fakeStore.zoew_scan_history_cod_dod,
                            trash: window.__fakeStore.zoew_recently_deleted_cod_dod,
                            pickup: window.__fakeStore.zoew_daily_pickup_cod_dod
                        }));
                        console.log('    DUMP ' + JSON.stringify(dump));
                    }
                    break;
                }
            }
            appRuns++;
            if (broke) { appFail++; if (!lastDetail) lastDetail = 'app=' + app + ' run=' + run + ' ' + broke; }
            await ctx.close();
        }
        check(appFail === 0, app + ': invariant ចំណូល រក្សាបាន ក្នុង ' + appRuns + ' លំដាប់ចៃដន្យ × ' + OPS + ' ប្រតិបត្តិការ', lastDetail);
        server.close();
    }
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
