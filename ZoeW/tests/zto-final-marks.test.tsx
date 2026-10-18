/**
 * ⛔ កញ្ចប់ដែលចប់ក្នុង ZTO (សំណើម្ចាស់គម្រោង ៖ «កញ្ចប់ដែលស្កេនត្រឡប់រួច ដាច់ខាតត្រូវត្រឡប់ទៅសាខាកណ្តាល · កញ្ចប់ដែល Sign បិទបញ្ជីពិតពី ZTO
 * មិនអាចត្រឡប់មក unsign បាន · គួតែកញ្ចប់ដែលគ្រាន់តែបិទក្នុង ZoeW អាចស្តារបាន · កែប៊ូតុងអោយស្គាល់កញ្ចប់ដែល Sign ហើយពិត មិនអាចបើកវិញបាន» ·
 * «សម្រួលធុងសំរាម អោយធាតុថ្មីៗដែលចូលក្រោយគេនៅលើគេ» · សម្រេច ៖ «ហាមតែ ZTO ស្កេនត្រឡប់» · «កត់លើកញ្ចប់ក្នុង DB»)។
 *
 * ភស្តុតាងកត់លើ barcode ក្នុង DB (`ztoSignedAt` · `ztoReturnedAt`) ដោយការសរសេរ **ដាច់ពី** ការរក្សាទុកកញ្ចប់ (`syncZtoFinalMarks()`) ៖
 * rules ចាស់ (មិនទាន់ Publish) បដិសេធ ➜ លុយ · ការសម្អាត · ការស្កេនដើរដូចមុន ហើយការសរសេរឈប់សាកសម្រាប់ database នោះមួយរយៈ។
 * Sign ➜ verdict ZTO `true` លើ barcode ដែលបិទ · ត្រឡប់ ➜ ភស្តុតាងពី `removeReturnedZtoBarcodes()` លើធាតុធុងសំរាម `returned`។
 * អ្នកអាន ៖ ប៊ូតុង «🔒 Sign រួច» (ជួរ · បញ្ជី barcode) · ការបើកវិញបដិសេធក្នុង transaction លើតម្លៃ server · ធុងសំរាម 🔒 ជំនួស 🔄 ·
 * `executeRestoreItem()` បដិសេធ (ត្រឡប់ ZTO ៖ barcode ណាមួយ · យករួច ៖ គ្រប់ barcode Sign) · លុប/ដក នៅស្តារបាន (កែកំហុសលុយ)។
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { ZTO_RESTORE_FINAL_TEXT, ZTO_SIGNED_REOPEN_TEXT } from '../src/core/text';
import { barcodeZtoReturned, barcodeZtoSigned, trashZtoFinalBlock } from '../src/domain/barcode';
import {
    ZTO_FINAL_REFUSED_RETRY_MS, applyZtoFinalMarks, barcodeSignedInZto, itemReopenLockedByZto, noteZtoReturnedEvidence, resetZtoFinalMarks,
    syncZtoFinalMarks, trashRestoreBlockOf, ztoFinalFailedAt, ztoMisplacedRefused
} from '../src/features/zto-final-marks';
import { ztoPickupStatus, setZtoPickupVerdict } from '../src/features/zto-status';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { TRASH_REASON_META, buildTrashGroups, promptRestoreDeletedItem } from '../src/features/trash';
import { executeRestoreItem } from '../src/features/restore';
import { buildHistoryRowModel } from '../src/app/components/history/rowModel';
import { HistoryRow } from '../src/app/components/history/HistoryRow';

const toasts = () => (uiState.toasts || []).map((t: any) => String(t.msg || ''));
const H = 'zoew_scan_history_cod_dod/';
const T = 'zoew_recently_deleted_cod_dod/';

function bc(code: string, extra: any = {}) {
    return Object.assign({ code, cod: 1, dod: 0, isClosed: false, createdAt: 1 }, extra);
}

function item(id: string, barcodes: any[], extra: any = {}) {
    return Object.assign({ id, phone: '081000001', scanDate: '2026-10-06', createdAt: 1, isClosed: barcodes.every((b) => b.isClosed), barcodes }, extra);
}

let server: Record<string, any> = {};
let txPaths: string[] = [];
let reject: (path: string) => any = () => null;

function installFb() {
    const db = { name: 'db-final' };
    firebaseState.db = db as any;
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        get: async (ref: any) => {
            const v = server[ref.path];
            return { exists: () => v !== undefined && v !== null, val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) };
        },
        runTransaction: async (ref: any, fn: (cur: any) => any) => {
            txPaths.push(ref.path);
            const err = reject(ref.path);
            if (err) throw err;
            const cur = server[ref.path] === undefined ? null : JSON.parse(JSON.stringify(server[ref.path]));
            const next = fn(cur);
            if (next === undefined) return { committed: false, snapshot: { val: () => cur } };
            server[ref.path] = next;
            return { committed: true, snapshot: { val: () => next } };
        }
    } as any;
    firebaseState.dbRefDeleted = { path: 'zoew_recently_deleted_cod_dod' } as any;
    return db;
}

function seedHistory(items: any[]) {
    dataState.scanHistory = items;
    items.forEach((it) => { server[H + it.id] = JSON.parse(JSON.stringify(it)); });
}

function seedTrash(items: any[]) {
    dataState.deletedItems = items;
    items.forEach((it) => { server[T + it.id] = JSON.parse(JSON.stringify(it)); });
}

beforeEach(() => {
    server = {};
    txPaths = [];
    reject = () => null;
    resetZtoFinalMarks();
    ztoState.ztoFinalInFlight = false;
    ztoPickupStatus.clear();
    ztoState.ztoStatusLoaded = true;
    firebaseState.authGeneration++;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.pendingRestoreId = null;
    uiState.toasts = [];
    vi.stubGlobal('confirm', () => true);
    installFb();
});

describe('ធុងសំរាម ៖ ធាតុចូលក្រោយគេនៅលើគេ', () => {
    it('ក្រុមតម្រៀបតាម deletedAt ថ្មីបំផុតមុន · ធាតុក្នុងក្រុមក៏ដូច្នោះ · គ្មាន deletedAt ➜ ចុងក្រោយ', () => {
        const groups = buildTrashGroups([
            item('old', [bc('A')], { phone: '011', trashReason: 'delete', deletedAt: 100 }),
            item('none', [bc('B')], { phone: '022', trashReason: 'delete' }),
            item('new', [bc('C')], { phone: '033', trashReason: 'delete', deletedAt: 300 }),
            item('mid1', [bc('D')], { phone: '044', time: 't', trashReason: 'remove', deletedAt: 150 }),
            item('mid2', [bc('E')], { phone: '044', time: 't', trashReason: 'remove', deletedAt: 200 })
        ]);
        expect(groups.map((g) => g.phone)).toEqual(['033', '044', '011', '022']);
        expect(groups[1].items.map((i: any) => i.id)).toEqual(['mid2', 'mid1']);
    });
});

describe('ភស្តុតាង ZTO ក្នុង DB ៖ ការសរសេរដាច់ដោយឡែក', () => {
    it('helper ទាំង ២ ទទួលតែលេខវិជ្ជមាន (មិនបោះចោលលើ undefined · null · NaN · object · array)', () => {
        [undefined, null, NaN, {}, [], 'x', { ztoSignedAt: 0 }, { ztoSignedAt: '5' }, { ztoSignedAt: NaN }].forEach((v: any) => {
            expect(barcodeZtoSigned(v)).toBe(false);
            expect(barcodeZtoReturned(v)).toBe(false);
        });
        expect(barcodeZtoSigned({ ztoSignedAt: 5 })).toBe(true);
        expect(barcodeZtoReturned({ ztoReturnedAt: 5 })).toBe(true);
        [undefined, null, {}, [], { barcodes: {} }, { barcodes: [] }].forEach((v: any) => expect(trashZtoFinalBlock(v)).toBe(''));
    });

    it('Sign ៖ verdict true លើ barcode បិទ ➜ ztoSignedAt (ប្រវត្តិ + ធុងសំរាមយករួច) · barcode បើក/មិនមាន verdict មិនប៉ះ', async () => {
        seedHistory([item('h1', [bc('S1', { isClosed: true, closedAt: 5 }), bc('S2', { isClosed: false }), bc('S3', { isClosed: true, closedAt: 5 })])]);
        seedTrash([item('t1', [bc('S4', { isClosed: true })], { trashReason: 'pickup', isFromDeletion: true, deletedAt: 9 })]);
        setZtoPickupVerdict('S1', true);
        setZtoPickupVerdict('S2', true);
        setZtoPickupVerdict('S4', true);
        expect(await syncZtoFinalMarks()).toBe(2);
        const h = server[H + 'h1'].barcodes;
        expect(h[0].ztoSignedAt).toBeGreaterThan(0);
        expect(h[1].ztoSignedAt).toBeUndefined();
        expect(h[2].ztoSignedAt).toBeUndefined();
        expect(server[T + 't1'].barcodes[0].ztoSignedAt).toBeGreaterThan(0);
        expect(h[0].isClosed).toBe(true);
        expect(h[0].closedAt).toBe(5);
    });

    it('ត្រឡប់ ZTO ៖ ភស្តុតាង ➜ ztoReturnedAt = ម៉ោង ZTO លើធាតុធុងសំរាម returned តែប៉ុណ្ណោះ (មិនប៉ះប្រវត្តិ ឬ trash ប្រភេទផ្សេង)', async () => {
        seedHistory([item('h2', [bc('R1')])]);
        seedTrash([
            item('t2', [bc('R1')], { trashReason: 'returned', deletedAt: 9 }),
            item('t3', [bc('R2')], { trashReason: 'remove', isFromDeletion: false, deletedAt: 9 })
        ]);
        const back = Date.now() - 60000;
        noteZtoReturnedEvidence('R1', back);
        noteZtoReturnedEvidence('R2', back);
        expect(await syncZtoFinalMarks()).toBe(1);
        expect(server[T + 't2'].barcodes[0].ztoReturnedAt).toBe(back);
        expect(server[T + 't3'].barcodes[0].ztoReturnedAt).toBeUndefined();
        expect(server[H + 'h2'].barcodes[0].ztoReturnedAt).toBeUndefined();
        expect(await syncZtoFinalMarks()).toBe(0);
    });

    it('📍 ខុសទីតាំង ៖ ភស្តុតាង misplaced ➜ ztoReturnedAt + ztoMisplacedAt (ម៉ោងដដែល) · ត្រឡប់ធម្មតា ➜ គ្មាន ztoMisplacedAt · ស្លាក «ខុសទីតាំង» · 🔒', async () => {
        seedTrash([
            item('m1', [bc('M1')], { trashReason: 'returned', deletedAt: 9 }),
            item('m2', [bc('M2')], { trashReason: 'returned', deletedAt: 8 })
        ]);
        const back = Date.now() - 60000;
        noteZtoReturnedEvidence('M1', back, true);
        noteZtoReturnedEvidence('M2', back);
        expect(buildTrashGroups(dataState.deletedItems).map((g: any) => g.reason)).toEqual(['misplaced', 'returned']);
        expect(trashRestoreBlockOf(dataState.deletedItems[0])).toBe('misplaced');
        expect(await syncZtoFinalMarks()).toBe(2);
        expect(server[T + 'm1'].barcodes[0]).toMatchObject({ ztoReturnedAt: back, ztoMisplacedAt: back });
        expect(server[T + 'm2'].barcodes[0].ztoReturnedAt).toBe(back);
        expect(server[T + 'm2'].barcodes[0].ztoMisplacedAt).toBeUndefined();
        resetZtoFinalMarks();
        dataState.deletedItems = [server[T + 'm1'], server[T + 'm2']];
        const groups = buildTrashGroups(dataState.deletedItems);
        expect(groups.map((g: any) => g.reason)).toEqual(['misplaced', 'returned']);
        expect(trashZtoFinalBlock(server[T + 'm1'])).toBe('misplaced');
        expect(trashZtoFinalBlock(server[T + 'm2'])).toBe('returned');
        expect(TRASH_REASON_META.misplaced).toMatchObject({ label: 'ខុសទីតាំង', deducted: true });
        expect(applyZtoFinalMarks(item('h9', [bc('M3')]), { M3: { returned: back, misplaced: true } }, false)).toBeUndefined();
    });

    it('📍 rules មិនទាន់មាន `ztoMisplacedAt` ➜ ការកត់ត្រឡប់ (`ztoReturnedAt` · 🔒) នៅចូល · ស្លាកខុសទីតាំងសាកម្តងទៀតក្រោយ Publish', async () => {
        seedTrash([item('mr', [bc('MR1')], { trashReason: 'returned', deletedAt: 9 })]);
        const real = firebaseState.fb.runTransaction;
        let published = false;
        firebaseState.fb.runTransaction = async (ref: any, fn: (cur: any) => any) => {
            const cur = server[ref.path] === undefined ? null : JSON.parse(JSON.stringify(server[ref.path]));
            const next = fn(cur);
            if (!published && next && JSON.stringify(next).includes('ztoMisplacedAt')) throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
            return real(ref, fn);
        };
        const back = Date.now() - 60000;
        noteZtoReturnedEvidence('MR1', back, true);
        expect(await syncZtoFinalMarks()).toBe(1);
        expect(server[T + 'mr'].barcodes[0].ztoReturnedAt).toBe(back);
        expect(server[T + 'mr'].barcodes[0].ztoMisplacedAt).toBeUndefined();
        expect(trashZtoFinalBlock(server[T + 'mr'])).toBe('returned');
        expect(trashRestoreBlockOf(server[T + 'mr'])).toBe('misplaced');
        dataState.deletedItems = [server[T + 'mr']];
        expect(buildTrashGroups(dataState.deletedItems)[0].reason).toBe('misplaced');
        expect(await syncZtoFinalMarks()).toBe(0);
        published = true;
        ztoMisplacedRefused.at = Date.now() - ZTO_FINAL_REFUSED_RETRY_MS - 1;
        ztoFinalFailedAt.clear();
        expect(await syncZtoFinalMarks()).toBe(1);
        expect(server[T + 'mr'].barcodes[0]).toMatchObject({ ztoReturnedAt: back, ztoMisplacedAt: back });
        expect(trashZtoFinalBlock(server[T + 'mr'])).toBe('misplaced');
        firebaseState.fb.runTransaction = real;
    });

    it('rules មិនទាន់ Publish (permission_denied) ➜ ឈប់សាកសម្រាប់ database នោះ · មិនបោះចោល · មិនប៉ះទិន្នន័យ', async () => {
        seedHistory([item('h3', [bc('P1', { isClosed: true, closedAt: 5 })])]);
        setZtoPickupVerdict('P1', true);
        reject = () => Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });
        expect(await syncZtoFinalMarks()).toBe(0);
        expect(ztoState.ztoFinalRefusedDb).toBe(firebaseState.db);
        const tried = txPaths.length;
        reject = () => null;
        expect(await syncZtoFinalMarks()).toBe(0);
        expect(txPaths.length).toBe(tried);
        expect(server[H + 'h3'].barcodes[0].ztoSignedAt).toBeUndefined();
        expect(ZTO_FINAL_REFUSED_RETRY_MS).toBeGreaterThan(0);
    });

    it('ធាតុកំពុងស្តារ/សម្អាត ➜ transaction បោះបង់ (មិនសរសេរ)', () => {
        const w = { S1: { signed: 7 } };
        expect(applyZtoFinalMarks(item('x', [bc('S1', { isClosed: true })], { clearClaim: { token: 't', claimedAt: 1 } }), w, false)).toBeUndefined();
        expect(applyZtoFinalMarks(item('x', [bc('S1', { isClosed: true })], { restoreClaim: { token: 't' } }), w, true)).toBeUndefined();
        expect(applyZtoFinalMarks(null, w, false)).toBeUndefined();
        expect(applyZtoFinalMarks(item('x', [bc('S1', { isClosed: true })]), w, false).barcodes[0].ztoSignedAt).toBe(7);
    });

    it('ប្តូរ session ពាក់កណ្តាល ➜ គ្មានការសរសេរបន្ទាប់', async () => {
        seedHistory([item('a1', [bc('Q1', { isClosed: true })]), item('a2', [bc('Q2', { isClosed: true })])]);
        setZtoPickupVerdict('Q1', true);
        setZtoPickupVerdict('Q2', true);
        const run = firebaseState.fb.runTransaction;
        firebaseState.fb.runTransaction = async (ref: any, fn: any) => {
            const out = await run(ref, fn);
            firebaseState.authGeneration++;
            return out;
        };
        expect(await syncZtoFinalMarks()).toBe(0);
        expect(txPaths.length).toBe(1);
    });
});

describe('ប៊ូតុង និងការបើកវិញ', () => {
    it('ជួរប្រវត្តិ ៖ Sign (DB ឬ verdict ក្នុងឧបករណ៍) ➜ «🔒 Sign រួច» · បិទក្នុង ZoeW តែប៉ុណ្ណោះ ➜ «❌ បើក»', () => {
        const signed = item('r1', [bc('L1', { isClosed: true, ztoSignedAt: 9 })]);
        const local = item('r2', [bc('L2', { isClosed: true })]);
        const plain = item('r3', [bc('L3', { isClosed: true })]);
        setZtoPickupVerdict('L2', true);
        expect(itemReopenLockedByZto(signed)).toBe(true);
        expect(itemReopenLockedByZto(local)).toBe(true);
        expect(itemReopenLockedByZto(plain)).toBe(false);
        expect(barcodeSignedInZto(bc('L2', { isClosed: false }))).toBe(false);
        const html = (it: any) => renderToStaticMarkup(<table><tbody><tr><HistoryRow row={buildHistoryRowModel(it, 1, false, false)} /></tr></tbody></table>);
        expect(html(signed)).toContain('🔒 Sign រួច');
        expect(html(signed)).not.toContain('❌ បើក');
        expect(html(plain)).toContain('❌ បើក');
    });

    it('បើក barcode ដែលមាន ztoSignedAt ➜ បដិសេធមុនសរសេរ (គ្មាន transaction)', async () => {
        seedHistory([item('b1', [bc('K1', { isClosed: true, closedAt: 5, ztoSignedAt: 9 })])]);
        expect(await applyBarcodeCloseChange('b1', 'K1', false, {})).toBe(false);
        expect(txPaths).toEqual([]);
        expect(toasts()).toContain(ZTO_SIGNED_REOPEN_TEXT);
    });

    it('server មាន ztoSignedAt (ឧបករណ៍ផ្សេងកត់) តែទិដ្ឋភាពក្នុងស្រុកមិនទាន់មាន ➜ transaction បដិសេធ · ស្ថានភាពត្រឡប់ · សារ 🔒', async () => {
        seedHistory([item('b2', [bc('K2', { isClosed: true, closedAt: 5 })])]);
        server[H + 'b2'].barcodes[0].ztoSignedAt = 9;
        expect(await applyBarcodeCloseChange('b2', 'K2', false, { showModal: false })).toBe(false);
        expect(server[H + 'b2'].barcodes[0].isClosed).toBe(true);
        expect(dataState.scanHistory[0].barcodes[0].isClosed).toBe(true);
        expect(toasts()).toContain(ZTO_SIGNED_REOPEN_TEXT);
    });

    it('បើកកញ្ចប់ទាំងមូលដែលមាន barcode Sign ➜ transaction បដិសេធ · ស្ថានភាពត្រឡប់ · ការបិទនៅធ្វើបាន', async () => {
        seedHistory([item('c1', [bc('M1', { isClosed: true, closedAt: 5 }), bc('M2', { isClosed: true, closedAt: 5 })], { closedAt: 5 })]);
        server[H + 'c1'].barcodes[1].ztoSignedAt = 9;
        expect(await toggleCloseStatus('c1')).toBe(false);
        expect(server[H + 'c1'].barcodes.every((b: any) => b.isClosed)).toBe(true);
        expect(dataState.scanHistory[0].barcodes.every((b: any) => b.isClosed)).toBe(true);
        expect(toasts()).toContain(ZTO_SIGNED_REOPEN_TEXT);
    });
});

describe('ស្តារពីធុងសំរាម', () => {
    it('ត្រឡប់ ZTO (barcode ណាមួយ) · យករួចដែល Sign គ្រប់ barcode ➜ 🔒 · ត្រឡប់ថ្ងៃទី ៨ · យករួចបិទក្នុង ZoeW · លុប · ដក ➜ ស្តារបាន', () => {
        expect(trashZtoFinalBlock(item('1', [bc('A', { ztoReturnedAt: 5 })], { trashReason: 'returned' }))).toBe('returned');
        expect(trashZtoFinalBlock(item('2', [bc('A')], { trashReason: 'returned' }))).toBe('');
        expect(trashZtoFinalBlock(item('3', [bc('A', { isClosed: true, ztoSignedAt: 5 })], { trashReason: 'pickup' }))).toBe('signed');
        expect(trashZtoFinalBlock(item('4', [bc('A', { isClosed: true, ztoSignedAt: 5 }), bc('B', { isClosed: true })], { trashReason: 'pickup' }))).toBe('');
        expect(trashZtoFinalBlock(item('5', [bc('A', { isClosed: true, ztoSignedAt: 5 })], { trashReason: 'delete' }))).toBe('');
        expect(trashZtoFinalBlock(item('6', [bc('A', { isClosed: true, ztoSignedAt: 5 })], { trashReason: 'remove' }))).toBe('');
        noteZtoReturnedEvidence('E1', Date.now());
        expect(trashRestoreBlockOf(item('7', [bc('E1')], { trashReason: 'returned' }))).toBe('returned');
        setZtoPickupVerdict('V1', true);
        expect(trashRestoreBlockOf(item('8', [bc('V1', { isClosed: true })], { trashReason: 'pickup' }))).toBe('signed');
    });

    it('🔄 លើធាតុបិទក្នុង ZTO ➜ សារ 🔒 · មិនបើកផ្ទាំងបញ្ជាក់', () => {
        seedTrash([item('t9', [bc('Z1', { ztoReturnedAt: 5 })], { trashReason: 'returned', deletedAt: 9 })]);
        promptRestoreDeletedItem('t9');
        expect(uiState.pendingRestoreId).toBeNull();
        expect(toasts().some((m) => m.startsWith('🔒'))).toBe(true);
    });

    it('executeRestoreItem ៖ server មាន ztoReturnedAt ➜ មិនប្រកាសការស្តារ (គ្មាន transaction) · សារ 🔒', async () => {
        seedTrash([item('t10', [bc('Z2')], { trashReason: 'returned', deletedAt: 9 })]);
        server[T + 't10'].barcodes[0].ztoReturnedAt = 5;
        uiState.pendingRestoreId = 't10';
        await executeRestoreItem();
        expect(txPaths).toEqual([]);
        expect(server[T + 't10']).toBeTruthy();
        expect(toasts()).toContain(ZTO_RESTORE_FINAL_TEXT);
    });
});
