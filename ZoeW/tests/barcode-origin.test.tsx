/**
 * ⛔ ប្រភពកញ្ចប់ក្នុងប្រវត្តិ (សំណើម្ចាស់គម្រោង ៖ «ដាក់ប្រភពកញ្ចប់ក្នុងប្រវត្តិផង · កុំឲ្យបាំងគ្នា · ងាយមើល មិនរញ៉េរញ៉ៃ»)។
 *
 * ទុកក្នុង `zoew_scan_history_cod_dod/<id>/origins/<barcodeKey>` (rules ៖ អត្ថបទ ១–៦៤ តួ · ធាតុត្រូវមាន `id` ➜ មិនបង្កើតកញ្ចប់ «ខ្មោច»)។
 * ⛔ សរសេរ **ដាច់ពី** ការរក្សាទុកកញ្ចប់ (`saveBarcodeOrigins()`) ៖ rules ចាស់ (មិនទាន់ Publish) បដិសេធ ➜ ការស្កេន/បញ្ចូលនៅដើរ · ប្រភពគ្រាន់តែមិនទាន់ឃើញ ·
 * ឈប់សាកសម្រាប់ database នោះ។ ការបង្ហាញ ៖ ស្លាកខ្លីមួយនៅជួរស្លាកស្ថានភាព (ម្ចាស់គម្រោង ៖ «ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ» = 🇨🇳 ចិន ·
 * «Shopee SHPE» = 🇻🇳 វៀតណាម · ផ្សេងទៀត «📍 ឈ្មោះ» · ឈ្មោះវែង ➜ «…» · ប្រភពច្រើន ➜ «+N») · ឈ្មោះពេញក្នុង «📦 បញ្ជី»។
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getFormattedClockTime } from '../src/core/timezone';
import { barcodeRegistryKey } from '../src/domain/registry';
import { makeFreshOriginEntry } from '../src/features/barcode-origin';
import { preparePendingScan, releasePendingScan } from '../src/services/scan-pending';
import {
    ORIGIN_COUNTRIES, ORIGIN_TEXT_MAX, applyBarcodeOrigins, barcodeOriginWrites, itemOriginOf, itemOriginSummary, originLabel, originText, saveBarcodeOrigins
} from '../src/features/barcode-origin';
import { buildHistoryRowModel } from '../src/app/components/history/rowModel';
import { HistoryRow } from '../src/app/components/history/HistoryRow';

function item(id: string, codes: string[], origins?: Record<string, string>, extra: any = {}) {
    return Object.assign({ id, phone: '081000001', scanDate: '2026-10-06', isClosed: false, createdAt: 1,
        barcodes: codes.map((code) => ({ code, cod: 1, dod: 0, isClosed: false })), origins }, extra);
}

let server: Record<string, any> = {};
let txPaths: string[] = [];
let reject: (path: string) => any = () => null;
let handles: any[] = [];
const SCOPE = 'https://synthetic-origin.invalid';
const UID = 'synthetic-user';
const copy = (v: any) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const result = (applied = 0, unchanged = 0, unresolved = 0, unknown = 0) => ({ applied, unchanged, unresolved, unknown });

function installFb() {
    const db = { name: 'db-a', app: { options: { databaseURL: SCOPE } } };
    firebaseState.auth = { currentUser: { uid: UID } } as any;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: SCOPE }));
    firebaseState.db = db as any;
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        get: async (ref: any) => ({ val: () => copy(server[ref.path]) ?? null }),
        runTransaction: async (ref: any, fn: (cur: any) => any) => {
            txPaths.push(ref.path);
            const err = reject(ref.path);
            if (err) throw err;
            const cur = server[ref.path] === undefined ? null : JSON.parse(JSON.stringify(server[ref.path]));
            const next = fn(cur);
            if (next === undefined) return { committed: false };
            server[ref.path] = next;
            return { committed: true, snapshot: { val: () => copy(next) } };
        }
    } as any;
    return db;
}

function seed(items: any[]) {
    dataState.scanHistory = items;
    items.forEach((it) => { server['zoew_scan_history_cod_dod/' + it.id] = JSON.parse(JSON.stringify(it)); });
}

// Build a real original scan handle and a synthetic committed server operation.
// The simulated row is bound to that exact scan; no legacy evidence is invented.
function bound(code: string, from: string) {
    const owner: any = dataState.scanHistory.find((it: any) => it.barcodes.some((b: any) => b.code.toUpperCase() === code.toUpperCase()));
    if (!owner) throw new Error('synthetic owner missing');
    const barcode = owner.barcodes.find((b: any) => b.code.toUpperCase() === code.toUpperCase());
    const handle = preparePendingScan(barcode.code, barcode.cod, barcode.dod, Date.UTC(2026, 9, 6, 3), 'zto-import', 2);
    handles.push(handle);
    const rec = handle.record;
    owner.scanDate = rec.scanDate;
    Object.assign(barcode, { createdAt: rec.createdAt, scanIntent: rec.id, time: getFormattedClockTime(rec.createdAt) + ' (' + rec.scanDate + ')' });
    server['zoew_scan_history_cod_dod/' + owner.id] = copy(owner);
    server['zoew_scan_operations/' + rec.id] = { v: 2, id: rec.id, actorUid: UID, scope: SCOPE, code: barcode.code,
        registryKey: barcodeRegistryKey(barcode.code), birth: rec.createdAt, scanDate: rec.scanDate, month: rec.scanDate.slice(0, 7),
        cod: rec.cod, dod: rec.dod, count: 1, monthToken: 'op_m' + rec.id.slice(5), phase: 'committed', targetId: owner.id,
        payloadHash: 'a'.repeat(64), phone: owner.phone, locker: 'N/A', closedAt: 0 };
    const entry = makeFreshOriginEntry(barcode.code, from, handle, () => true);
    expect('binding' in entry ? entry.binding : undefined).toBeDefined();
    return entry;
}

beforeEach(() => {
    appLocalStore.clear();
    handles = [];
    server = {};
    txPaths = [];
    reject = () => null;
    ztoState.ztoOriginRefusedDb = null;
    firebaseState.authGeneration++;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
});

afterEach(() => {
    handles.forEach(releasePendingScan);
    appLocalStore.clear();
    vi.useRealTimers();
});

describe('អត្ថបទប្រភព ៖ ស្អាត · ពិដាន', () => {
    it('ដកតួអក្សរបញ្ជា · បង្រួមចន្លោះ · ≤ ORIGIN_TEXT_MAX · មិនមែនអត្ថបទ ➜ ទទេ', () => {
        expect(originText('  ZTO\u0000 ឃ្លាំង\n\nក្វាងចូវ ')).toBe('ZTO ឃ្លាំង ក្វាងចូវ');
        expect(originText('ក'.repeat(200)).length).toBe(ORIGIN_TEXT_MAX);
        [undefined, null, 42, {}, [], NaN, true].forEach((v) => expect(originText(v as any)).toBe(''));
    });

    it('ប្រភពរបស់ barcode តាមកូនសោ registry (អក្សរធំ/តូច ដូចគ្នា) · origins ខុសទម្រង់ ➜ ទទេ', () => {
        const it1 = item('a', ['zt0001'], { ZT0001: 'Shopee SHPE' });
        expect(itemOriginOf(it1, 'ZT0001')).toBe('Shopee SHPE');
        expect(itemOriginOf(it1, 'zt0001')).toBe('Shopee SHPE');
        expect(itemOriginOf(item('b', ['X']), 'X')).toBe('');
        expect(itemOriginOf({ origins: 'x' }, 'X')).toBe('');
        expect(itemOriginOf({ origins: ['a'] }, '0')).toBe('');
        expect(itemOriginOf(null, 'X')).toBe('');
    });

    it('សង្ខេបជួរដេក ៖ ប្រភពញឹកជាងគេ + ចំនួនប្រភពផ្សេង · barcode ដែលដករួច (isDeducted) មិនរាប់', () => {
        const it2 = item('c', ['A1', 'A2', 'A3', 'A4'], { A1: 'Shopee SHPE', A2: 'Shopee SHPE', A3: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ', A4: 'ផ្សេង' });
        it2.barcodes[3].isDeducted = true;
        expect(itemOriginSummary(it2)).toEqual({ icon: '🇻🇳', text: 'វៀតណាម', full: '🇻🇳 វៀតណាម · Shopee SHPE', more: 1 });
        expect(itemOriginSummary(item('d', ['B1']))).toEqual({ icon: '', text: '', full: '', more: 0 });
    });

    it('ស្លាកប្រទេសតាមម្ចាស់គម្រោង ៖ ក្វាងចូវ ➜ 🇨🇳 ចិន · Shopee SHPE ➜ 🇻🇳 វៀតណាម · ផ្សេងទៀត «📍 ឈ្មោះ» (មិនទាយ)', () => {
        expect(originLabel('ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ')).toEqual({ icon: '🇨🇳', name: 'ចិន', short: '🇨🇳 ចិន', full: '🇨🇳 ចិន · ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ' });
        expect(originLabel('  shopee   shpe ')).toEqual({ icon: '🇻🇳', name: 'វៀតណាម', short: '🇻🇳 វៀតណាម', full: '🇻🇳 វៀតណាម · shopee shpe' });
        expect(originLabel('ច្រមុះជ្រូកស្ទឹងមានជ័យ')).toEqual({ icon: '📍', name: 'ច្រមុះជ្រូកស្ទឹងមានជ័យ', short: '📍 ច្រមុះជ្រូកស្ទឹងមានជ័យ', full: '📍 ច្រមុះជ្រូកស្ទឹងមានជ័យ' });
        expect(originLabel('Shopee SHPE Thailand')).toEqual({ icon: '📍', name: 'Shopee SHPE Thailand', short: '📍 Shopee SHPE Thailand', full: '📍 Shopee SHPE Thailand' });
        expect(originLabel(undefined)).toEqual({ icon: '', name: '', short: '', full: '' });
        expect(ORIGIN_COUNTRIES.map((c) => c.site)).toEqual(['ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ', 'Shopee SHPE']);
    });
});

describe('ការបង្ហាញក្នុងប្រវត្តិ ៖ ស្លាកមួយ · «កញ្ចប់សរុប» បើកបញ្ជី', () => {
    it('ជួរដេកមានប្រភព ➜ ស្លាក «🇨🇳 ចិន» នៅបន្ទាត់ផ្ទាល់ខ្លួនក្រោមលេខទូរស័ព្ទ (title = ឈ្មោះពេញ) · «+N» ពេលច្រើនប្រភព · គ្មានប៊ូតុង «📦 បញ្ជី»', () => {
        const model = buildHistoryRowModel(item('e', ['C1', 'C2', 'C3'], { C1: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ', C2: 'Shopee SHPE', C3: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ' }), 1, false, false);
        expect(model.originIcon).toBe('🇨🇳');
        expect(model.origin).toBe('ចិន');
        expect(model.originFull).toBe('🇨🇳 ចិន · ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ');
        expect(model.originMore).toBe(1);
        const html = renderToStaticMarkup(<table><tbody><tr><HistoryRow row={model} /></tr></tbody></table>);
        const host = document.createElement('div');
        host.innerHTML = html;
        const chip = host.querySelector('.customer-info-stack > .origin-line > .origin-chip') as HTMLElement;
        expect(chip, 'ស្លាកនៅបន្ទាត់ផ្ទាល់ខ្លួនក្នុងក្រឡាអតិថិជន').toBeTruthy();
        expect(chip.closest('.origin-line')!.previousElementSibling!.className).toBe('phone-title');
        expect(chip.getAttribute('title')).toBe(model.originFull);
        expect(chip.querySelector('.origin-chip-icon')!.textContent).toBe('🇨🇳');
        expect(chip.querySelector('.origin-chip-text')!.textContent).toBe('ចិន');
        expect(chip.querySelector('.origin-chip-more')!.textContent).toBe('+1');
        expect(host.querySelector('.btn-view-list')).toBeNull();
        const badge = host.querySelector('.col-price .count-badge') as HTMLElement;
        expect(badge.tagName).toBe('BUTTON');
        expect(badge.getAttribute('type')).toBe('button');
        expect(badge.textContent).toBe('កញ្ចប់សរុប: 3');
    });

    it('ទិសផ្ទុយ ៖ គ្មានប្រភព ➜ គ្មានស្លាក (ជួរដេកដូចមុន)', () => {
        const model = buildHistoryRowModel(item('f', ['D1']), 1, false, false);
        const html = renderToStaticMarkup(<table><tbody><tr><HistoryRow row={model} /></tr></tbody></table>);
        expect(html).not.toContain('origin-chip');
        expect(html).not.toContain('origin-line');
        expect(model.origin).toBe('');
        expect(model.originMore).toBe(0);
    });
});

describe('ការរក្សាទុក ៖ transaction លើ record server · មិនបង្កើត «ខ្មោច» · rules ចាស់មិនរារាំង', () => {
    it('transaction ១ ក្នុងមួយកញ្ចប់ ➜ `origins/<key>` · រំលងអ្វីដែលដូចរួច · barcode ក្រៅប្រវត្តិ ➜ រំលង · វាលផ្សេងមិនប៉ះ', async () => {
        installFb();
        seed([item('g1', ['E1', 'e2'], { E2: 'Shopee SHPE' }), item('g2', ['E3'])]);
        const e1 = bound('E1', 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ');
        const e2 = bound('E2', 'Shopee SHPE');
        const e3 = bound('E3', '  Shopee  SHPE ');
        const beforeBarcodes = copy(server['zoew_scan_history_cod_dod/g1'].barcodes);
        const n = await saveBarcodeOrigins([e1, e2, e3,
            { code: 'E9', from: 'នៅធុងសំរាម' }, e1, { code: 'E3', from: '' }]);
        expect(n).toEqual(result(2, 1, 2));
        expect(txPaths).toEqual(['zoew_scan_history_cod_dod/g1', 'zoew_scan_history_cod_dod/g2']);
        expect(server['zoew_scan_history_cod_dod/g1'].origins).toEqual({ E1: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ', E2: 'Shopee SHPE' });
        expect(server['zoew_scan_history_cod_dod/g2'].origins).toEqual({ E3: 'Shopee SHPE' });
        expect(server['zoew_scan_history_cod_dod/g1'].barcodes).toEqual(beforeBarcodes);
    });

    it('conflicting repeated origin values for one original scan are unresolved and never written', async () => {
        installFb();
        seed([item('dup', ['DUP1'])]);
        const original = bound('DUP1', 'first');
        const conflicting = { ...original, from: 'other' };
        const before = copy(server['zoew_scan_history_cod_dod/dup']);
        expect(await saveBarcodeOrigins([original, conflicting])).toEqual(result(0, 0, 1));
        expect(txPaths).toEqual([]);
        expect(server['zoew_scan_history_cod_dod/dup']).toEqual(before);
    });

    it('កូនសោ barcode មានតួអក្សរហាមក្នុង Firebase ➜ ប្រើកូនសោ registry', () => {
        dataState.scanHistory = [item('h1', ['A.B/C'])];
        expect(barcodeOriginWrites([{ code: 'A.B/C', from: 'X' }])).toEqual([{ itemId: 'h1', key: 'A%2EB%2FC', text: 'X' }]);
    });

    it('⛔ ឧបករណ៍ផ្សេងលុប/ដកកញ្ចប់ចំពេល ➜ transaction បោះបង់ (មិនបង្កើតកញ្ចប់ «ខ្មោច» · មិនសរសេរប្រភពរបស់ barcode ដែលចេញ)', async () => {
        installFb();
        seed([item('i1', ['F1']), item('i2', ['F2', 'F3'])]);
        const f1 = bound('F1', 'A'), f3 = bound('F3', 'B');
        delete server['zoew_scan_history_cod_dod/i1'];
        server['zoew_scan_history_cod_dod/i2'].barcodes = [server['zoew_scan_history_cod_dod/i2'].barcodes[0]];
        const n = await saveBarcodeOrigins([f1, f3]);
        expect(n).toEqual(result(0, 0, 2));
        expect(server['zoew_scan_history_cod_dod/i1']).toBeUndefined();
        expect(server['zoew_scan_history_cod_dod/i2'].origins).toBeUndefined();
    });

    it('កញ្ចប់កំពុងស្តារ ឬកំពុង «លុបទាំងអស់» ➜ មិនប៉ះ', () => {
        expect(applyBarcodeOrigins(item('r1', ['R1'], undefined, { restoreClaimId: 'x' }), { R1: 'A' })).toBeUndefined();
        expect(applyBarcodeOrigins(item('r2', ['R2'], undefined, { clearClaim: { token: 't' } }), { R2: 'A' })).toBeUndefined();
        expect(applyBarcodeOrigins(null, { R1: 'A' })).toBeUndefined();
        expect(applyBarcodeOrigins({ origins: { R1: 'A' } }, { R1: 'B' }), 'គ្មាន barcodes ➜ មិនបង្កើត').toBeUndefined();
        expect(applyBarcodeOrigins(item('r3', ['R3'], { R3: 'A' }), { R3: 'A' }), 'ដូចរួច ➜ មិនសរសេរ').toBeUndefined();
    });

    it('⛔ rules ចាស់ (មិនទាន់ Publish) បដិសេធគ្រប់កញ្ចប់ ➜ ឈប់សាកសម្រាប់ database នោះ · database ផ្សេងសាកវិញ', async () => {
        const db = installFb();
        seed([item('j1', ['G1']), item('j2', ['G2'])]);
        const g1 = bound('G1', 'A'), g2 = bound('G2', 'B');
        reject = () => Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED', txOutcome: 'not-applied' });
        expect(await saveBarcodeOrigins([g1, g2])).toEqual(result(0, 0, 2));
        expect(ztoState.ztoOriginRefusedDb).toBe(db);
        const before = txPaths.length;
        expect(await saveBarcodeOrigins([g1])).toEqual(result(0, 0, 1));
        expect(txPaths.length, 'មិនផ្ញើម្តងទៀតទៅ database ដដែល').toBe(before);
        const nextDb = { name: 'db-b', app: { options: { databaseURL: SCOPE } } };
        firebaseState.db = nextDb as any;
        reject = () => null;
        const freshG1 = bound('G1', 'A');
        expect(await saveBarcodeOrigins([freshG1])).toEqual(result(1));
    });

    it('កញ្ចប់ខ្លះត្រូវបដិសេធ ខ្លះទទួល ➜ មិនសម្គាល់ថា «rules ចាស់»', async () => {
        installFb();
        seed([item('p1', ['P1']), item('p2', ['P2'])]);
        const p1 = bound('P1', 'A'), p2 = bound('P2', 'B');
        reject = (path) => (path.endsWith('/p1') ? Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED', txOutcome: 'not-applied' }) : null);
        expect(await saveBarcodeOrigins([p1, p2])).toEqual(result(1, 0, 1));
        expect(server['zoew_scan_history_cod_dod/p1'].origins).toBeUndefined();
        expect(server['zoew_scan_history_cod_dod/p2'].origins).toEqual({ P2: 'B' });
        expect(ztoState.ztoOriginRefusedDb).toBeNull();
    });

    it('ការធ្លាក់មិនមែន rules (បណ្តាញ) ➜ មិនសម្គាល់ថា «rules ចាស់» (សាកលើកក្រោយ)', async () => {
        installFb();
        seed([item('k1', ['H1'])]);
        const h1 = bound('H1', 'A');
        reject = () => new Error('network error');
        expect(await saveBarcodeOrigins([h1])).toEqual(result(0, 0, 0, 1));
        expect(ztoState.ztoOriginRefusedDb).toBeNull();
    });

    it('⛔ ចាកចេញចំពេលសរសេរ ➜ ឈប់ (កញ្ចប់បន្ទាប់មិនសរសេរ) · មិនសម្គាល់ database', async () => {
        installFb();
        seed([item('l1', ['J1']), item('l2', ['J2'])]);
        const j1 = bound('J1', 'A'), j2 = bound('J2', 'B');
        reject = () => {
            firebaseState.authGeneration++;
            return Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
        };
        expect(await saveBarcodeOrigins([j1, j2])).toEqual(result(0, 0, 1, 1));
        expect(txPaths).toHaveLength(1);
        expect(ztoState.ztoOriginRefusedDb).toBeNull();
    });

    it('transaction ព្យួរ ➜ ឈប់ក្នុងពិដាន (dbOp) · មិនបន្តកញ្ចប់បន្ទាប់ (មិនបង្កើតជួរព្យួរ)', async () => {
        vi.useFakeTimers();
        installFb();
        seed([item('m1', ['K1']), item('m2', ['K2'])]);
        const k1 = bound('K1', 'A'), k2 = bound('K2', 'B');
        firebaseState.fb.runTransaction = (ref: any) => { txPaths.push(ref.path); return new Promise(() => {}); };
        let done = false;
        let outcome: any;
        saveBarcodeOrigins([k1, k2]).then((value) => { outcome = value; done = true; });
        await vi.advanceTimersByTimeAsync(40000);
        expect(done).toBe(true);
        expect(outcome).toEqual(result(0, 0, 1, 1));
        expect(txPaths).toHaveLength(1);
        expect(ztoState.ztoOriginRefusedDb).toBeNull();
    });

    it('គ្មាន Firebase/ធាតុ ➜ 0 · មិនបោះ', async () => {
        firebaseState.fb = null as any;
        expect(await saveBarcodeOrigins([{ code: 'Z', from: 'A' }])).toEqual(result(0, 0, 1));
        installFb();
        expect(await saveBarcodeOrigins(null as any)).toEqual(result());
        expect(await saveBarcodeOrigins([{ code: 'NOPE', from: 'A' }])).toEqual(result(0, 0, 1));
        expect(txPaths).toEqual([]);
    });
});
