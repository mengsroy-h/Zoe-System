// ⛔ ថ្នាក់កំហុស៖ **ការសរសេរដែលបាត់ ព្រោះអ្នកប្រើចាកចេញពី App**។
//
// 🔴 កំហុសផលិតកម្មពិត (Sentry, 2026-08-27, កំណែ 2.20.1)៖
//   ប៊ូតុង «📞 ខល» ជា <a href="tel:…"> **បូក** data-act="handleCallAction"។
//   ការចុចបើកកម្មវិធីទូរស័ព្ទ ➜ iOS ផ្អាក PWA ➜ WebSocket របស់ RTDB ដាច់ ➜
//   transaction ដែលផ្ញើទៅរួចតែមិនទាន់បញ្ជាក់ ត្រូវ SDK បោះបង់៖
//       FIREBASE WARNING: transaction at /zoew_scan_history_cod_dod/id_… failed: disconnect
//   promise បដិសេធ ➜ `patchHistoryItemFields()` revert ➜ ស្លាក «✔️ ខល»
//   លោតត្រឡប់ទៅ «📞 ខល» ➜ អ្នកប្រើត្រូវចុចម្តងទៀត **ដែលខលលេខនោះម្តងទៀត**។
//
// ⛔ SDK **មិន retry** ការបោះបង់នេះទេ — promise ដែលបដិសេធ មានន័យថាវាបោះបង់
//   ជាស្ថាពរ។ ដូច្នេះការកែមិនមែន «កុំ revert» ទេ គឺ **រត់ patch នោះឡើងវិញ
//   ក្រោយភ្ជាប់មកវិញ**។
//
// ឧបករណ៍នេះអះអាង **២ ខាង** — បើអះអាងតែថា «មិន revert» នោះការមិនធ្វើអ្វីសោះ
// ក៏បៃតងដែរ ខណៈការសរសេរនោះបាត់ជារៀងរហូត៖
//   ១. ការដាច់បណ្តាញ ➜ **មិន revert** ហើយចូលជួរ
//   ២. ការភ្ជាប់មកវិញ ➜ ការសរសេរ **ទៅដល់ server ពិត**
//   ៣. កំហុសដែល **មិនមែន** ការដាច់ (permission_denied) ➜ **ត្រូវ revert ដដែល**
//      (បើមិនដូច្នេះ ការបដិសេធពិតនឹងចូលជួររហូតជារៀងរហូត)
//   ៤. ផ្លូវ `saveEditedPhone` (គ្មាន opt-in) ➜ **ត្រូវ revert ដដែល** ព្រោះវាមាន
//      ការទូទាត់ស្ថិតិយក (`revertPickupRefMove`) ដែលពឹងលើ promise ដែលដោះភ្លាម
//   ៥. ស្លាកទាំង ៣ (`no-answer` · `no-connect` · `wrong-number`) និងការសម្អាត
//      ត្រូវរស់រានឆ្លងកាត់ការដាច់បណ្តាញ — សំណើផ្ទាល់របស់អ្នកប្រើ
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.HISTPATCH_APP_DIR ? path.resolve(process.env.HISTPATCH_APP_DIR) : path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

let SRC = '';
try { SRC = fs.readFileSync(APP_JS, 'utf8'); } catch (e) { SRC = ''; }

// ⛔ ជាន់អប្បបរមា — «គ្មានលំនាំអាក្រក់» ពិតដោយស្វ័យប្រវត្តិលើ input ទទេ។
ok('អាន ZoeW/app.js បាន (ជាន់អប្បបរមា)', SRC.length > 100000, SRC.length);
const callSites = (SRC.match(/patchHistoryItemFields\(/g) || []).length;
ok('រកឃើញកន្លែងហៅ patchHistoryItemFields >= 5', callSites >= 5, callSites);
['no-answer', 'no-connect', 'wrong-number'].forEach((m) => {
    ok('ស្លាកការខល ' + m + ' នៅមានក្នុងកូដ', SRC.indexOf("'" + m + "'") !== -1);
});

function sliceFn(name) {
    let start = SRC.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (SRC.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = SRC.indexOf('{', start), started = false;
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return SRC.slice(start, i);
}

const FNS = ['patchHistoryItemFields', 'historyPatchErrorIsDisconnect', 'queueHistoryPatchRetry',
    'flushPendingHistoryPatches', 'handleCallAction', 'setCallMark'];
const src = {};
FNS.forEach((n) => {
    src[n] = sliceFn(n);
    ok('រកឃើញ function ' + n + '()', !!src[n]);
});

const DECLS = ['pendingHistoryPatches', 'HISTORY_PATCH_RETRY_MAX', 'HISTORY_PATCH_QUEUE_MAX', 'historyPatchFlushInFlight'];
const decls = [];
DECLS.forEach((n) => {
    const m = SRC.match(new RegExp('^ *(?:let|const) ' + n + ' = .*$', 'm'));
    ok('រកឃើញការប្រកាស ' + n, !!m);
    if (m) decls.push(m[0]);
});

// ការសាង sandbox ត្រូវរត់ទោះខ្វះ function — ការធ្លាក់ត្រូវប្រាប់ថា *អ្វី* ខូច
// មិនមែនបញ្ឈប់ការអះអាងឥរិយាបថទាំងអស់ខាងក្រោមវា (មេរៀន 2.19.3)។
function build(mode, opts) {
    const server = (opts && opts.server) || {};
    const toasts = [];
    const ctx = {
        console: { error: () => {}, log: () => {} },
        window: {},
        Object: Object, Array: Array, Promise: Promise, JSON: JSON, String: String, Math: Math,
        setTimeout: setTimeout, clearTimeout: clearTimeout,
        db: {}, dbRefHistory: {},
        scanHistory: (opts && opts.scanHistory) || [],
        markingItemId: (opts && opts.markingItemId) || null,
        showToast: (t) => toasts.push(t),
        closeModal: () => {},
        refreshCurrentHistoryView: () => {},
        scheduleHistoryViewRefresh: () => {},
        normalizeBarcodesOf: (x) => x,
        getServerNow: () => 1700000000000,
        __server: server,
        __toasts: toasts,
        __mode: { value: mode }
    };
    ctx.fb = {
        ref: (d, p) => ({ path: p }),
        runTransaction: (ref, updater) => {
            const m = ctx.__mode.value;
            if (m === 'disconnect') return Promise.reject(new Error('disconnect'));
            if (m === 'denied') return Promise.reject(new Error('permission_denied'));
            const id = String(ref.path).split('/').pop();
            const cur = server[id] ? JSON.parse(JSON.stringify(server[id])) : null;
            const out = updater(cur);
            if (out === undefined || out === null) return Promise.resolve({ committed: false, snapshot: null });
            server[id] = out;
            return Promise.resolve({ committed: true, snapshot: { val: () => JSON.parse(JSON.stringify(out)) } });
        }
    };
    vm.createContext(ctx);
    decls.forEach((d) => { try { vm.runInContext(d, ctx); } catch (e) {} });
    FNS.forEach((n) => { if (src[n]) { try { vm.runInContext(src[n], ctx); } catch (e) {} } });
    return ctx;
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }

async function scenario(label, fn) {
    try { await fn(); } catch (e) { ok(label + ' (គាំង)', false, e && e.message); }
}

(async () => {
    await scenario('ការចាត់ថ្នាក់កំហុស', async () => {
        const ctx = build('ok');
        const isDis = (v) => vm.runInContext('historyPatchErrorIsDisconnect(' + v + ')', ctx);
        ok('disconnect ➜ ចាត់ជាការដាច់បណ្តាញ', isDis('new Error("disconnect")') === true);
        ok('permission_denied ➜ មិនមែនការដាច់បណ្តាញ', isDis('new Error("permission_denied")') === false);
        ok('Timed out ➜ មិនមែនការដាច់បណ្តាញ', isDis('new Error("Timed out")') === false);
    });

    // ស្លាកទាំង ៣ + ការសម្អាត — សំណើផ្ទាល់របស់អ្នកប្រើ
    for (const mark of ['no-answer', 'no-connect', 'wrong-number', null]) {
        const name = mark || 'សម្អាតសម្គាល់';
        await scenario('ស្លាក ' + name, async () => {
            // ⛔ ស្លាកដើមត្រូវ **ខុស** ពីស្លាកដែលកំពុងសាក បើមិនដូច្នេះ ការ revert
            // មើលទៅដូចការមិន revert ➜ ការអះអាងបៃតងក្លែងក្លាយ។
            const before = mark === 'no-answer' ? 'wrong-number' : 'no-answer';
            const item = { id: 'id1', phone: '012345678', callMark: before, callMarkTime: 111 };
            const server = { id1: { id: 'id1', phone: '012345678', callMark: before, callMarkTime: 111 } };
            const ctx = build('disconnect', { server: server, scanHistory: [item], markingItemId: 'id1' });
            vm.runInContext('setCallMark(' + (mark === null ? 'null' : '"' + mark + '"') + ');', ctx);
            await tick(); await tick();
            const local = ctx.scanHistory[0];
            if (mark === null) {
                ok('ដាច់បណ្តាញ ➜ ' + name + ' រក្សាស្ថានភាពក្នុងមូលដ្ឋាន (មិន revert)', local.callMark === undefined, local.callMark);
            } else {
                ok('ដាច់បណ្តាញ ➜ ' + name + ' រក្សាស្ថានភាពក្នុងមូលដ្ឋាន (មិន revert)', local.callMark === mark, local.callMark);
            }
            const queued = vm.runInContext('pendingHistoryPatches.size', ctx);
            ok('ដាច់បណ្តាញ ➜ ' + name + ' ចូលជួររង់ចាំ', queued === 1, queued);

            vm.runInContext('__mode.value = "ok";', ctx);
            vm.runInContext('flushPendingHistoryPatches();', ctx);
            await tick(); await tick(); await tick();
            const onServer = ctx.__server.id1;
            if (mark === null) {
                ok('ភ្ជាប់មកវិញ ➜ ' + name + ' ទៅដល់ server ពិត', onServer.callMark === undefined, onServer.callMark);
            } else {
                ok('ភ្ជាប់មកវិញ ➜ ' + name + ' ទៅដល់ server ពិត', onServer.callMark === mark, onServer.callMark);
            }
            ok('ភ្ជាប់មកវិញ ➜ ' + name + ' ជួររង់ចាំទទេវិញ', vm.runInContext('pendingHistoryPatches.size', ctx) === 0);
        });
    }

    await scenario('handleCallAction', async () => {
        const item = { id: 'id1', phone: '012345678', isCalled: false, callMark: 'no-answer', callMarkTime: 111 };
        const server = { id1: { id: 'id1', phone: '012345678', isCalled: false, callMark: 'no-answer', callMarkTime: 111 } };
        const ctx = build('disconnect', { server: server, scanHistory: [item] });
        vm.runInContext('handleCallAction("id1");', ctx);
        await tick(); await tick();
        ok('ដាច់បណ្តាញ ➜ ✔️ ខល មិនលោតត្រឡប់វិញ', ctx.scanHistory[0].isCalled === true, ctx.scanHistory[0].isCalled);
        vm.runInContext('__mode.value = "ok";', ctx);
        vm.runInContext('flushPendingHistoryPatches();', ctx);
        await tick(); await tick(); await tick();
        ok('ភ្ជាប់មកវិញ ➜ isCalled ទៅដល់ server', ctx.__server.id1.isCalled === true);
        ok('ភ្ជាប់មកវិញ ➜ នាឡិកា ៤ ម៉ោង reset ទៅដល់ server ដែរ',
            ctx.__server.id1.callMarkTime === 1700000000000, ctx.__server.id1.callMarkTime);
    });

    // ⛔ ទិសផ្ទុយ ៖ កំហុសដែលមិនមែនការដាច់បណ្តាញ ត្រូវ revert ដដែល
    await scenario('permission_denied', async () => {
        const item = { id: 'id1', phone: '012345678', callMark: 'no-answer', callMarkTime: 111 };
        const ctx = build('denied', { server: { id1: { id: 'id1' } }, scanHistory: [item], markingItemId: 'id1' });
        vm.runInContext('setCallMark("wrong-number");', ctx);
        await tick(); await tick();
        ok('permission_denied ➜ revert ដដែល', ctx.scanHistory[0].callMark === 'no-answer', ctx.scanHistory[0].callMark);
        ok('permission_denied ➜ មិនចូលជួរ', vm.runInContext('pendingHistoryPatches.size', ctx) === 0);
        ok('permission_denied ➜ មាន toast បរាជ័យ', ctx.__toasts.length > 0, ctx.__toasts);
    });

    // ⛔ ផ្លូវ saveEditedPhone ៖ គ្មាន opt-in ➜ ឥរិយាបថមិនត្រូវប្រែសោះ
    await scenario('ផ្លូវគ្មាន opt-in', async () => {
        const item = { id: 'id1', phone: 'ចាស់' };
        const ctx = build('disconnect', { server: { id1: { id: 'id1' } }, scanHistory: [item] });
        vm.runInContext('scanHistory[0].phone = "ថ្មី"; patchHistoryItemFields(scanHistory[0], { phone: "ថ្មី" }, { phone: "ចាស់" });', ctx);
        await tick(); await tick();
        ok('គ្មាន opt-in ➜ ដាច់បណ្តាញនៅតែ revert (ការទូទាត់ស្ថិតិយកមិនប្រែ)',
            ctx.scanHistory[0].phone === 'ចាស់', ctx.scanHistory[0].phone);
        ok('គ្មាន opt-in ➜ មិនចូលជួរ', vm.runInContext('pendingHistoryPatches.size', ctx) === 0);
    });

    await scenario('ការបញ្ចូលគ្នា និងពិដាន', async () => {
        const item = { id: 'id1', callMark: 'no-answer', callMarkTime: 111 };
        const ctx = build('disconnect', { server: { id1: { id: 'id1' } }, scanHistory: [item], markingItemId: 'id1' });
        vm.runInContext('setCallMark("no-connect"); setCallMark("wrong-number");', ctx);
        await tick(); await tick(); await tick();
        ok('ការសម្គាល់ ២ ដងលើ id ដដែល ➜ ជួរនៅ ១ ធាតុ', vm.runInContext('pendingHistoryPatches.size', ctx) === 1);
        ok('ជួររក្សាតម្លៃចុងក្រោយ',
            vm.runInContext('pendingHistoryPatches.get("id1").fields.callMark', ctx) === 'wrong-number');

        const max = vm.runInContext('HISTORY_PATCH_RETRY_MAX', ctx);
        ok('HISTORY_PATCH_RETRY_MAX ជាលេខមានពិដាន', typeof max === 'number' && max >= 1 && max <= 20, max);
        for (let i = 0; i < max + 2; i++) {
            vm.runInContext('flushPendingHistoryPatches();', ctx);
            await tick(); await tick();
        }
        ok('ការដាច់បណ្តាញមិនចេះចប់ ➜ ជួរមិនរីកគ្មានពិដាន',
            vm.runInContext('pendingHistoryPatches.size', ctx) <= 1);
    });

    // ការអះអាងស្តាទិច ៖ ខ្សែសង្វាក់ត្រូវភ្ជាប់ពិត
    const infoFn = sliceFn('attachInfoListeners') || '';
    ok('.info/connected ដែលបៃតង ➜ ហៅ flushPendingHistoryPatches()',
        infoFn.indexOf('flushPendingHistoryPatches()') !== -1);
    const clearFn = sliceFn('clearSensitiveModalFields') || '';
    ok('ការចាកចេញ ➜ សម្អាតជួររង់ចាំ', clearFn.indexOf('pendingHistoryPatches.clear()') !== -1);
    const editFn = sliceFn('saveEditedPhone') || '';
    ok('saveEditedPhone មិនប្រើ retryOnDisconnect', editFn.indexOf('retryOnDisconnect') === -1);
    const callFn = sliceFn('handleCallAction') || '';
    ok('handleCallAction ប្រើនាឡិកា server មិនមែននាឡិកាឧបករណ៍',
        callFn.indexOf('getServerNow()') !== -1 && callFn.indexOf('Date.now()') === -1);

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
