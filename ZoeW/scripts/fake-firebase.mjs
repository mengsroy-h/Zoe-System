/**
 * Firebase SDK ក្លែងក្លាយ — ចាក់ចូលទំព័រ **មុន** App ចាប់ផ្តើម។
 *
 * ⛔ វាមិនមែនជា mock ទេ ៖ វាជា RTDB ក្នុងសតិពិតៗ (path · listener ·
 *    transaction · increment) ➜ App ដើរផ្លូវកូដដដែលនឹងផលិតកម្ម។ បើគ្មានវា
 *    App ឈប់ត្រឹមប្រអប់ Config ហើយ **គ្មានតារាងណាគូរសោះ** ➜ ការវាស់
 *    parity នឹងប្រៀបធៀបអេក្រង់ទទេ ២ ដែលគ្មានន័យ។
 */
export const FAKE_SDK = function (seed) {
    const data = JSON.parse(JSON.stringify(seed));
    const listeners = [];
    window.__writeLog = [];

    function getPath(p) {
        if (!p) return data;
        let cur = data;
        for (const part of String(p).split('/')) {
            if (cur === null || cur === undefined) return null;
            cur = cur[part];
        }
        return cur === undefined ? null : cur;
    }
    function setPath(p, v) {
        const parts = String(p).split('/');
        let cur = data;
        for (let i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        const last = parts[parts.length - 1];
        if (v === null) delete cur[last];
        else if (v && typeof v === 'object' && v.__fakeIncrement !== undefined) cur[last] = (Number(cur[last]) || 0) + v.__fakeIncrement;
        else cur[last] = v;
    }
    function snapOf(p) {
        const v = getPath(p);
        return {
            val: () => (v === undefined || v === null ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v)),
            exists: () => v !== null && v !== undefined
        };
    }
    function fire(p) {
        listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) { window.__listenerThrew = String(e && e.message); } });
    }
    /* ⛔ `.info/*` មិនមែនទិន្នន័យទេ ៖ RTDB ពិតមិនបាញ់ `.info/connected` ពេលមាន
     * ការសរសេរ។ ជំនាន់មុនបាញ់វាដោយតម្លៃ `null` រាល់ការសរសេរ ➜ App ទាំង ២
     * ជឿថា **ដាច់បណ្តាញមួយភ្លែត** ក្រោយរាល់ការសរសេរ ➜ `status-dot offline`
     * ភ្លឹបភ្លែតតាមម៉ោងនៃការវាស់ (ភាពខុសគ្នាក្លែងក្លាយ) ហើយផ្លូវភ្ជាប់ឡើងវិញ
     * ត្រូវកេះដោយគ្មានហេតុ។ */
    function fireAll() { [...new Set(listeners.map((l) => l.path))].filter((p) => !p.startsWith('.info')).forEach(fire); }
    window.__fireAll = fireAll;
    /* ⛔ `op + path` តែម្យ៉ាងមិនគ្រប់ទេ ៖ App ២ អាចសរសេរ **ចំនួនលុយខុសគ្នា**
     * ទៅ path ដដែល ➜ ការវាស់ត្រូវកត់ **តម្លៃពេញ** និងអាចចាក់ស្ថានភាព DB
     * ទាំងមូល (`__fakeDump`) ដើម្បីប្រៀបធៀបស្ថានភាព server ចុងក្រោយ។ */
    const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x === 'object' && x.__fakeIncrement !== undefined ? { '+': x.__fakeIncrement } : x))));
    window.__fakeDump = () => JSON.parse(JSON.stringify(data));

    /* ⛔ ការតភ្ជាប់ត្រូវនៅ **រស់** ៖ បើ `.info/connected` បាញ់តែម្តង
     * ជណ្តើរភ្ជាប់ឡើងវិញរបស់ App នឹងឡើងជាន់ៗ ហើយ App ២ ដែលចាប់ផ្តើម
     * ខុសគ្នា ២០០ ms នឹងឈរលើជាន់ខុសគ្នានៅពេលវាស់ ➜ ភាពខុសគ្នាក្លែងក្លាយ។
     * ការបាញ់ជាប់ៗគ្នាធ្វើត្រាប់តាម RTDB ពិតបានត្រឹមត្រូវជាង។ */
    setInterval(() => {
        listeners.filter((l) => l.path === '.info/connected').forEach((l) => { try { l.cb({ val: () => true }); } catch (e) {} });
    }, 800);

    let fakeEmail = 'a@b.c';
    try { fakeEmail = window.localStorage.getItem('__fake_email') || fakeEmail; } catch (e) {}
    const user = { uid: 'u1', email: fakeEmail, getIdToken: () => Promise.resolve('tok'), metadata: { lastSignInTime: new Date().toISOString() } };
    /* ⛔ auth ត្រូវមាន **ស្ថានភាព** ៖ ជំនាន់មុនបាញ់ `onAuthStateChanged` តែ
     * ម្តង ហើយ `signOut` មិនធ្វើអ្វីសោះ ➜ ផ្លូវចាកចេញ/ចូលវិញ **មិនដែល
     * ត្រូវវាស់** (ស្ថានភាពដែលមិនដែលដាក់ចូល)។ auth ពិតជូនដំណឹងអ្នកស្តាប់
     * ទាំងអស់ រាល់ការប្តូរ ➜ ធ្វើត្រាប់តាមវាឲ្យដូចគ្នាទាំង ២ App។ */
    const authObj = { currentUser: user };
    const authListeners = [];
    const setUser = (u) => {
        authObj.currentUser = u;
        authListeners.slice().forEach((cb) => { try { cb(u); } catch (e) { window.__listenerThrew = String(e && e.message); } });
    };
    window.__fakeAuth = { signOut: () => setUser(null), signIn: () => setUser(user) };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'fake' }),
        getApps: () => [],
        deleteApp: () => Promise.resolve(),
        getAuth: () => authObj,
        onAuthStateChanged: (a, cb) => {
            authListeners.push(cb);
            setTimeout(() => cb(authObj.currentUser), 0);
            return () => { const i = authListeners.indexOf(cb); if (i !== -1) authListeners.splice(i, 1); };
        },
        signInWithEmailAndPassword: () => new Promise((resolve) => setTimeout(() => { setUser(user); resolve({ user }); }, 0)),
        signOut: () => new Promise((resolve) => setTimeout(() => { setUser(null); resolve(); }, 0)),
        setPersistence: () => Promise.resolve(),
        browserLocalPersistence: {}, browserSessionPersistence: {},
        // ⛔ `token` ចាំបាច់ ៖ `ztoIdToken()` អានវា ➜ បើអត់ ការទាញបញ្ជី ZTO ធ្លាក់ `idtoken:missing` ទាំង ២ App
        getIdTokenResult: () => Promise.resolve({ token: 'fake-id-token', authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }),
        ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
        onValue: (r, cb) => {
            listeners.push({ path: r.path, cb });
            setTimeout(() => {
                if (r.path === '.info/connected') cb({ val: () => true });
                else if (r.path === '.info/serverTimeOffset') cb({ val: () => 0 });
                else cb(snapOf(r.path));
            }, 0);
            return () => {};
        },
        off: () => {},
        get: (r) => Promise.resolve(snapOf(r.path)),
        set: (r, v) => { window.__writeLog.push({ op: 'set', path: r.path, value: clone(v) }); setPath(r.path, v); fireAll(); return Promise.resolve(); },
        update: (r, obj) => {
            window.__writeLog.push({ op: 'update', path: r.path, keys: Object.keys(obj), value: clone(obj) });
            Object.keys(obj).forEach((k) => setPath((r.path ? r.path + '/' : '') + k, obj[k]));
            fireAll(); return Promise.resolve();
        },
        goOnline: () => {}, goOffline: () => {},
        increment: (amount) => ({ __fakeIncrement: Number(amount) }),
        runTransaction: (r, fn) => {
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            window.__writeLog.push({ op: 'txn', path: r.path, value: next === undefined ? '<abort>' : clone(next) });
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            setPath(r.path, next); fireAll();
            return Promise.resolve({ committed: true, snapshot: snapOf(r.path) });
        }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

/**
 * ស្តុបម៉ូឌុល License ៖ បើគ្មានវា App ឈប់ត្រឹមប្រអប់ Activation Key
 * ➜ listener មិនដែលភ្ជាប់ ➜ គ្មានតារាងណាគូរ។
 */
export const LICENSE_STUB = `window.ZoeLicense = {
    getStatus: function () { return Promise.resolve({ state: 'active' }); },
    setServerTimeOffset: function () {},
    syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ ok: true }); },
    verifyKeyString: function () { return Promise.resolve({ ok: true }); },
    clearActivation: function () {}
};`;

/**
 * ⛔ **ពេលវេលាចាប់ផ្តើមថេរ** ៖ ទិន្នន័យគំរូចងនឹងថ្ងៃ `2026-09-22` ➜ ឧបករណ៍
 *    វាស់ត្រូវដាក់នាឡិកា browser នៅ `HARNESS_CLOCK_START` (តាម
 *    `page.clock.install()`) បើមិនដូច្នេះ វាស់បានតែនៅថ្ងៃនោះ ៖ ក្រោយ
 *    ពាក់កណ្តាលអធ្រាត្រនៅភ្នំពេញ ទិដ្ឋភាព «ថ្ងៃនេះ» ទទេទាំង ២ App ➜
 *    ជំហានវាស់អ្វីក៏មិនបាន ខណៈនៅតែរាយ ✅ (វាស់បាន ៖ `parity:live`
 *    រាយ «តារាងទទេ» នៅ 02:44 ម៉ោងភ្នំពេញ)។
 *
 * ⛔ ៣ ម៉ោងក្រោយ `SEED_NOW` ដោយចេតនា ៖ BB1 បិទ ៣.៥ ម៉ោងមុន ➜ ច្បាប់
 *    **២ ម៉ោង** រត់ពេលផ្ទុក **រាល់ដង** (មុននេះវារត់ឬមិនរត់ តាមម៉ោងជាក់ស្តែង)។
 */
export const SEED_NOW = Date.UTC(2026, 8, 22, 3, 0, 0);
export const HARNESS_CLOCK_START = SEED_NOW + 3 * 3600000;

/** ទិន្នន័យគំរូ ៖ គ្រប សាខាគូរទាំងអស់ (COD · DOD · បិទ · ខល · Locker · ធុងសំរាម)។ */
export function seedData(nowMs) {
    const now = nowMs || SEED_NOW;
    const day = '2026-09-22';
    const mkBarcode = (code, cod, dod, locker, closed) => ({
        code, cod, dod, locker, isClosed: closed, isDeducted: false, isFromDeletion: false,
        createdAt: now - 3600000, time: `09:00:00 (${day})`, ...(closed ? { closedAt: now - 1800000 } : {})
    });
    return {
        zoew_scan_history_cod_dod: {
            i1: { id: 'i1', phone: '012345678', cod: 12.5, dod: 2.5, price: 15, count: 2, isClosed: false, isCalled: false,
                barcodes: [mkBarcode('AA1', 10, 2.5, 'A1', false), mkBarcode('AA2', 2.5, 0, 'A1', false)],
                time: `08:10:00 (${day})`, scanDate: day, createdAt: now - 7200000 },
            i2: { id: 'i2', phone: '0977777777', cod: 30, dod: 0, price: 30, count: 1, isClosed: true, isCalled: true,
                callMark: 'no-answer', callMarkTime: now - 5 * 3600000,
                barcodes: [mkBarcode('BB1', 30, 0, 'B2', true)],
                time: `08:20:00 (${day})`, scanDate: day, createdAt: now - 6 * 3600000, closedAt: now - 1800000 },
            i3: { id: 'i3', phone: 'គ្មានលេខ', cod: 0, dod: 4.25, price: 4.25, count: 1, isClosed: false, isCalled: false,
                barcodes: [mkBarcode('CC1', 0, 4.25, '', false)],
                time: `08:30:00 (${day})`, scanDate: day, createdAt: now - 30 * 3600000 },
            i4: { id: 'i4', phone: '0888888', cod: 7, dod: 0, price: 7, count: 1, isClosed: false, isCalled: false,
                callMark: 'wrong-number',
                barcodes: [mkBarcode('DD1', 7, 0, 'VIP-3', false)],
                time: `08:40:00 (${day})`, scanDate: day, createdAt: now - 3600000 }
        },
        zoew_recently_deleted_cod_dod: {
            d1: { id: 'd1', phone: '011223344', cod: 5, dod: 0, price: 5, count: 1, isClosed: false,
                trashReason: 'remove', isDeducted: true, isFromDeletion: false, deletedAt: now - 3600000,
                barcodes: [mkBarcode('EE1', 5, 0, '', false)], time: `07:00:00 (${day})`, scanDate: day, createdAt: now - 8 * 3600000 }
        },
        zoew_daily_revenue_cod_dod: { [day]: { codDollar: 49.5, dodDollar: 6.75, totalPackages: 5 } },
        zoew_monthly_revenue_cod_dod: { '2026-09': { codDollar: 49.5, dodDollar: 6.75, totalPackages: 5 } },
        zoew_daily_pickup_cod_dod: { [day]: { packagesPickedUp: 1, pickedUpPhones: { '0977777777': 1 }, pickedUpBarcodes: { BB1: '0977777777' } } },
        zoew_daily_collected_cod_dod: { [day]: { BB1: { c: 30, d: 0 } } },
        zoew_settings: { exchange_rate: 4100 },
        zoew_barcode_registry: { AA1: 'i1', AA2: 'i1', BB1: 'i2', CC1: 'i3', DD1: 'i4' }
    };
}
