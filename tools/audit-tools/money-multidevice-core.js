// ផ្នែករួមនៃអ្នកយាមលុយពហុឧបករណ៍ (`emu/money-multidevice-emu-test` លើ Firebase · `supabase-money-multishop-test` លើ Supabase) ៖
//   · `invariant()` អានទិន្នន័យ **server** (dump RTDB ឬដើមឈើ `zoe_docs` របស់ហាងមួយ) ហើយគណនាអ្វីដែល ledger · ស្ថិតិយក · registry ត្រូវតែជា
//   · `PAGE_OPS` ដាក់ក្នុងទំព័រ App ពិត (build វាស់) ➜ `__startOp()` ហៅទ្វារលុយពិតតាមឈ្មោះ (`window.<fn>` មានតែក្នុង build វាស់)
// ⛔ ម៉ូឌុលនេះមិនអះអាងអ្វីទេ ៖ វាជា harness តែប៉ុណ្ណោះ ➜ ការធ្លាក់ត្រូវរាយការណ៍ដោយអ្នកហៅ (ការប្រែរបស់វាត្រូវឃើញក្នុងអ្នកហៅទាំង ២)។
'use strict';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const LICENSE_STUB = `window.ZoeLicense = {
    getStatus: function () { return Promise.resolve({ state: 'active' }); },
    setServerTimeOffset: function () {}, syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ valid: true }); }, checkOnline: function () { return Promise.resolve({ ok: true }); },
    announcementsUrl: function () { return ''; }, clearActivation: function () {}
};` + require('./browser-clock-fixture.cjs').CLOCK_FIXTURE;

function barcodesOf(it) {
    const v = it && it.barcodes;
    if (!v) return null;
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === 'object') return Object.keys(v).sort((a, b) => (+a) - (+b)).map((k) => v[k]).filter(Boolean);
    return null;
}

// Scope នេះសម្រាប់ fresh browser fixtures ដែលគ្មាន purge/legacy៖ now មកពីនាឡិកា lab,
// មិនយកកូនសោកញ្ចក់ដែលនៅសល់ធ្វើជាព្រំដែន activation។ Real-dump CLI មាន scope ផ្សេង។
function collectedMirror(dump, now) {
    const errors = [], expected = new Map(), actual = new Map();
    const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const money = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && r2(value) === value;
    const keyOf = code => String(code || '').trim().toUpperCase().replace(/[%.#$\[\]\/\x00-\x1F\x7F]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
    const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' });
    const dayOf = stamp => typeof stamp === 'number' && Number.isFinite(stamp) && stamp > 0 && stamp <= 8640000000000000
        ? calendar.format(stamp) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayOf(now))) return { errors: ['collected-clock-unmeasured'], expected: 0, actual: 0 };
    const today = dayOf(now), cutoff = dayOf(now - 6 * 86400000);
    const addError = value => { if (errors.length < 12) errors.push(value); };
    for (const [where, bag] of [['history', dump.zoew_scan_history_cod_dod], ['trash', dump.zoew_recently_deleted_cod_dod]]) {
        for (const item of Object.values(bag || {})) {
            if (!object(item) || !item.barcodes || typeof item.barcodes !== 'object') { addError('collected-legacy-row:' + where); continue; }
            if (item.restoreClaimId !== undefined || item.restoreClaimToken !== undefined || item.restoreClaim !== undefined) {
                addError('collected-restore-unsettled:' + item.id); continue;
            }
            const reason = typeof item.trashReason === 'string' ? item.trashReason : item.isFromDeletion ? 'kept' : 'remove';
            const removed = where === 'trash' && ['remove', 'returned', 'misplaced', 'sent'].includes(reason);
            for (const barcode of barcodesOf(item) || []) {
                if (!barcode || !barcode.code || barcode.isClosed !== true || barcode.isDeducted === true || removed) continue;
                const key = keyOf(barcode.code), day = dayOf(barcode.closedAt);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today || !money(barcode.cod) || !money(barcode.dod)) { addError('collected-source-invalid:' + key); continue; }
                if (expected.has(key)) addError('collected-source-duplicate:' + key);
                expected.set(key, { day, c: barcode.cod, d: barcode.dod });
            }
        }
    }
    const mirror = dump.zoew_daily_collected_cod_dod;
    if (mirror != null && !object(mirror)) addError('collected-root-invalid');
    for (const [day, entries] of Object.entries(object(mirror) ? mirror : {})) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || dayOf(Date.parse(day + 'T00:00:00+07:00')) !== day || day > today || !object(entries)) { addError('collected-day-invalid:' + day); continue; }
        for (const [key, value] of Object.entries(entries)) {
            if (!object(value) || Object.keys(value).sort().join(',') !== 'c,d' || !money(value.c) || !money(value.d)) addError('collected-value-invalid:' + day + '/' + key);
            const hits = actual.get(key) || [];
            hits.push({ day, c: value?.c, d: value?.d }); actual.set(key, hits);
        }
    }
    for (const [key, want] of expected) {
        const hits = actual.get(key) || [];
        if (!hits.length && want.day < cutoff) continue;
        if (hits.length !== 1) addError('collected-' + (hits.length ? 'duplicate:' : 'missing:') + key);
        else if (hits[0].day !== want.day) addError('collected-wrong-day:' + key);
        else if (hits[0].c !== want.c || hits[0].d !== want.d) addError('collected-wrong-value:' + key);
    }
    for (const [key, hits] of actual) if (!expected.has(key)) addError('collected-unexpected:' + key + ':' + hits.map(hit => hit.day).join(','));
    return { errors, expected: expected.size, actual: actual.size, cutoff, today };
}

// Fixture aging តែប៉ុណ្ណោះ៖ validate មុនផ្លាស់ថ្ងៃ និងចម្លងតែ leaf ដែលបានផ្ទៀង។
// Caller ត្រូវសរសេរ ops នេះជាមួយ timestamp edit ក្នុង atomic fixture write ដដែល។
function collectedFixtureAgeOps(dump, before, after, now) {
    const canonical = value => JSON.stringify(value, function (key, entry) {
        return entry && typeof entry === 'object' && !Array.isArray(entry)
            ? Object.fromEntries(Object.keys(entry).sort().map(name => [name, entry[name]])) : entry;
    });
    if (!before?.id || canonical(dump.zoew_scan_history_cod_dod?.[before.id]) !== canonical(before)) throw new Error('collected fixture age snapshot ខុស');
    const withoutStamps = row => JSON.parse(JSON.stringify(row, (key, value) => ['closedAt', 'createdAt'].includes(key) ? undefined : value));
    if (canonical(withoutStamps(before)) !== canonical(withoutStamps(after))) throw new Error('collected fixture age ប្ដូរ identity/value');
    const checked = collectedMirror(dump, now);
    if (checked.errors.length) throw new Error('collected fixture មុន age: ' + checked.errors.join(','));
    const keyOf = code => String(code || '').trim().toUpperCase().replace(/[%.#$\[\]\/\x00-\x1F\x7F]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
    const dayOf = stamp => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(stamp);
    const ops = [];
    for (const barcode of barcodesOf(before) || []) {
        if (!barcode.isClosed || barcode.isDeducted === true) continue;
        const next = (barcodesOf(after) || []).find(row => row.code === barcode.code);
        if (!next || !next.isClosed || next.cod !== barcode.cod || next.dod !== barcode.dod || next.isDeducted !== barcode.isDeducted) throw new Error('collected fixture age ប្ដូរ identity/value');
        const oldDay = dayOf(barcode.closedAt), newDay = dayOf(next.closedAt), key = keyOf(barcode.code);
        if (oldDay === newDay) continue;
        const value = dump.zoew_daily_collected_cod_dod?.[oldDay]?.[key];
        if (!value || newDay < checked.cutoff || newDay > checked.today) throw new Error('collected fixture age គ្មាន leaf ដែលផ្លាស់បាន');
        ops.push({ k: 'set', p: ['zoew_daily_collected_cod_dod', oldDay, key], v: null },
            { k: 'set', p: ['zoew_daily_collected_cod_dod', newDay, key], v: { c: value.c, d: value.d } });
    }
    return ops;
}

function invariant(dump, dateKey, monthKey, knownCodes, expectedScope, collectedNow) {
    const hist = dump.zoew_scan_history_cod_dod || {};
    const trash = dump.zoew_recently_deleted_cod_dod || {};
    let cod = 0, dod = 0, count = 0, closed = 0;
    const seen = Object.create(null); const dup = []; const live = Object.create(null);
    // ⛔ អត្តសញ្ញាណ ៖ ពេល packagesPickedUp ≠ barcode បិទ ត្រូវប្រាប់ **កូនសោណា** លើស/ខ្វះ និង barcode នោះនៅឯណា (CI ធ្លាក់ម្តង pkg 3 ⟷ បិទ 1 ដោយគ្មានព័ត៌មាន)
    const regKey = (code) => String(code || '').trim().toUpperCase().replace(/[%.#$\[\]\/\x00-\x1F\x7F]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
    const located = {}; const closedKeys = {}; const expectedPhones = {};
    // M5 (ការសម្រេចម្ចាស់) ៖ «យករួច» តាមប្រាក់ ➜ copy ក្នុងធុងសំរាមដែលកាត់ប្រាក់ («ដក» · «ត្រឡប់») មិនរាប់ · code ដែលការស្តារមិនទាន់ចប់
    //    បញ្ចូលក្នុងជួរ (ត្រា restore · `restoreAddedCodes` · គ្មាន provenance ➜ ទាំងអស់) មិនទាន់រាប់ ➜ ដេរីវេពីទិន្នន័យ មិនមែនពី helper របស់ App
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
    const walk = (bag, where) => Object.keys(bag).forEach((id) => {
        const it = bag[id]; if (!it) return;
        const bcs = barcodesOf(it) || (it.barcode ? [{ code: it.barcode, cod: it.cod, dod: it.dod, isClosed: it.isClosed, isDeducted: it.isDeducted }] : []);
        bcs.forEach((b) => {
            if (!b || !b.code) return;
            const identity = String(b.code).trim().toUpperCase();
            const key = regKey(b.code);
            if (seen[identity]) dup.push(identity + '@' + seen[identity] + '+' + where); else seen[identity] = where;
            live[key] = { barcode: b, identity };
            located[key] = where + ':' + id + ':' + (b.isClosed === true ? 'closed' : 'open') + (it.scanDate !== dateKey ? ':' + it.scanDate : '');
            if (it.scanDate !== dateKey) return;
            if (b.isClosed === true && !(where === 'trash' && deductedTrash(it)) && !(where === 'hist' && restorePending(it, b.code))) {
                const phone = it.phone && it.phone !== 'គ្មានលេខ' ? String(it.phone).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) : '';
                const owner = phone || '__item_' + it.id;
                closed++; closedKeys[key] = owner;
                expectedPhones[owner] = (expectedPhones[owner] || 0) + 1;
            }
            if (b.isDeducted !== true) { cod += parseFloat(b.cod) || 0; dod += parseFloat(b.dod) || 0; count++; }
        });
    });
    walk(hist, 'hist'); walk(trash, 'trash');
    const rev = (dump.zoew_daily_revenue_cod_dod || {})[dateKey] || {};
    const daily = dump.zoew_daily_revenue_cod_dod || {};
    let mCod = 0, mDod = 0, mCount = 0;
    Object.keys(daily).forEach((d) => { if (d.slice(0, 7) !== monthKey) return; mCod += parseFloat(daily[d].codDollar) || 0; mDod += parseFloat(daily[d].dodDollar) || 0; mCount += parseFloat(daily[d].totalCount) || 0; });
    const month = (dump.zoew_monthly_revenue_cod_dod || {})[monthKey] || {};
    const pick = (dump.zoew_daily_pickup_cod_dod || {})[dateKey] || {};
    const phones = pick.pickedUpPhones || {};
    const pickKeys = Object.keys(pick.pickedUpBarcodes || {});
    const pickExtra = pickKeys.filter((k) => !closedKeys[k]).slice(0, 8).map((k) => k + '@' + (located[k] || 'absent'));
    const pickMissing = Object.keys(closedKeys).filter((k) => pickKeys.indexOf(k) === -1).slice(0, 8).map((k) => k + '@' + located[k]);
    const pickWrongOwner = pickKeys.filter((k) => closedKeys[k] && pick.pickedUpBarcodes[k] !== closedKeys[k]).slice(0, 8);
    const phoneMismatch = [...new Set([...Object.keys(phones), ...Object.keys(expectedPhones)])]
        .filter((key) => phones[key] !== expectedPhones[key]).slice(0, 8);
    let phoneSum = 0; const zeroRef = [];
    Object.keys(phones).forEach((k) => { phoneSum += parseFloat(phones[k]) || 0; if (!(phones[k] > 0)) zeroRef.push(k); });
    const reg = dump.zoew_barcode_registry || {};
    // Independent audit schema: do not reuse the production validator being audited.
    // Dumps are tenant-scoped; callers may additionally supply their trusted shop scope.
    const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
    const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 9007199254740990;
    const money = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Math.round(value * 100) / 100 === value && integer(Math.round(value * 100));
    const owned = key => {
        const owner = reg[key];
        if (owner === true) return true;
        if (!object(owner) || Object.keys(owner).sort().join(',') !== 'actorUid,birth,intent,v'
            || owner.v !== 2 || typeof owner.intent !== 'string' || !/^scan_[a-f0-9]{32}$/.test(owner.intent) || !text(owner.actorUid, 2048) || !integer(owner.birth) || owner.birth < 1) return false;
        const receipt = (dump.zoew_scan_operations || {})[owner.intent];
        if (!object(receipt) || Object.keys(receipt).sort().join(',') !== 'actorUid,birth,closedAt,cod,code,count,dod,id,locker,month,monthToken,payloadHash,phase,phone,registryKey,scanDate,scope,targetId,v'
            || receipt.v !== 2 || receipt.phase !== 'committed' || receipt.id !== owner.intent || receipt.actorUid !== owner.actorUid || receipt.birth !== owner.birth
            || !text(receipt.scope, 2048) || (expectedScope !== undefined && receipt.scope !== expectedScope)
            || receipt.code !== live[key].identity || receipt.registryKey !== key || regKey(receipt.code) !== key
            || typeof receipt.scanDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(receipt.scanDate) || receipt.month !== receipt.scanDate.slice(0, 7)
            || !money(receipt.cod) || !money(receipt.dod) || receipt.count !== 1 || receipt.monthToken !== 'op_m' + owner.intent.slice(5)
            || !text(receipt.targetId, 128) || !/^[a-zA-Z0-9_-]+$/.test(receipt.targetId) || typeof receipt.payloadHash !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.payloadHash)
            || !text(receipt.phone, 2048) || !text(receipt.locker, 2048) || !integer(receipt.closedAt)) return false;
        return live[key].barcode.scanIntent === owner.intent && live[key].barcode.createdAt === owner.birth;
    };
    const orphans = Object.keys(reg).filter(k => reg[k] !== null && reg[k] !== false && !live[k]);
    const registryMissing = Object.keys(live).filter(key => !owned(key));
    const lost = knownCodes.filter((c) => !seen[String(c).trim().toUpperCase()]);
    const receipts = Object.keys(dump.zoew_write_receipts || {}).length;
    return {
        expectCod: r2(cod), gotCod: r2(parseFloat(rev.codDollar) || 0), expectDod: r2(dod), gotDod: r2(parseFloat(rev.dodDollar) || 0),
        expectCount: count, gotCount: parseFloat(rev.totalCount) || 0,
        monthCod: r2(parseFloat(month.codDollar) || 0), monthDod: r2(parseFloat(month.dodDollar) || 0), monthCount: parseFloat(month.totalCount) || 0,
        expectMonthCod: r2(mCod), expectMonthDod: r2(mDod), expectMonthCount: mCount,
        pkg: parseFloat(pick.packagesPickedUp) || 0, expectPkg: closed, pickExtra, pickMissing, pickWrongOwner, phoneMismatch,
        phoneSum, zeroRef, dup, orphans, registryMissing, lost, receipts, seenCodes: seen,
        collected: collectedNow === undefined ? null : collectedMirror(dump, collectedNow)
    };
}

function invariantBroken(inv) {
    if (inv.collected?.errors.length) return inv.collected.errors.join('; ');
    if (inv.expectCod !== inv.gotCod || inv.expectDod !== inv.gotDod || inv.expectCount !== inv.gotCount) return 'ledger ថ្ងៃ ≠ ផលបូក barcode មិនទាន់ដក';
    if (inv.monthCod !== inv.expectMonthCod || inv.monthDod !== inv.expectMonthDod || inv.monthCount !== inv.expectMonthCount) return 'ledger ខែ ≠ ផលបូក ledger ថ្ងៃ';
    if (inv.pkg !== inv.expectPkg) return 'packagesPickedUp ≠ barcode បិទ';
    if (inv.pickExtra.length || inv.pickMissing.length) return 'សំណុំ pickup barcode ≠ សំណុំ barcode បិទ';
    if (inv.pickWrongOwner.length) return 'ម្ចាស់ pickup barcode ≠ លេខទូរស័ព្ទ parcel';
    if (inv.phoneMismatch.length) return 'pickedUpPhones ≠ ចំនួន barcode បិទតាមលេខទូរស័ព្ទ';
    if (inv.phoneSum !== inv.pkg) return 'sum(pickedUpPhones) ≠ packagesPickedUp';
    if (inv.zeroRef.length) return 'pickedUpPhones ≤ 0';
    if (inv.dup.length) return 'barcode ស្ថិតទាំងប្រវត្តិនិងធុងសំរាម';
    if (inv.orphans.length) return 'កូនសោ registry កំព្រា';
    if (inv.registryMissing.length) return 'កូនសោ registry ខ្វះ barcode ដែលនៅ server';
    if (inv.lost.length) return 'barcode បាត់ពីប្រព័ន្ធ (គ្មានក្នុងប្រវត្តិ · គ្មានក្នុងធុងសំរាម)';
    return null;
}

function openBarcodeTargets(dump) {
    const hist = dump.zoew_scan_history_cod_dod || {};
    const out = [];
    Object.keys(hist).sort().forEach((id) => {
        const it = hist[id];
        if (!it || it.clearClaim || it.restoreClaimId || it.restoreClaimToken) return;
        (barcodesOf(it) || []).forEach((b) => { if (b && b.code && !b.isClosed) out.push({ id, code: b.code }); });
    });
    return out;
}

const PAGE_OPS = function () {
    const w = window;
    w.__ops = [];
    w.__opResults = [];
    const operationHistory = [], consoleErrors = [], attemptEvents = [];
    let attemptSequence = 0, droppedAttemptEvents = 0;
    const traceTarget = value => {
        const out = {};
        try { for (const key of ['id', 'code']) if (typeof value?.[key] === 'string') out[key] = value[key].slice(0, 256); } catch (_) {}
        return out;
    };
    const traceState = selected => {
        try {
            const online = w.navigator?.onLine, connected = w.isDatabaseConnected,
                phase = w.connectionFlowSnapshot?.().phase, cleanupHeld = selected?.id ? w.cleanupInFlight?.has(selected.id) : undefined;
            return { online: typeof online === 'boolean' ? online : undefined, connected: typeof connected === 'boolean' ? connected : undefined,
                phase: typeof phase === 'string' && /^[a-z-]{1,40}$/.test(phase) ? phase : undefined,
                cleanupHeld: typeof cleanupHeld === 'boolean' ? cleanupHeld : undefined };
        }
        catch (_) { return { diagnosticUnavailable: true }; }
    };
    const traceEvent = value => {
        try {
            attemptEvents.push({ at: Date.now(), ...value });
            if (attemptEvents.length > 128) { droppedAttemptEvents += attemptEvents.length - 128; attemptEvents.splice(0, attemptEvents.length - 128); }
        } catch (_) {}
    };
    w.__operationTrace = () => JSON.parse(JSON.stringify({ limit: 128, droppedEvents: droppedAttemptEvents, events: attemptEvents }));
    const originalError = console.error;
    console.error = function (...args) {
        try { consoleErrors.push(args.map(value => value?.stack || String(value)).join(' ').slice(0, 8192)); }
        catch (_) { consoleErrors.push('diagnostic serialization unavailable'); }
        if (consoleErrors.length > 12) consoleErrors.splice(0, consoleErrors.length - 12);
        return originalError.apply(this, args);
    };
    w.__consoleErrors = () => consoleErrors.slice(-12);
    const recordOperation = (result) => {
        try {
            if (result.r === 'failed') result.diagnostic = { online: w.navigator?.onLine, connected: w.isDatabaseConnected,
                phase: w.connectionFlowSnapshot?.().phase, clockTrusted: w.serverClockTrusted, offset: w.serverTimeOffsetMs,
                toasts: [...(w.document?.querySelectorAll?.('#toastContainer .toast') || [])].map(node => node.textContent).slice(-4) };
        } catch (_) { result.diagnosticUnavailable = true; }
        w.__opResults.push(result); operationHistory.push(result);
    };
    w.__operationHistory = () => operationHistory.map((result) => ({ ...result }));
    const bcOf = (it, pick) => (it && Array.isArray(it.barcodes) && it.barcodes.length) ? it.barcodes[Math.floor(pick * it.barcodes.length) % it.barcodes.length] : null;
    const at = (arr, pick) => arr.length ? arr[Math.floor(pick * arr.length) % arr.length] : null;
    w.__startOp = (args) => {
        const { wanted, pick, amt, code, phone, target } = args;
        const matches = (it) => it && (!target || (target.code ? (it.barcodes || []).some((b) => b && b.code === target.code) : !target.id || it.id === target.id));
        const live = (w.scanHistory || []).filter(matches);
        const trash = (w.deletedItems || []).filter(matches);
        const attempt = ++attemptSequence, requested = traceTarget(target);
        let selected = {};
        const traceWanted = ['scan', 'closeOrder', 'closeBarcode', 'removeBarcode', 'deleteItem', 'restore', 'editPrice', 'sweep', 'zreturn'].includes(wanted) ? wanted : 'unsupported';
        const opening = { phase: 'start', attempt, wanted: traceWanted, requested, selected, state: traceState(requested) };
        traceEvent(opening);
        const select = value => {
            try {
                selected = traceTarget(value); Object.assign(opening.selected, selected);
                Object.assign(opening.state, traceState(selected));
            } catch (_) {}
        };
        const invoke = (fn, args, item) => { select(item); return fn.apply(w, args); };
        const finishTrace = result => traceEvent({ phase: 'end', attempt, wanted: traceWanted, requested, selected,
            result: ['done', 'failed', 'missing', 'pending', 'late', 'stale', 'cancelled', 'blocked', 'deleted', 'undefined', 'true', 'false', 'object', 'threw', 'rejected', 'not-selected'].includes(result) ? result : 'other',
            state: traceState(selected) });
        const skipped = () => { finishTrace('not-selected'); return null; };
        let started = null;
        try {
            if (wanted === 'scan') {
                w.triggerScanAction(code);
                const bcText = document.getElementById('modalBarcodeText');
                const modal = document.getElementById('phoneModal');
                const open = modal && getComputedStyle(modal).display !== 'none';
                if (!open || !bcText || bcText.innerText !== code) return skipped();
                const p = document.getElementById('modalPhoneInput'); if (p) p.value = phone;
                const c = document.getElementById('modalCodInput'); if (c) c.value = String(amt);
                const d2 = document.getElementById('modalDodInput'); if (d2) d2.value = String(Math.round(amt / 4 * 100) / 100);
                started = Promise.resolve(w.confirmPhone());
            } else if (wanted === 'closeOrder') { const it = at(live, pick); if (!it) return skipped(); started = Promise.resolve(w.toggleCloseStatus(it.id)); }
            else if (wanted === 'closeBarcode') { const it = at(live, pick); const b = bcOf(it, pick); if (!it || !b) return skipped(); started = Promise.resolve(w.toggleIndividualBarcodeClose(it.id, b.code)); }
            else if (wanted === 'removeBarcode') {
                const it = at(live, pick), b = bcOf(it, pick); if (!it || !b) return skipped();
                const fn = w.removeSingleBarcode, id = it.id, barcode = b.code;
                started = Promise.resolve(invoke(fn, [id, barcode], { id, code: barcode }));
            }
            else if (wanted === 'deleteItem') { const it = at(live, pick); if (!it) return skipped(); started = Promise.resolve(w.deleteSingleItem(it.id)); }
            else if (wanted === 'restore') { const it = at(trash, pick); if (!it) return skipped(); w.promptRestoreDeletedItem(it.id); started = Promise.resolve(w.executeRestoreItem()); }
            else if (wanted === 'editPrice') {
                const it = at(live, pick); const b = bcOf(it, pick); if (!it || !b) return skipped();
                w.openEditBarcodePriceModal(it.id, b.code);
                const c = document.getElementById('editBcCodInput'); if (c) c.value = String(amt);
                const d2 = document.getElementById('editBcDodInput'); if (d2) d2.value = '0';
                started = Promise.resolve(w.saveEditedBarcodePrice());
            } else if (wanted === 'sweep') { started = Promise.resolve(w.runAutomaticCleanupRules()); }
            else if (wanted === 'zreturn') {
                if (!target || !target.id || !target.code || !(target.at > 0)) return skipped();
                started = Promise.resolve(w.claimAndCleanupItem(target.id, 'abandon', { codes: [target.code], returnedAt: new Map([[target.code, target.at]]) }));
            }
            else return skipped();
        } catch (e) { finishTrace('threw'); recordOperation({ wanted, threw: String(e && e.message) }); return 'threw:' + wanted + ':' + (e && e.message); }
        const p = started.then((r) => { const result = typeof r === 'object' ? 'object' : String(r); finishTrace(result); recordOperation({ wanted, r: result }); }, (e) => { finishTrace('rejected'); recordOperation({ wanted, e: String(e && e.message) }); });
        w.__ops.push(p);
        return wanted;
    };
    w.__settled = () => Promise.race([Promise.allSettled(w.__ops).then(() => true), new Promise((res) => setTimeout(() => res(false), 100))]);
    // Current journals are per-entry v2 keys. An empty legacy v1 array is not
    // evidence that current operations settled. Verify raw keys against the real
    // reader, so a malformed record silently filtered by that reader fails closed.
    const journalState = (prefix, legacyKey, readCurrent) => {
        try {
            if (typeof prefix !== 'string' || !prefix.endsWith(':') || typeof legacyKey !== 'string' || !legacyKey
                || typeof readCurrent !== 'function') throw new Error('journal runtime unavailable');
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) keys.push(key);
            }
            const current = readCurrent();
            if (!Array.isArray(current) || current.length !== keys.length) throw new Error('current journal unreadable or omitted entries');
            const raw = localStorage.getItem(legacyKey);
            const legacy = raw === null ? [] : JSON.parse(raw);
            if (!Array.isArray(legacy)) throw new Error('legacy journal unreadable');
            return { pending: current.length + legacy.length, current, legacy, keys };
        } catch (e) { return { pending: -1, error: String(e && e.message) }; }
    };
    const claimJournalState = () => {
        try {
            if (typeof w.trashClaimPolicy !== 'function' || typeof w.pendingTrashClaims !== 'function' || typeof w.liveShopScope !== 'function') throw new Error('claim runtime unavailable');
            const key = w.trashClaimPolicy().storeKey;
            if (typeof key !== 'string' || !key) throw new Error('claim journal key unavailable');
            const raw = JSON.parse(localStorage.getItem(key) || '[]');
            if (!Array.isArray(raw) || raw.some((entry) => !entry || typeof entry.itemId !== 'string' || typeof entry.token !== 'string' || typeof entry.scope !== 'string')) throw new Error('claim journal unreadable');
            const scope = w.liveShopScope();
            const current = w.pendingTrashClaims(scope);
            if (!Array.isArray(current) || current.length !== raw.filter((entry) => entry.scope === scope).length) throw new Error('claim journal omitted entries');
            return { pending: current.length, current };
        } catch (error) { return { pending: -1, error: String(error.message) }; }
    };
    w.__journals = () => ({
        cleanup: journalState(w.CLEANUP_JOURNAL_KEY, w.CLEANUP_LEGACY_JOURNAL_KEY, w.readCleanupJournal),
        pickup: journalState(w.PICKUP_JOURNAL_V2_PREFIX, w.PICKUP_JOURNAL_KEY, w.readPickupJournal),
        claims: claimJournalState()
    });
    w.__state = () => {
        const journals = w.__journals();
        return {
        status: (document.getElementById('firebaseStatusText') || {}).textContent || '',
        phase: typeof w.connectionFlowSnapshot === 'function' ? w.connectionFlowSnapshot().phase : null,
        pending: w.db && typeof w.db.recoveryState === 'function' ? w.db.recoveryState().pending
            : (typeof w.nativeWriteRecoveryState === 'function' && w.db ? w.nativeWriteRecoveryState(w.db).pending : -1),
        blocked: w.db && typeof w.db.recoveryState === 'function' ? (w.db.recoveryState().blocked ? 1 : 0)
            : (typeof w.nativeWriteRecoveryState === 'function' && w.db ? w.nativeWriteRecoveryState(w.db).blocked : -1),
        rows: Object.keys(localStorage).filter((k) => k.startsWith('zoew_connection_writes_v1:')).length,
        cleanupJournal: journals.cleanup.pending,
        pickupJournal: journals.pickup.pending,
        trashClaims: journals.claims.pending,
        history: Array.isArray(w.scanHistory) ? w.scanHistory.length : -1,
        codes: [].concat(w.scanHistory || [], w.deletedItems || []).filter(Boolean)
            .flatMap((it) => (Array.isArray(it.barcodes) ? it.barcodes : []).map((b) => b && b.code).concat(it.barcode ? [it.barcode] : [])).filter(Boolean),
        results: w.__opResults.splice(0)
        };
    };
};

function devicesSettled(states, done) {
    return states.length > 0 && states.length === done.length && states.every((state, index) => done[index] === true
        && state.phase === 'ready' && state.pending === 0 && state.rows === 0 && state.blocked === 0
        && state.cleanupJournal === 0 && state.pickupJournal === 0 && state.trashClaims === 0);
}

async function recoveryEvidence(devices) {
    return Promise.all(devices.map(async (device) => ({
        device: device.name,
        gate: device.gate?.evidence(),
        state: await Promise.race([
            device.page.evaluate(() => ({
                journals: window.__journals(), operations: window.__operationHistory(), operationTrace: window.__operationTrace?.(), consoleErrors: window.__consoleErrors?.(),
                toasts: [...(window.document?.querySelectorAll?.('#toastContainer .toast') || [])].map(node => node.textContent).slice(-4),
                claims: window.pendingTrashClaims?.(window.liveShopScope?.()),
                liveClaims: window.liveTrashClaims ? [...window.liveTrashClaims] : null,
                cleanupLive: window.cleanupJournalLive ? [...window.cleanupJournalLive.keys()] : null,
                pickupLive: window.pickupIntentsLive ? [...window.pickupIntentsLive] : null,
                history: window.scanHistory, trash: window.deletedItems
            })).catch((error) => ({ error: String(error.message) })),
            new Promise((resolve) => setTimeout(() => resolve({ diagnosticTimeout: true }), 2000))
        ])
    })));
}

module.exports = { collectedMirror, collectedFixtureAgeOps, r2, rng, LICENSE_STUB, invariant, invariantBroken, openBarcodeTargets, PAGE_OPS, recoveryEvidence, devicesSettled };
