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
    // ⛔ `.info/*` មិនមែនទិន្នន័យក្នុង store ទេ ៖ ការចាក់ `snapOf('.info/connected')` (= null) ក្រោយរាល់ការសរសេរ ធ្វើឲ្យ App ជឿថាដាច់ពី
    //    server ជានិច្ច (`isDatabaseConnected = false`) ➜ ផ្លូវដែលទាមទារការតភ្ជាប់ ឆ្លើយ ⏳ ជានិច្ច
    //    ហើយមិនដែលត្រូវវាស់ ➜ listener `.info/*` ទទួលតែការហៅដំបូង (`onValue`) ដូច SDK ពិតពេលការតភ្ជាប់មិនប្តូរ
    function fireAll() { [...new Set(listeners.map((l) => l.path))].filter((p) => String(p).indexOf('.info/') !== 0).forEach(fire); }
    window.__fireAll = fireAll;
    window.__setPath = (p, v) => { setPath(p, v); logWrite({ owner: true, m: 'PUT', p: p, v: v }); fireAll(); };
    // ការសរសេររបស់ "ឧបករណ៍ផ្សេង" ដែល listener របស់យើងមិនទាន់ទទួល — ថ្នាក់កំហុសរបស់ជុំ ១៣
    window.__otherDevice = (kind, pick, forcedId) => {
        const hist = store.zoew_scan_history_cod_dod || {};
        const ids = Object.keys(hist);
        if (!ids.length) return null;
        const id = forcedId && hist[forcedId] ? forcedId : ids[Math.floor(pick * ids.length) % ids.length];
        const it = hist[id];
        if (!it || it.scanPending != null || it.pricePending != null || it.pickupPending != null) return null;
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
            // M5 ៖ «ដក» Barcode បិទលុប key យករួចរបស់វាផង (ឧបករណ៍ផ្សេងដែលដំណើរការ App ថ្មី) ➜ ចំនួនទាំងពីរជាកញ្ចក់នៃសំណុំ
            const day = gone.isClosed ? (store.zoew_daily_pickup_cod_dod || {})[it.scanDate] : null;
            const set = day && day.pickedUpBarcodes;
            const key = String(gone.code).trim().toUpperCase();
            if (set && Object.prototype.hasOwnProperty.call(set, key)) {
                delete set[key];
                const phones = {};
                Object.keys(set).forEach((k) => { phones[set[k]] = (phones[set[k]] || 0) + 1; });
                day.packagesPickedUp = Object.keys(set).length;
                if (Object.keys(phones).length) day.pickedUpPhones = phones; else delete day.pickedUpPhones;
                if (!Object.keys(set).length) delete day.pickedUpBarcodes;
            }
            return 'other:remove';
        }
        return null;
    };

    // ⛔ MONEY-4 ៖ `ledgerBlip` ៖ transaction ledger ថ្ងៃបន្ទាប់របស់ App ចុះ (`applied`) ឬមិនដល់ (`lost`) ➜ ឧបករណ៍ផ្សេងស្កេនកញ្ចប់ថ្មី
    //    (ប្រវត្តិ + registry + ledger ថ្ងៃ ដោយ ring របស់ App ពិត `ledgerOpRing`) **មុន** wrapper អាន REST ➜ SDK បដិសេធ `disconnect`
    //    ➜ wrapper ពិតរបស់ App អាន server (fetch ក្លែងខាងក្រោម) ហើយសម្រេច ➜ អថេរចំណូលត្រូវនៅពិតក្រោយគ្រប់ op។
    window.__ledgerBlip = null;
    window.__ledgerBlipFired = [];
    const FAKE_DB_URL = 'https://fake-default-rtdb.firebaseio.com';
    const foreignLedgerScan = (dayPath) => {
        const day = String(dayPath).split('/')[1];
        const n = window.__ledgerBlipFired.length + 1;
        const code = 'FX' + n + Math.floor(Math.random() * 1e6);
        const cod = 3.25 * n;
        const now = Date.now();
        const id = 'fx_' + n + '_' + now;
        if (!store.zoew_scan_history_cod_dod) store.zoew_scan_history_cod_dod = {};
        store.zoew_scan_history_cod_dod[id] = {
            id, phone: '0715' + String(100000 + n), scanDate: day, createdAt: now, cod, dod: 0, price: cod, count: 1, barcode: code, time: '10:00', isClosed: false,
            barcodes: [{ code, time: '10:00', cod, dod: 0, locker: 'A1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now }]
        };
        if (!store.zoew_barcode_registry) store.zoew_barcode_registry = {};
        store.zoew_barcode_registry[String(code || '').trim().toUpperCase().replace(/[%.#$\[\]\/\x00-\x1F\x7F]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))] = true;
        const cur = getPath(dayPath) || null;
        const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
        const base = cur && typeof cur === 'object' ? cur : {};
        const op = 'op_fx' + String(n).padStart(4, '0') + Math.floor(Math.random() * 1e6).toString(36);
        const next = { codDollar: r2((parseFloat(base.codDollar) || 0) + cod), dodDollar: parseFloat(base.dodDollar) || 0, totalCount: (parseFloat(base.totalCount) || 0) + 1, op };
        if (typeof window.ledgerOpRing === 'function') next.ops = window.ledgerOpRing(cur, op);
        setPath(dayPath, next);
        logWrite({ owner: true, m: 'SNAP', v: store });
    };
    // ផ្លូវ REST ដែល App អានពី server ក្លែង (ការសម្រេច `disconnect` · ការអាន server ថ្មីមុនសរសេរ)
    window.__restReads = [];
    const realFetch = window.fetch ? window.fetch.bind(window) : null;
    window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : String((input && input.url) || '');
        if (url.indexOf(FAKE_DB_URL + '/') === 0) {
            const p = decodeURIComponent(new URL(url).pathname.replace(/\.json$/, '')).replace(/^\/+/, '');
            window.__restReads.push(p);
            const v = getPath(p);
            return Promise.resolve(new Response(JSON.stringify(v === undefined ? null : v), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return realFetch ? realFetch(input, init) : Promise.reject(new TypeError('Failed to fetch'));
    };

    // ⛔ ការស្តារដែលជាប់ ៖ ការស្តាររៀបរួច (barcode ចូលជួរអតិថិជន + `restoreClaimId`/`restoreClaimToken`/`restoreAddedCodes` · `restoredAt`
    //    លើ copy) រួច Sign ZTO បិទការស្តារ (`restoreBlocked`) មុនបញ្ចប់ ➜ ធុងសំរាមនៅកាន់ `restoreClaim` · ជួរនៅកាន់ការស្តារ ➜ ការលុបចោល
    //    ស្វ័យប្រវត្តិ (`resumeBlockedRestoreCancellations` ➜ `cancelBlockedRestore`) ដកតែកូដក្នុង provenance ហើយដោះ claim។ ដាក់គូនេះជា
    //    **ការសរសេរ owner** (snapshot តែមួយ · គ្មាន listener ឃើញពាក់កណ្តាល)។ ប្រាក់ ៖ barcode ស្តារ X ត្រូវបានដក (ធុងសំរាម
    //    `isDeducted: true`) ហើយការស្តារមិនទាន់បូកវិញ ➜ ledger គ្មាន X · អ្នកជិតខាង Y (ស្កេនធម្មតាក្នុងជួរដដែល) ➜ ledger ថ្ងៃ +Y ➜
    //    ក្រោយការលុបចោលដក copy X ចេញពីជួរ អថេរចំណូលត្រូវនៅពិត។
    window.__heldSeq = 0;
    window.__heldRestorePair = (pick, amt) => {
        const n = ++window.__heldSeq;
        const day = store._dateKey;
        const now = Date.now();
        const salt = Math.floor(pick * 1e6);
        const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
        const t = 'held_t' + n + '_' + salt, h = 'held_h' + n + '_' + salt;
        const token = 'restore_held_' + n + '_' + salt.toString(36);
        const code = 'HR' + n + 'X' + salt, sib = pick > 0.35 ? 'HR' + n + 'Y' + salt : null;
        const cod = r2(1 + amt), dod = pick > 0.5 ? 1.25 : 0, sibCod = r2(2.5 + n);
        const createdAt = now - 100000, deletedAt = now - 60000, restoredAt = now - 30000;
        const phone = '0716' + String(100000 + n).slice(-6);
        const bc = (c, cd, dd, extra) => Object.assign({ code: c, time: '10:00', cod: cd, dod: dd, locker: 'A1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt }, extra || {});
        if (!store.zoew_recently_deleted_cod_dod) store.zoew_recently_deleted_cod_dod = {};
        if (!store.zoew_scan_history_cod_dod) store.zoew_scan_history_cod_dod = {};
        if (!store.zoew_barcode_registry) store.zoew_barcode_registry = {};
        store.zoew_recently_deleted_cod_dod[t] = {
            id: t, phone, scanDate: day, createdAt, deletedAt, cod, dod, price: r2(cod + dod), count: 1, barcode: code, time: '10:00',
            isClosed: false, isFromDeletion: false, trashReason: 'remove', restoreBlocked: true,
            restoreClaim: { token, claimedAt: now - 10 * 60 * 1000, targetId: h },
            barcodes: [bc(code, cod, dod, { isDeducted: true })]
        };
        const rows = (sib ? [bc(sib, sibCod, 0)] : []).concat([bc(code, cod, dod, { restoredAt })]);
        const hc = r2(rows.reduce((a, b) => a + b.cod, 0)), hd = r2(rows.reduce((a, b) => a + b.dod, 0));
        store.zoew_scan_history_cod_dod[h] = Object.assign({
            id: h, phone, scanDate: day, createdAt, cod: hc, dod: hd, price: r2(hc + hd), count: rows.length, barcode: code, time: '10:00',
            isClosed: false, barcodes: rows, restoreClaimId: t, restoreClaimToken: token, restoreAddedCodes: JSON.stringify([code])
        });
        const regKey = (c) => String(c).toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
        store.zoew_barcode_registry[regKey(code)] = true;
        if (sib) {
            store.zoew_barcode_registry[regKey(sib)] = true;
            if (!store.zoew_daily_revenue_cod_dod) store.zoew_daily_revenue_cod_dod = {};
            const rev = store.zoew_daily_revenue_cod_dod[day] || (store.zoew_daily_revenue_cod_dod[day] = { codDollar: 0, dodDollar: 0, totalCount: 0 });
            rev.codDollar = r2((parseFloat(rev.codDollar) || 0) + sibCod);
            rev.totalCount = (parseFloat(rev.totalCount) || 0) + 1;
        }
        logWrite({ owner: true, m: 'SNAP', v: store, held: { t, h } });
        fireAll();
        return { t, h, code, sib };
    };

    const otherDeviceWrite = window.__otherDevice;
    window.__otherDevice = (kind, pick, forcedId) => {
        const done = otherDeviceWrite(kind, pick, forcedId);
        if (done) logWrite({ owner: true, m: 'SNAP', v: store });
        return done;
    };

    const user = { uid: 'admin-uid', email: 'a@b.c', getIdToken: () => Promise.resolve('tok'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: (config) => ({ name: 'fake', options: Object.assign({}, config) }), getApps: () => [], deleteApp: () => Promise.resolve(),
        getAuth: (app) => ({ app, currentUser: user }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }), signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(), browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }),
        ref: (d, p) => {
            const at = p === undefined ? '' : String(p);
            return { path: at, toString: () => FAKE_DB_URL + '/' + at.split('/').filter(Boolean).map(encodeURIComponent).join('/') };
        },
        onValue: (r, cb) => {
            listeners.push({ path: r.path, cb });
            // ⛔ `.info/serverTimeOffset` = 0 (ម៉ោង Server ពិត · តភ្ជាប់) ៖ គ្មានវា `serverClockTrusted` មិនដែលពិត ➜ `cleanupClockIsTrustworthy()`
            //    មិនពិត ➜ `runAutomaticCleanupRules()` ត្រឡប់ភ្លាម ➜ op `sweep`/`sweepPickup` (ច្បាប់ ២ ម៉ោង/៧ ថ្ងៃ) ក្លាយជា op ទទេ (ជាន់ `sweepRuns` ខាងក្រោម)
            setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else if (r.path === '.info/serverTimeOffset') cb({ val: () => 0 }); else cb(snapOf(r.path)); }, 0);
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
            // V2 money is one atomic receipt + daily/monthly increment packet, not a daily transaction.
            const receiptKeys = Object.keys(obj).filter(k => /^zoew_scan_operations\/scan_[a-f0-9]{32}$/.test(base + k));
            const receipt = receiptKeys.length === 1 ? obj[receiptKeys[0]] : null;
            const daily = receipt && 'zoew_daily_revenue_cod_dod/' + receipt.scanDate;
            const monthly = receipt && 'zoew_monthly_revenue_cod_dod/' + receipt.month;
            const priorReceipt = receipt && getPath('zoew_scan_operations/' + receipt.id);
            const expectedPacketKeys = receipt && [
                'zoew_scan_operations/' + receipt.id, 'zoew_scan_pending/' + receipt.id,
                'zoew_scan_history_cod_dod/' + receipt.targetId + '/scanPending', 'zoew_barcode_registry/' + receipt.registryKey,
                ...[daily, monthly].flatMap(root => ['codDollar', 'dodDollar', 'totalCount'].map(field => root + '/' + field))
            ];
            const registry = receipt && obj['zoew_barcode_registry/' + receipt.registryKey];
            const finalPacket = !base && receipt && receipt.phase === 'committed' && priorReceipt?.phase === 'prepared' &&
                JSON.stringify(Object.keys(obj).sort()) === JSON.stringify(expectedPacketKeys.sort()) &&
                JSON.stringify({ ...receipt, phase: 'prepared' }) === JSON.stringify(priorReceipt) &&
                registry?.v === 2 && registry.intent === receipt.id && registry.actorUid === receipt.actorUid && registry.birth === receipt.birth &&
                Object.keys(registry).length === 4 &&
                obj['zoew_scan_history_cod_dod/' + receipt.targetId + '/scanPending'] === null &&
                obj['zoew_scan_pending/' + receipt.id] === null &&
                [daily, monthly].every(root => ['codDollar', 'dodDollar', 'totalCount'].every((field, i) =>
                    obj[root + '/' + field]?.__increment === [receipt.cod, receipt.dod, 1][i]));
            if (window.__ledgerBlip && finalPacket) {
                const mode = window.__ledgerBlip; window.__ledgerBlip = null;
                window.__ledgerBlipFired.push(mode);
                if (mode === 'applied') {
                    Object.keys(obj).forEach(k => setPath(k, obj[k]));
                    logWrite({ m: 'PATCH', p: r.path, v: obj });
                }
                foreignLedgerScan(daily); fireAll();
                return Promise.reject(new Error('disconnect'));
            }
            Object.keys(obj).forEach((k) => setPath(base + k, obj[k])); logWrite({ m: 'PATCH', p: r.path, v: obj }); fireAll(); return Promise.resolve();
        },
        runTransaction: (r, fn) => {
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            const why = ledgerRuleViolation(r.path, next);
            if (why) return ruleDenied(why);
            const blip = window.__ledgerBlip;
            if (blip && /^zoew_daily_revenue_cod_dod\/[^/]+$/.test(r.path)) {
                window.__ledgerBlip = null;
                window.__ledgerBlipFired.push(blip);
                if (blip === 'applied') { setPath(r.path, next); logWrite({ m: 'PUT', p: r.path, v: next, tx: true }); }
                foreignLedgerScan(r.path);
                fireAll();
                return Promise.reject(new Error('disconnect'));
            }
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
        const pendingHolds = [], unmeasurable = [];
        // Independent server oracle: never exclude a provisional barcode from money on marker alone.
        // Require a matching prepared operation, exact marker identity and registry ownership.
        const provisionalSlot = (id, row) => {
            const m = row.scanPending;
            if (m == null) return null;
            const op = (s.zoew_scan_operations || {})[m.intent];
            const bc = row.barcodes && row.barcodes[m.slot];
            const reg = op && (s.zoew_barcode_registry || {})[op.registryKey];
            const cents = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && Math.round(n * 100) / 100 === n;
            const valid = m && typeof m === 'object' && Object.keys(m).sort().join(',') === 'actorUid,birth,code,intent,payloadHash,slot' &&
                /^scan_[a-f0-9]{32}$/.test(m.intent) && /^[a-f0-9]{64}$/.test(m.payloadHash) && /^(0|[1-9][0-9]{0,8})$/.test(m.slot) &&
                op && Object.keys(op).sort().join(',') === 'actorUid,birth,closedAt,cod,code,count,dod,id,locker,month,monthToken,payloadHash,phase,phone,registryKey,scanDate,scope,targetId,v' &&
                typeof op.scope === 'string' && op.scope.length > 0 && op.scope.length <= 2048 &&
                typeof op.phone === 'string' && op.phone.length > 0 && op.phone.length <= 2048 &&
                typeof op.locker === 'string' && op.locker.length > 0 && op.locker.length <= 2048 &&
                Number.isSafeInteger(op.closedAt) && op.closedAt >= 0 && (s.zoew_scan_pending || {})[m.intent] === op.actorUid &&
                typeof m.slot === 'string' && Object.values(row.barcodes || {}).filter(b => b && b.code === m.code).length === 1 &&
                op.v === 2 && op.phase === 'prepared' && op.id === m.intent && op.targetId === id && op.count === 1 &&
                op.actorUid === m.actorUid && typeof op.actorUid === 'string' && op.actorUid.length > 0 &&
                op.payloadHash === m.payloadHash && op.birth === m.birth && Number.isSafeInteger(op.birth) && op.birth > 0 &&
                typeof op.code === 'string' && op.code.length > 0 && op.code.length <= 256 && op.code === m.code &&
                typeof row.scanDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.scanDate) && op.scanDate === row.scanDate && op.month === row.scanDate.slice(0, 7) && op.phone === row.phone &&
                op.registryKey === op.code.trim().toUpperCase().replace(/[%.#$\[\]\/\x00-\x1F\x7F]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')) &&
                op.monthToken === 'op_m' + op.id.slice(5) && cents(op.cod) && cents(op.dod) &&
                bc && bc.code === op.code && bc.scanIntent === op.id && bc.createdAt === op.birth && bc.cod === op.cod && bc.dod === op.dod &&
                bc.locker === op.locker && (op.closedAt === 0 ? bc.isClosed === false && !bc.closedAt : bc.isClosed === true && bc.closedAt === op.closedAt) &&
                reg && Object.keys(reg).sort().join(',') === 'actorUid,birth,intent,v' &&
                reg.v === 2 && reg.intent === op.id && reg.actorUid === op.actorUid && reg.birth === op.birth;
            if (!valid) { unmeasurable.push(id + ': ambiguous scan pending'); return null; }
            pendingHolds.push(id + ':' + m.intent);
            return String(m.slot);
        };
        const provisional = new Map(Object.entries(hist).map(([id, row]) => [id, row ? provisionalSlot(id, row) : null]));
        Object.keys(hist).forEach((id) => {
            const it = hist[id];
            if (!it || it.scanDate !== dateKey) return;
            const bcs = bcsOf(it);
            if (bcs && bcs.length) Object.entries(it.barcodes).forEach(([slot, b]) => { if (b && slot !== provisional.get(id)) addBc(b); });
            else addBc({ cod: it.cod, dod: it.dod });
        });
        Object.keys(trash).forEach((id) => {
            const it = trash[id];
            if (!it || it.scanDate !== dateKey) return;
            const bcs = bcsOf(it);
            if (bcs && bcs.length) bcs.forEach((b) => { if (b.isDeducted !== true) addBc(b); });
            else if (it.isDeducted !== true) addBc({ cod: it.cod, dod: it.dod });
        });
        // M5 (ការសម្រេចម្ចាស់) ៖ «យករួច» តាមប្រាក់ ➜ copy ក្នុងធុងសំរាមដែលកាត់ប្រាក់ («ដក» · «ត្រឡប់») មិនរាប់ · barcode ដែលការស្តារ
        //    មិនទាន់ចប់បញ្ចូលក្នុងជួរ (ត្រា restore · `restoreAddedCodes` · គ្មាន provenance ➜ ទាំងអស់) មិនទាន់រាប់ ➜ ដេរីវេពីទិន្នន័យ មិនមែនពី helper របស់ App
        const deductedTrash = (it) => {
            const reason = typeof it.trashReason === 'string' ? it.trashReason : (it.isFromDeletion ? 'kept' : 'remove');
            return reason === 'remove' || reason === 'returned' || reason === 'misplaced' || reason === 'sent';
        };
        const restorePending = (it, code) => {
            if (it.restoreClaimId === undefined && it.restoreClaimToken === undefined) return false;
            let added = null;
            try { added = typeof it.restoreClaimToken === 'string' && typeof it.restoreAddedCodes === 'string' ? JSON.parse(it.restoreAddedCodes) : null; } catch (e) { added = null; }
            return !Array.isArray(added) || added.indexOf(code) !== -1;
        };
        let closedBarcodes = 0;
        const countClosed = (bag, inTrash) => Object.keys(bag).forEach((id) => {
            const it = bag[id];
            if (!it || it.scanDate !== dateKey) return;
            if (inTrash && deductedTrash(it)) return;
            const bcs = bcsOf(it);
            if (bcs && bcs.length) bcs.forEach((b) => { if (b.isClosed === true && (inTrash || (b !== it.barcodes?.[provisional.get(id)] && !restorePending(it, b.code)))) closedBarcodes++; });
            else if (it.isClosed === true) closedBarcodes++;
        });
        countClosed(hist, false); countClosed(trash, true);
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
        const registryKeyOf = (code) => String(code || '').trim().toUpperCase().replace(/[%.#$\[\]\/\x00-\x1F\x7F]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
        const liveKeys = {};
        Object.keys(seenCodes).forEach((c) => { liveKeys[registryKeyOf(c)] = true; });
        const reg = s.zoew_barcode_registry || {};
        const orphanKeys = Object.keys(reg).filter((k) => reg[k] === true && !liveKeys[k]);
        return {
            pendingHolds, unmeasurable, phoneSum: phoneSum, dupCodes: dupCodes, orphanKeys: orphanKeys, ruleRejects: window.__ruleRejects,
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
        it_a: mk('it_a', '0960000421', [{ code: 'AA1', cod: 10, dod: 0 }, { code: 'AA2', cod: 20.5, dod: 1.25 }]),
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

const ZTO_FINAL_KINDS = ['returned', 'misplaced', 'sent', 'left'];
let ztoFinalOpenSeq = 0;
const OPNAMES = ['scan', 'closeOrder', 'closeBarcode', 'removeBarcode', 'deleteItem', 'restore', 'heldCancel', 'editPrice', 'sweep', 'sweepPickup', 'origin', 'shopSweep', 'returned', 'ztoFinal'];
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
        const blipRuns = { applied: 0, lost: 0 };
        let heldRuns = 0;
        let scanSavedRuns = 0;
        let editLandedRuns = 0;
        let sweepRuns = 0;
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
            let broke = null, sweptRun = false;
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
                // ⛔ MONEY-4 ៖ ការចាក់ `ledgerBlip` លើ op ដែលសរសេរ ledger (ស្កេន · ដក · កែតម្លៃ) ➜ transaction ledger ថ្ងៃបន្ទាប់
                //    ចុះ/មិនដល់ + ឧបករណ៍ផ្សេងសរសេរ + `disconnect` (BOOT `__ledgerBlip`)
                const blip = (wanted === 'scan' || wanted === 'removeBarcode' || wanted === 'editPrice') && r() < 0.4 ? (r() < 0.5 ? 'applied' : 'lost') : null;
                const blipsBefore = blip ? await page.evaluate((mode) => { window.__ledgerBlip = mode; return window.__ledgerBlipFired.length; }, blip) : 0;
                // ធុងសំរាមដែលមានតែច្បាប់សម្អាតស្វ័យប្រវត្តិបង្កើត (`pickup` · `returned`) ➜ op `sweep`/`sweepPickup` ត្រូវបង្កើនវាពិតយ៉ាងហោចម្តង
                const autoTrash = () => page.evaluate(() => Object.values(window.__fakeStore.zoew_recently_deleted_cod_dod || {})
                    .filter((x) => x && (x.trashReason === 'pickup' || x.trashReason === 'returned')).length);
                const autoBefore = wanted === 'sweep' || wanted === 'sweepPickup' ? await autoTrash() : -1;
                const done = await page.evaluate(async (args) => {
                    const { wanted, pick, amt, isAdmin, ztoKind } = args;
                    const live = (typeof scanHistory !== 'undefined' ? scanHistory : []).filter(Boolean);
                    const trash = (typeof deletedItems !== 'undefined' ? deletedItems : []).filter(Boolean);
                    const at = (arr) => arr.length ? arr[Math.floor(pick * arr.length) % arr.length] : null;
                    const bcOf = (it) => (it && Array.isArray(it.barcodes) && it.barcodes.length) ? it.barcodes[Math.floor(pick * it.barcodes.length) % it.barcodes.length] : null;
                    // ⛔ React គូរប្រអប់ក្នុង microtask ➜ អានប្រអប់ភ្លាមក្រោយការហៅ = ប្រអប់មិនទាន់មាន ➜ op ទទេស្ងាត់ (ការស្កេន ២៩/៣០ ពីមុន)
                    const waitFor = async (test) => {
                        for (let i = 0; i < 30; i++) {
                            if (typeof window.commitNow === 'function') window.commitNow();
                            if (test()) return true;
                            await new Promise((res) => setTimeout(res, 16));
                        }
                        return false;
                    };
                    try {
                        if (wanted === 'scan' && isAdmin) {
                            const code = 'FZ' + Math.floor(pick * 1e6);
                            window.triggerScanAction(code);
                            const open = await waitFor(() => {
                                const modal = document.getElementById('phoneModal');
                                const bcText = document.getElementById('modalBarcodeText');
                                return !!modal && getComputedStyle(modal).display !== 'none' && !!bcText && bcText.innerText === code;
                            });
                            if (!open) return null;
                            const p = document.getElementById('modalPhoneInput'); if (p) p.value = pick > 0.5 ? '0960000421' : '09' + Math.floor(pick * 1e8);
                            const c = document.getElementById('modalCodInput'); if (c) c.value = String(amt);
                            const d2 = document.getElementById('modalDodInput'); if (d2) d2.value = '0';
                            await Promise.resolve(window.confirmPhone()).catch(() => {});
                            const saved = await waitFor(() => Object.values(window.__fakeStore.zoew_scan_history_cod_dod || {})
                                .some((x) => x && x.scanPending == null && Array.isArray(x.barcodes) && x.barcodes.some((bb) => bb && bb.code === code &&
                                    window.__fakeStore.zoew_scan_operations?.[bb.scanIntent]?.phase === 'committed')));
                            return saved ? 'scan:saved' : 'scan';
                        }
                        if (wanted === 'closeOrder') { const it = at(live); if (!it) return null; await window.toggleCloseStatus(it.id); return 'closeOrder'; }
                        if (wanted === 'closeBarcode') { const it = at(live); const b = bcOf(it); if (!it || !b) return null; await window.toggleIndividualBarcodeClose(it.id, b.code); return 'closeBarcode'; }
                        if (wanted === 'removeBarcode' && isAdmin) { const it = at(live); const b = bcOf(it); if (!it || !b) return null; await window.removeSingleBarcode(it.id, b.code); return 'removeBarcode'; }
                        if (wanted === 'deleteItem' && isAdmin) { const it = at(live); if (!it) return null; await window.deleteSingleItem(it.id); return 'deleteItem'; }
                        if (wanted === 'restore') { const it = at(trash); if (!it) return null; window.promptRestoreDeletedItem(it.id); await window.executeRestoreItem(); return 'restore'; }
                        // ⛔ ការស្តារដែលជាប់ ៖ ដាក់គូ (BOOT `__heldRestorePair`) ➜ ការលុបចោលស្វ័យប្រវត្តិពិត (`resumeBlockedRestoreCancellations`)
                        //    ≤ ៨ ដង (`restoreCancellationInFlight` ➜ ⏳ ➜ សាកម្តងទៀត) · ចុងក្រោយត្រូវដោះរួច (claim ធុងសំរាមចេញ · ជួរលែងកាន់)
                        //    · copy X ចេញ · អ្នកជិតខាង Y នៅ · ការសរសេរ = transaction លើជួរ និងធុងសំរាម (មិនមែន root PATCH)។
                        if (wanted === 'heldCancel') {
                            if (typeof window.resumeBlockedRestoreCancellations !== 'function' || typeof window.__heldRestorePair !== 'function') return null;
                            const pair = window.__heldRestorePair(pick, amt);
                            const store = window.__fakeStore;
                            const released = () => {
                                const t = (store.zoew_recently_deleted_cod_dod || {})[pair.t], h = (store.zoew_scan_history_cod_dod || {})[pair.h];
                                return !!t && !t.restoreClaim && !(h && (h.restoreClaimId !== undefined || h.restoreClaimToken !== undefined || h.restoreAddedCodes !== undefined));
                            };
                            const logFrom = (window.__writeLog || []).length;
                            for (let attempt = 0; attempt < 8 && !released(); attempt++) {
                                if (attempt) await new Promise((res) => setTimeout(res, 80));
                                await window.resumeBlockedRestoreCancellations();
                            }
                            if (!released()) return 'threw:heldCancel:held restore still held after 8 passes ' + JSON.stringify({ t: store.zoew_recently_deleted_cod_dod[pair.t], h: store.zoew_scan_history_cod_dod[pair.h] });
                            const rootPatch = (window.__writeLog || []).slice(logFrom).filter((e) => !e.owner && e.m === 'PATCH' && !e.p && e.v
                                && Object.prototype.hasOwnProperty.call(e.v, 'zoew_recently_deleted_cod_dod/' + pair.t + '/restoreClaim'));
                            if (rootPatch.length) return 'threw:heldCancel:cancellation wrote a root release ' + JSON.stringify(Object.keys(rootPatch[0].v));
                            const hAfter = (store.zoew_scan_history_cod_dod || {})[pair.h];
                            if (hAfter && (hAfter.barcodes || []).some((b) => b && b.code === pair.code)) return 'threw:heldCancel:restored copy left in the row';
                            if (pair.sib && !(hAfter && (hAfter.barcodes || []).some((b) => b && b.code === pair.sib))) return 'threw:heldCancel:sibling barcode lost';
                            if (store.zoew_recently_deleted_cod_dod[pair.t].restoreBlocked !== true) return 'threw:heldCancel:source lost its block';
                            return 'heldCancel:released';
                        }
                        if (wanted === 'origin') { const it = at(live); const b = bcOf(it); if (!it || !b || typeof window.saveBarcodeOrigins !== 'function') return null; const n = await window.saveBarcodeOrigins([{ code: b.code, from: pick > 0.5 ? 'Shopee SHPE' : 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ' }]); return n ? 'origin' : null; }
                        // ភស្តុតាង ZTO (Sign ➜ `ztoSignedAt` លើ barcode បិទ · ស្កេនត្រឡប់ ➜ `ztoReturnedAt` លើធុងសំរាម «ត្រឡប់» · ខុសទីតាំង (ឆ្លាស់គ្នា) ➜ `ztoMisplacedAt` បន្ថែម · បញ្ជូនចេញ ➜ `ztoSentOutAt` តែម្យ៉ាង (គ្មាន `ztoReturnedAt` ➜ មិន 🔒) · `left` ➜ គ្មានត្រា) ៖ ការសរសេរដាច់ដោយឡែក
                        if (wanted === 'ztoFinal') { const it = at(live); const b = bcOf(it); if (!it || !b || typeof window.syncZtoFinalMarks !== 'function') return null; if (b.isClosed) window.setZtoPickupVerdict(b.code, true); else { await window.claimAndCleanupItem(it.id, 'abandon', { codes: [b.code] }); window.noteZtoReturnedEvidence(b.code, Date.now(), ztoKind); } const n = await window.syncZtoFinalMarks(); return b.isClosed ? (n ? 'ztoFinal' : null) : 'ztoFinal:' + ztoKind; }
                        if (wanted === 'returned') { const it = at(live); const b = bcOf(it); if (!it || !b || b.isClosed || typeof window.claimAndCleanupItem !== 'function') return null; await window.claimAndCleanupItem(it.id, 'abandon', { codes: [b.code] }); return 'returned'; }
                        if (wanted === 'shopSweep') { if (typeof window.markZtoShopSweep !== 'function' || typeof window.getServerNow !== 'function') return null; return window.markZtoShopSweep(window.getServerNow()) ? 'shopSweep' : null; }
                        if (wanted === 'editPrice' && isAdmin) {
                            const it = at(live); const b = bcOf(it); if (!it || !b) return null;
                            window.openEditBarcodePriceModal(it.id, b.code);
                            if (!await waitFor(() => !!document.getElementById('editBcCodInput'))) return null;
                            const c = document.getElementById('editBcCodInput'); if (c) c.value = String(amt);
                            const d2 = document.getElementById('editBcDodInput'); if (d2) d2.value = '0';
                            window.saveEditedBarcodePrice();
                            const landed = await waitFor(() => {
                                const row = (window.__fakeStore.zoew_scan_history_cod_dod || {})[it.id];
                                const bb = row && Array.isArray(row.barcodes) ? row.barcodes.find((x) => x && x.code === b.code) : null;
                                return !!bb && Math.abs((parseFloat(bb.cod) || 0) - amt) < 0.005 && (parseFloat(bb.dod) || 0) === 0;
                            });
                            return landed ? 'editPrice:landed' : 'editPrice';
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
                }, { wanted, pick, amt, isAdmin: true, ztoKind: ZTO_FINAL_KINDS[ztoFinalOpenSeq % ZTO_FINAL_KINDS.length] });
                // ⛔ ប្រភេទភស្តុតាងត្រឡប់វិលឆ្លងជុំ (មិនមែនតាមទំព័រ) ៖ ជុំនីមួយៗមាន op `ztoFinal` លើ barcode បើកតិច ➜ លេខរាប់ក្នុងទំព័រ
                //    ចាប់ពីសូន្យរាល់ជុំ ហើយ `sent` មិនដែលកើត (`emu/app-writes-rules` ៖ ការសរសេរ `ztoSentOutAt` = ០)
                if (typeof done === 'string' && done.indexOf('ztoFinal:') === 0) ztoFinalOpenSeq++;
                if (blip) {
                    const fired = await page.evaluate(async (before) => {
                        for (let w = 0; w < 24 && window.__ledgerBlipFired.length === before; w++) await new Promise((res) => setTimeout(res, 25));
                        window.__ledgerBlip = null;
                        return window.__ledgerBlipFired.length > before ? window.__ledgerBlipFired[before] : null;
                    }, blipsBefore);
                    if (fired) { trail.push('ledgerBlip:' + fired); await page.waitForTimeout(300); }
                }
                await page.waitForTimeout(170);
                // ការសរសេរដែលមិនស្ងប់ ➜ FAIL មាន trail (មិនមែនសម្លាប់ process ដោយបាត់លំដាប់ដែលបង្កវា)
                const unsettled = await page.evaluate(async () => {
                    const started = performance.now();
                    while (typeof nativeWriteRecoveryState === 'function' && nativeWriteRecoveryState(db).pending > 0) {
                        if (performance.now() - started >= 1500) return nativeWriteRecoveryState(db).pending;
                        await new Promise(resolve => setTimeout(resolve, 25));
                    }
                    return 0;
                });
                if (autoBefore >= 0 && (done === 'sweep' || done === 'sweepPickup') && await autoTrash() > autoBefore) sweptRun = true;
                const dbg = process.env.FUZZ_DEBUG === '1';
                if (done) trail.push(done);
                if (unsettled) { broke = 'ការសរសេរ ' + unsettled + ' មិនស្ងប់មុនការពិនិត្យអថេរ ក្រោយ [' + trail.join(' > ') + ']'; break; }
                if (done && String(done).indexOf('threw:') === 0) { broke = 'op threw: ' + done; break; }
                const inv = await page.evaluate((k) => window.__invariant(k), seed._dateKey);
                if (dbg && done) console.log('    #' + i + ' ' + done + ' -> ' + JSON.stringify(inv));
                if (inv.unmeasurable.length || inv.expectCod !== inv.gotCod || inv.expectDod !== inv.gotDod || inv.expectCount !== inv.gotCount) {
                    broke = 'invariant broke after [' + trail.join(' > ') + ']\n        ' + JSON.stringify(inv);
                    if (process.env.FUZZ_DEBUG === '1') {
                        const dump = await page.evaluate(() => ({
                            hist: window.__fakeStore.zoew_scan_history_cod_dod,
                            trash: window.__fakeStore.zoew_recently_deleted_cod_dod,
                            rev: window.__fakeStore.zoew_daily_revenue_cod_dod,
                            phase: typeof connectionFlowSnapshot === 'function' ? connectionFlowSnapshot() : null,
                            recovery: typeof nativeWriteRecoveryState === 'function' ? nativeWriteRecoveryState(db) : null,
                            journal: Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:')).map(k => JSON.parse(localStorage.getItem(k))),
                            toasts: document.getElementById('toastContainer')?.textContent,
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
            // ⛔ សញ្ញារបៀបធុងសំរាមរបស់ហាង (`zoew_settings/zto_trash_mode`) ៖ ផ្លូវសរសេរពិតរបស់ `markZtoTrashMode()` · សរសេរក្រោយការផ្ទៀងចុងក្រោយ
            //    ដើម្បីកុំឲ្យឧបករណ៍ fuzz (គ្មាន Lookup) ប្តូរទៅច្បាប់ ZTO កណ្តាលជុំ ➜ app-writes-rules replay វាជាមួយ rules ពិត
            //    ⛔ ការសរសេររបៀបធុងសំរាមទាំងអស់ផ្ញើតែពេលភ្ជាប់ (`ztoTrashModeWritable()`) ហើយ fake `fireAll()` បាញ់ `.info/connected` ដោយតម្លៃ null
            //       ក្រោយការសរសេរនីមួយៗ (App ក្លាយជា offline) ➜ harness ផ្តល់ការតភ្ជាប់មុនការហៅនីមួយៗ (`online()`) + នាឡិកាទុកចិត្ត ពេញប្លុកនេះ
            //       (ត្រា · ដក · សម្អាត) ហើយដាក់វិញនៅចុងក្រោយ
            if (CAPTURE) await page.evaluate(async () => {
                if (typeof window.markZtoTrashMode !== 'function') return;
                const trusted = window.serverClockTrusted, connected = window.isDatabaseConnected;
                const online = () => { window.isDatabaseConnected = true; };
                window.serverClockTrusted = true;
                try {
                    online();
                    window.markZtoTrashMode('palm');
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    // ⛔ FIXSHOP-3 ៖ ត្រាតាមឧបករណ៍ (`palm/<សោឧបករណ៍>`) ៖ ការដកត្រារបស់ខ្លួន (`withdrawZtoTrashMode()` ៖ transaction លើសោខ្លួនឯង ➜ null)
                    //    និងការសម្អាតត្រាចាស់របស់ឧបករណ៍ផ្សេង (`pruneZtoTrashMode()` ៖ CAS លើតម្លៃដែលឃើញ ➜ null) ជាផ្លូវសរសេរពិតដែល replay ជាមួយ rules ពិតដែរ
                    if (typeof window.withdrawZtoTrashMode !== 'function' || typeof window.noteZtoTrashMode !== 'function') return;
                    window.__setPath('zoew_settings/zto_trash_mode/palm/fuzzolddevice01', Date.now() - 8 * 24 * 60 * 60 * 1000);
                    window.noteZtoTrashMode(window.__fakeStore.zoew_settings && window.__fakeStore.zoew_settings.zto_trash_mode);
                    online();
                    window.withdrawZtoTrashMode('palm');
                    // ⛔ fake SDK គ្មាន `.info/serverTimeOffset` ➜ `cleanupClockIsTrustworthy()` ពឹងលើនាឡិកាទុកចិត្តដែល harness ផ្តល់ខាងលើ
                    online();
                    if (typeof window.pruneZtoTrashMode === 'function') window.pruneZtoTrashMode();
                    // ⛔ ជម្រើស ឃ ៖ វេនអានបញ្ជី Sign របស់សាខា (`zoew_settings/zto_sweep_lead/<lane>`) ៖ ផ្លូវសរសេរពិតរបស់ `claimZtoSweepLane()`
                    //    (transaction ពិនិត្យជាមួយការកក់ចុងក្រោយ) ៖ ការកក់ដំបូង (បង្កើត) និងការកក់ជាន់វេនចាស់របស់ឧបករណ៍ផ្សេង (សរសេរជាន់)
                    //    ➜ app-writes-rules replay ជាមួយ rules ពិត · មិន await ៖ ការរង់ចាំ journal ខាងក្រោមចាប់ log
                    if (typeof window.claimZtoSweepLane === 'function' && typeof window.noteZtoSweepLane === 'function' && typeof window.ztoSweepLaneTurn === 'function') {
                        const lanes = () => window.__fakeStore.zoew_settings && window.__fakeStore.zoew_settings.zto_sweep_lead;
                        online();
                        window.noteZtoSweepLane(lanes());
                        window.claimZtoSweepLane(window.ztoSweepLaneTurn('cookie_zoew123_com', 20000));
                        window.__setPath('zoew_settings/zto_sweep_lead/palm_85501', { device: 'fuzzolddevice01', at: Date.now() - 60 * 60 * 1000 });
                        online();
                        window.noteZtoSweepLane(lanes());
                        window.claimZtoSweepLane(window.ztoSweepLaneTurn('palm_85501', 20000));
                    }
                    // ⛔ ការត្រា · ការដក · ការសម្អាតទៅតាម journal ការសរសេរ (Web Locks · ការផ្ទៀងផ្ទាត់ recovery) ➜ រង់ចាំរហូតការសរសេររង់ចាំអស់ (ពិដាន 1500ms)
                    //    មុនអាន log ៖ macrotask តែមួយជាការប្រណាំង (ចាប់បានតែខ្លះនៃជុំ ឬគ្មានសោះ)
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    const started = performance.now();
                    while (typeof nativeWriteRecoveryState === 'function' && nativeWriteRecoveryState(db).pending > 0 && performance.now() - started < 1500) {
                        await new Promise((resolve) => setTimeout(resolve, 25));
                    }
                } finally {
                    window.serverClockTrusted = trusted;
                    window.isDatabaseConnected = connected;
                }
            });
            if (CAPTURE) CAPTURE.push({ run: run, seed: seed, log: await page.evaluate(() => window.__writeLog || []) });
            appRuns++;
            if (trail.indexOf('other:remove') !== -1) staleViewRuns++;
            if (trail.indexOf('ledgerBlip:applied') !== -1) blipRuns.applied++;
            if (trail.indexOf('ledgerBlip:lost') !== -1) blipRuns.lost++;
            if (sweptRun) sweepRuns++;
            if (trail.indexOf('heldCancel:released') !== -1) heldRuns++;
            if (trail.indexOf('scan:saved') !== -1) scanSavedRuns++;
            if (trail.indexOf('editPrice:landed') !== -1) editLandedRuns++;
            if (broke) { appFail++; if (!lastDetail) lastDetail = 'app=' + app + ' run=' + run + ' ' + broke; }
            await ctx.close();
        }
        check(appFail === 0, app + ': invariant ចំណូល រក្សាបាន ក្នុង ' + appRuns + ' លំដាប់ចៃដន្យ × ' + OPS + ' ប្រតិបត្តិការ', lastDetail);
        // ⛔ ជាន់អប្បបរមា ៖ បើការចាក់ «ឧបករណ៍ផ្សេងដក» មិនដែលបាញ់សោះ នោះ
        // ការរត់នេះមិនបានទៅដល់ស្ថានភាព **ទិដ្ឋភាពមូលដ្ឋានចាស់** ទេ ➜ បៃតងក្លែងក្លាយ។
        check(staleViewRuns > 0, app + ': ការចាក់ «ឧបករណ៍ផ្សេងដក» បានបាញ់ពិត (' + staleViewRuns + ' លំដាប់)',
            'គ្មានលំដាប់ណាឈានដល់ទិដ្ឋភាពមូលដ្ឋានចាស់ ➜ ការវាស់មិនបានគ្រប');
        // ⛔ ជាន់អប្បបរមា ៖ `ledgerBlip` ទាំងពីររបៀប (ការសរសេរចុង + ឧបករណ៍ផ្សេង · មិនដល់ + ឧបករណ៍ផ្សេង) ត្រូវបាញ់ពិត
        check(blipRuns.applied > 0 && blipRuns.lost > 0, app + ': ledgerBlip បានបាញ់ពិត (applied ' + blipRuns.applied + ' · lost ' + blipRuns.lost + ' លំដាប់)',
            'ការចាក់ disconnect + ឧបករណ៍ផ្សេងលើ ledger មិនដែលបាញ់ ➜ MONEY-4 មិនបានវាស់');
        // ⛔ ជាន់អប្បបរមា ៖ ច្បាប់សម្អាតស្វ័យប្រវត្តិ (២ ម៉ោង/៧ ថ្ងៃ) ត្រូវផ្លាស់ទីកញ្ចប់ទៅធុងសំរាមពិតក្នុង op `sweep`/`sweepPickup` ·
        //    បើ `cleanupClockIsTrustworthy()` មិនពិតក្នុង harness (ម៉ោង Server/ការតភ្ជាប់ក្លែងខូច) op ទាំងនោះទទេ ➜ ផ្លូវលុយនៃការសម្អាតមិនបានវាស់
        check(sweepRuns > 0, app + ': ច្បាប់សម្អាតស្វ័យប្រវត្តិ (op sweep) ផ្លាស់កញ្ចប់ទៅធុងសំរាមពិត (' + sweepRuns + ' លំដាប់)',
            'op `sweep`/`sweepPickup` មិនដែលបង្កើតធុងសំរាម `pickup`/`returned` ➜ `runAutomaticCleanupRules()` មិនបានរត់ក្នុង harness');
        // ⛔ ជាន់អប្បបរមា ៖ ការលុបចោលស្វ័យប្រវត្តិត្រូវដោះការស្តារដែលជាប់ពិត (provenance ➜ ដក copy · ដោះ claim) ➜ អថេរចំណូលនៅពិតក្រោយវា
        check(heldRuns > 0, app + ': ការលុបចោលការស្តារដែលជាប់ (resumeBlockedRestoreCancellations) ដោះពិត (' + heldRuns + ' លំដាប់)',
            'op `heldCancel` មិនដែលដោះការស្តារដែលជាប់ ➜ ផ្លូវសរសេរ cancelBlockedRestore មិនបានវាស់');
        // ⛔ ជាន់អប្បបរមា ៖ ការស្កេន និងការកែតម្លៃត្រូវដល់ server ពិត (ប្រអប់គូររួច) មិនមែនត្រឹមត្រូវបានជ្រើស ➜ ដោយគ្មានវា ចំណូលពីការស្កេន · companion · ledgerBlip លើការស្កេន មិនដែលត្រូវ fuzz
        check(scanSavedRuns > 0 && editLandedRuns > 0, app + ': ការស្កេនរក្សាទុកពិត (' + scanSavedRuns + ' លំដាប់) · ការកែតម្លៃដល់ server (' + editLandedRuns + ' លំដាប់)',
            'op scan/editPrice មិនដែលដល់ server ➜ ផ្លូវចំណូលការស្កេន/កែតម្លៃមិនបានវាស់');
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
