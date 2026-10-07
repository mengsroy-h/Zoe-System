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
// ⛔ លំនាំដើមត្រូវឈានដល់កម្រិតដែល **វាស់រួច** ថាចាំបាច់។
// CLAUDE.md កត់ត្រាថា mutation `claimedPartial` (ការជាន់អថេរ — ថ្នាក់កំហុសពិត)
// **រស់រានពេញ ២០ លំដាប់ × ៥៥** មុនបន្ថែម op `sweepPickup` ហើយធ្លាក់ក្នុង
// **១២ លំដាប់ × ៤៥** ក្រោយបន្ថែម។ ប៉ុន្តែលំនាំដើមនៅត្រឹម **៦ × ២៦** —
// **តូចជាងកម្រិតដែលឯកសារខ្លួនវាចែងថាចាំបាច់** ➜ ការរត់ធម្មតាមិនដែល
// ឈានដល់ជម្រៅដែលចាប់កំហុសនោះទេ។ នោះជាបៃតងក្លែងក្លាយប្រភេទ
// «ការគ្របតូចពេក» ៖ វារាយការណ៍ PASS ដោយមិនបានទៅដល់កន្លែងដែលកំហុសរស់នៅ។
// វាស់បាន ៖ ៦×២៦ ➜ ៤១ វិ.; ១២×៤៥ ➜ ១២២ វិ. (ក្រោមពិដាន ៣០០ វិ. របស់ run-all)។
const RUNS = parseInt(process.env.FUZZ_RUNS || '12', 10);
const OPS = parseInt(process.env.FUZZ_OPS || '45', 10);
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
    // ⛔ **rules ពិតបដិសេធតម្លៃអវិជ្ជមាន** លើ node ស្ថិតិទាំង ៣
    // (`newData.val() >= 0` · `pickedUpPhones/$k > 0`)។ Fake SDK ដែល
    // ទទួលយកការសរសេរ **ណាមួយ** ធ្វើឲ្យ «server បដិសេធ» ក្លាយជា
    // **របៀបបរាជ័យដែលមិនដែលត្រូវសាក** — មេរៀន 2.25.5 ។
    window.__ruleRejects = 0;
    // ⛔ កំណត់ត្រាការសរសេរ **ដែល fake ទទួល** (App ពិត · លំដាប់ពិត) ➜ `emu/app-writes-rules-test` ចាក់វាទៅ RTDB emulator
    //    ជាមួយ rules ពិត ៖ fake ដែលទទួលគ្រប់យ៉ាង មិនអាចប្រាប់ថា server ពិតនឹងបដិសេធការសរសេរណាទេ (មេរៀន 2.25.5)។
    //    `owner` = ការប្តូររបស់ harness (ឧបករណ៍ផ្សេង · ការធ្វើឲ្យចាស់) ដែលរំលង rules ដូច Console។
    window.__writeLog = [];
    const logWrite = (entry) => {
        try { window.__writeLog.push(JSON.parse(JSON.stringify(entry))); } catch (e) { window.__writeLog.push({ bad: String(e && e.message) }); }
    };
    function ledgerRuleViolation(p, val) {
        const parts = p.split('/').filter(Boolean);
        const root = parts[0];
        if (root !== 'zoew_daily_revenue_cod_dod' && root !== 'zoew_monthly_revenue_cod_dod' && root !== 'zoew_daily_pickup_cod_dod') return null;
        if (val && typeof val === 'object' && typeof val.__increment === 'number') {
            const base = typeof getPath(p) === 'number' ? getPath(p) : 0;
            val = Math.round((base + val.__increment + Number.EPSILON) * 100) / 100;
        }
        const numOk = (v) => typeof v === 'number' && isFinite(v);
        const AMOUNTS = ['codDollar', 'dodDollar', 'totalCount', 'packagesPickedUp'];
        const checkRec = (rec) => {
            if (!rec || typeof rec !== 'object') return null;
            for (const k of AMOUNTS) {
                if (rec[k] !== undefined && rec[k] !== null && (!numOk(rec[k]) || rec[k] < 0)) return k + '=' + rec[k];
            }
            const ph = rec.pickedUpPhones;
            if (ph && typeof ph === 'object') {
                for (const k of Object.keys(ph)) {
                    if (ph[k] === null) continue;
                    if (!numOk(ph[k]) || !(ph[k] > 0)) return 'pickedUpPhones/' + k + '=' + ph[k];
                }
            }
            return null;
        };
        if (root === 'zoew_monthly_revenue_cod_dod' && parts.length === 1) {
            for (const m of Object.keys(val || {})) { const w = checkRec(val[m]); if (w) return m + '.' + w; }
            return null;
        }
        if (parts.length === 2) return checkRec(val);
        if (parts.length >= 3) {
            const leaf = parts[parts.length - 1];
            if (AMOUNTS.indexOf(leaf) !== -1 && val !== null && (!numOk(val) || val < 0)) return leaf + '=' + val;
            if (parts[2] === 'pickedUpPhones' && parts.length === 4 && val !== null && (!numOk(val) || !(val > 0))) return 'pickedUpPhones/' + parts[3] + '=' + val;
            if (parts[2] === 'pickedUpPhones' && parts.length === 3 && val && typeof val === 'object') {
                for (const k of Object.keys(val)) { if (val[k] !== null && (!numOk(val[k]) || !(val[k] > 0))) return 'pickedUpPhones/' + k + '=' + val[k]; }
            }
        }
        return null;
    }
    function ruleDenied(why) {
        window.__ruleRejects++;
        const e = new Error('PERMISSION_DENIED ' + why);
        e.code = 'PERMISSION_DENIED';
        return Promise.reject(e);
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
    window.__setPath = (p, v) => { setPath(p, v); logWrite({ owner: true, m: 'PUT', p: p, v: v }); fireAll(); };
    // ការសរសេររបស់ "ឧបករណ៍ផ្សេង" ដែល listener របស់យើងមិនទាន់ទទួល — ថ្នាក់កំហុសរបស់ជុំ ១៣
    window.__otherDevice = (kind, pick, forcedId) => {
        const hist = store.zoew_scan_history_cod_dod || {};
        const ids = Object.keys(hist);
        if (!ids.length) return null;
        const id = forcedId && hist[forcedId] ? forcedId : ids[Math.floor(pick * ids.length) % ids.length];
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
        if (kind === 'remove' && bcs.length >= 1) {
            // ដក៖ យក barcode ១ ចេញ ហើយកាត់ចំណូលចេញ (គោលការណ៍ ដក) ·
            // barcode ចុងក្រោយ ➜ កញ្ចប់បាត់ពីប្រវត្តិទាំងស្រុង (ដូច `removeSingleBarcode()` ពិត) ខណៈទិដ្ឋភាព local នៅមានវា
            const idx = Math.floor(pick * bcs.length) % bcs.length;
            const gone = bcs[idx];
            const kept = bcs.filter((_, i) => i !== idx);
            const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
            it.barcodes = kept;
            it.count = kept.length;
            it.cod = r2(kept.reduce((a, b) => a + (parseFloat(b.cod) || 0), 0));
            it.dod = r2(kept.reduce((a, b) => a + (parseFloat(b.dod) || 0), 0));
            it.price = r2(it.cod + it.dod);
            if (!kept.length) delete hist[id];
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

    const otherDeviceWrite = window.__otherDevice;
    window.__otherDevice = (kind, pick, forcedId) => {
        const done = otherDeviceWrite(kind, pick, forcedId);
        if (done) logWrite({ owner: true, m: 'SNAP', v: store });
        return done;
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
        set: (r, v) => {
            const why = ledgerRuleViolation(r.path, v);
            if (why) return ruleDenied(why);
            setPath(r.path, v); logWrite({ m: 'PUT', p: r.path, v: v === undefined ? null : v }); fireAll(); return Promise.resolve();
        },
        update: (r, obj) => {
            const base = r.path ? r.path + '/' : '';
            for (const k of Object.keys(obj)) {
                const why = ledgerRuleViolation(base + k, obj[k]);
                if (why) return ruleDenied(why);
            }
            Object.keys(obj).forEach((k) => setPath(base + k, obj[k])); logWrite({ m: 'PATCH', p: r.path, v: obj }); fireAll(); return Promise.resolve();
        },
        runTransaction: (r, fn) => {
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            const why = ledgerRuleViolation(r.path, next);
            if (why) return ruleDenied(why);
            setPath(r.path, next); logWrite({ m: 'PUT', p: r.path, v: next, tx: true }); fireAll();
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
        // ⛔ អថេរដែលឯកសារចែង តែគ្មានឧបករណ៍វាស់ក្នុងលំដាប់ចៃដន្យ ៖
        //   ១. sum(pickedUpPhones) === packagesPickedUp
        //   ២. barcode មិនត្រូវនៅ **ទាំង** ប្រវត្តិ **និង** ធុងសំរាម (ថ្នាក់ 2.17.3)
        //   ៣. កូនសោ registry មិនត្រូវកំព្រា (ថ្នាក់ 2.25.5 / 2.25.9)
        let phoneSum = 0;
        Object.keys(phones).forEach((k) => { phoneSum += parseFloat(phones[k]) || 0; });
        const seenCodes = {};
        const dupCodes = [];
        const noteCodes = (bag, where) => Object.keys(bag).forEach((id) => {
            const it = bag[id]; if (!it) return;
            const list = bcsOf(it) || (it.barcode ? [{ code: it.barcode }] : []);
            list.forEach((b) => {
                if (!b || !b.code) return;
                if (seenCodes[b.code]) dupCodes.push(b.code + '@' + seenCodes[b.code] + '+' + where);
                else seenCodes[b.code] = where;
            });
        });
        noteCodes(hist, 'hist'); noteCodes(trash, 'trash');
        const registryKeyOf = (code) => String(code).toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
        const liveKeys = {};
        Object.keys(seenCodes).forEach((c) => { liveKeys[registryKeyOf(c)] = true; });
        const reg = s.zoew_barcode_registry || {};
        const orphanKeys = Object.keys(reg).filter((k) => reg[k] === true && !liveKeys[k]);
        return {
            phoneSum: phoneSum, dupCodes: dupCodes, orphanKeys: orphanKeys, ruleRejects: window.__ruleRejects,
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

const OPNAMES = ['scan', 'closeOrder', 'closeBarcode', 'removeBarcode', 'deleteItem', 'restore', 'editPrice', 'sweep', 'sweepPickup', 'origin', 'shopSweep'];
// `FUZZ_CAPTURE=<file>` ➜ សរសេរការសរសេរទាំងអស់ (seed + log តាមលំដាប់) សម្រាប់ `emu/app-writes-rules-test`
const CAPTURE = process.env.FUZZ_CAPTURE ? [] : null;

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const APPS = (process.env.FUZZ_APPS || 'ZoeW').split(',');
    for (const app of APPS) {
        console.log('\n=== ' + app + ' ===');
        const dir = path.join(ROOT, app);
        const server = await serve(dir);
        const port = server.address().port;
        let appFail = 0, appRuns = 0, lastDetail = '', staleViewRuns = 0;
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
                    // ⛔ `other:remove` ជាការចាក់ដ៏មានតម្លៃបំផុត ៖ វាទុក
                    // **ទិដ្ឋភាពមូលដ្ឋានចាស់** ខណៈ ledger លើ server ទាបរួច ➜
                    // នោះជាស្ថានភាពដែលកំហុស clamp រស់នៅ (មេរៀន 2026-09-03)។
                    const kind = r() < 0.35 ? 'delete' : 'remove';
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
                        if (wanted === 'origin') { const it = at(live); const b = bcOf(it); if (!it || !b || typeof window.saveBarcodeOrigins !== 'function') return null; const n = await window.saveBarcodeOrigins([{ code: b.code, from: pick > 0.5 ? 'Shopee SHPE' : 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ' }]); return n ? 'origin' : null; }
                        if (wanted === 'shopSweep') { if (typeof window.markZtoShopSweep !== 'function' || typeof window.getServerNow !== 'function') return null; return window.markZtoShopSweep(window.getServerNow()) ? 'shopSweep' : null; }
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
                        if (wanted === 'sweepPickup') {
                            const s = window.__fakeStore.zoew_scan_history_cod_dod || {};
                            const ids = Object.keys(s); if (!ids.length) return null;
                            const id = ids[Math.floor(pick * ids.length) % ids.length];
                            const ripe = Date.now() - 3 * 3600 * 1000;
                            const bag = (s[id] && s[id].barcodes) || {};
                            const keys = Array.isArray(bag) ? bag.map((x, i) => String(i)) : Object.keys(bag);
                            let aged = 0;
                            for (const k of keys) {
                                if (bag[k] && bag[k].isClosed === true) {
                                    window.__setPath('zoew_scan_history_cod_dod/' + id + '/barcodes/' + k + '/closedAt', ripe);
                                    aged++;
                                }
                            }
                            if (!aged) return null;
                            if (s[id].isClosed) window.__setPath('zoew_scan_history_cod_dod/' + id + '/closedAt', ripe);
                            window.runAutomaticCleanupRules(); return 'sweepPickup';
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
                if (inv.phoneSum !== inv.pkg) { broke = '⛔ អថេរ sum(pickedUpPhones) !== packagesPickedUp ក្រោយ [' + trail.join(' > ') + ']\n        ' + JSON.stringify(inv); break; }
                if (inv.dupCodes.length) { broke = '⛔ barcode ស្ថិតនៅទាំងប្រវត្តិ និងធុងសំរាម ក្រោយ [' + trail.join(' > ') + ']\n        ' + JSON.stringify(inv.dupCodes.slice(0, 5)); break; }
                if (inv.orphanKeys.length) { broke = '⛔ កូនសោ zoew_barcode_registry កំព្រា (barcode ស្កេនចូលមិនបានទៀត) ក្រោយ [' + trail.join(' > ') + ']\n        ' + JSON.stringify(inv.orphanKeys.slice(0, 5)); break; }
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
            if (CAPTURE) CAPTURE.push({ run: run, seed: seed, log: await page.evaluate(() => window.__writeLog || []) });
            appRuns++;
            if (trail.indexOf('other:remove') !== -1) staleViewRuns++;
            if (broke) { appFail++; if (!lastDetail) lastDetail = 'app=' + app + ' run=' + run + ' ' + broke; }
            await ctx.close();
        }
        check(appFail === 0, app + ': invariant ចំណូល រក្សាបាន ក្នុង ' + appRuns + ' លំដាប់ចៃដន្យ × ' + OPS + ' ប្រតិបត្តិការ', lastDetail);
        // ⛔ ជាន់អប្បបរមា ៖ បើការចាក់ «ឧបករណ៍ផ្សេងដក» មិនដែលបាញ់សោះ នោះ
        // ការរត់នេះមិនបានទៅដល់ស្ថានភាព **ទិដ្ឋភាពមូលដ្ឋានចាស់** ទេ ➜ បៃតងក្លែងក្លាយ។
        check(staleViewRuns > 0, app + ': ការចាក់ «ឧបករណ៍ផ្សេងដក» បានបាញ់ពិត (' + staleViewRuns + ' លំដាប់)',
            'គ្មានលំដាប់ណាឈានដល់ទិដ្ឋភាពមូលដ្ឋានចាស់ ➜ ការវាស់មិនបានគ្រប');
        server.close();
    }
    await browser.close();
    if (CAPTURE) {
        fs.writeFileSync(process.env.FUZZ_CAPTURE, JSON.stringify(CAPTURE));
        console.log('capture ៖ ' + CAPTURE.length + ' លំដាប់ · ' + CAPTURE.reduce((sum, c) => sum + c.log.length, 0) + ' ការសរសេរ ➜ ' + process.env.FUZZ_CAPTURE);
    }
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
