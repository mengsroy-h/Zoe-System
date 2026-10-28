import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { ZTO_RESTORE_FINAL_TEXT, ZTO_SIGNED_REOPEN_TEXT } from '../src/core/text';
import { barcodeCloseIsRipe, barcodeZtoReturned, barcodeZtoSigned, stampTrashPolicy, trashZtoFinalBlock } from '../src/domain/barcode';
import {
    ZTO_FINAL_REFUSED_RETRY_MS, ZTO_FINAL_SCHEDULE_MS, ZTO_FINAL_SWEEP_BATCH, applyZtoFinalMarks, barcodeSignedInZto, itemReopenLockedByZto, noteZtoReturnedEvidence, resetZtoFinalMarks,
    syncZtoFinalMarks, trashRestoreBlockOf, ztoFinalFailedAt
} from '../src/features/zto-final-marks';
import * as finalMarksModule from '../src/features/zto-final-marks';
import { ztoPickupStatus, setZtoPickupVerdict } from '../src/features/zto-status';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { TRASH_REASON_META, buildTrashGroups, promptRestoreDeletedItem } from '../src/features/trash';
import { claimDeletedItemForRestore, executeRestoreItem } from '../src/features/restore';
import { buildHistoryRowModel } from '../src/app/components/history/rowModel';
import { HistoryRow } from '../src/app/components/history/HistoryRow';
import { renderHistory } from '../src/ui/history-render';

const toasts = () => (uiState.toasts || []).map((t: any) => String(t.msg || ''));
const H = 'zoew_scan_history_cod_dod/';
const T = 'zoew_recently_deleted_cod_dod/';

describe('ច្បាប់ cleanup និងស្តារ តាមរបៀប Lookup', () => {
    const now = 1800000000000;
    const hour = 3600000;
    it('Palm មិនសម្អាតកញ្ចប់ដែល ZoeW បិទ តែ ZTO មិនទាន់ Sign', () => {
        expect(barcodeCloseIsRipe({ isClosed: true, closedAt: now - 3 * hour }, now, 'palm')).toBe(false);
    });
    it.each([undefined, now - 3 * hour, now])('Cookie រាប់ពីពេលបិទ ZoeW ២ ម៉ោង ទោះ Sign នៅ %s', (ztoSignedAt) => {
        expect(barcodeCloseIsRipe({ isClosed: true, closedAt: now, ztoSignedAt }, now, 'cookie')).toBe(false);
        expect(barcodeCloseIsRipe({ isClosed: true, closedAt: now - 2 * hour + 1, ztoSignedAt }, now, 'cookie')).toBe(false);
        expect(barcodeCloseIsRipe({ isClosed: true, closedAt: now - 2 * hour, ztoSignedAt }, now, 'cookie')).toBe(true);
        expect(barcodeCloseIsRipe({ isClosed: true, closedAt: now - 3 * hour, ztoSignedAt }, now, 'cookie')).toBe(true);
        expect(barcodeCloseIsRipe({ isClosed: false, ztoSignedAt: now }, now, 'cookie')).toBe(false);
    });
    it('ZTO Login រាប់ពី Sign ពិត មិនរាប់ពីពេលបិទក្នុង ZoeW', () => {
        expect(barcodeCloseIsRipe({ isClosed: true, closedAt: now - 3 * hour, ztoSignedAt: now - hour }, now, 'palm')).toBe(false);
        expect(barcodeCloseIsRipe({ isClosed: true, closedAt: now, ztoSignedAt: now - 2 * hour }, now, 'palm')).toBe(true);
    });
    it.each(['delete', 'remove', 'returned', 'pickup'])('ធុងសំរាម %s ក្នុង ZTO Login មិនអាចស្តារបាន', (trashReason) => {
        expect(trashZtoFinalBlock({ trashMode: 'palm', trashReason, barcodes: [bc('UNSIGNED')] })).toBe('palm');
    });
    it.each(['delete', 'remove', 'returned', 'pickup'])('Cookie %s មាន Sign ពិតមួយក្នុងកញ្ចប់រួម ក៏មិនអាចស្តារបាន', (trashReason) => {
        expect(trashZtoFinalBlock({ trashMode: 'cookie', trashReason, barcodes: [bc('SIGNED', { ztoSignedAt: now }), bc('UNSIGNED')] })).toBe('signed');
    });
    it('ត្រាហាមស្តារ (`restoreBlocked`) ប្រាប់មូលហេតុពិត ៖ ត្រឡប់ ➜ «ត្រឡប់» · Sign ➜ «Sign» · គ្មានភស្តុតាង ➜ នៅ 🔒', () => {
        expect(trashZtoFinalBlock({ trashReason: 'returned', restoreBlocked: true, barcodes: [bc('R', { ztoReturnedAt: now })] })).toBe('returned');
        expect(trashZtoFinalBlock({ trashReason: 'returned', restoreBlocked: true, barcodes: [bc('R', { ztoReturnedAt: now }), bc('S', { ztoSignedAt: now })] })).toBe('signed');
        expect(trashZtoFinalBlock({ trashReason: 'remove', restoreBlocked: true, barcodes: [bc('U')] })).toBe('signed');
        expect(trashZtoFinalBlock({ trashReason: 'remove', restoreBlocked: true })).toBe('signed');
        expect(trashRestoreBlockOf({ trashReason: 'returned', restoreBlocked: true, barcodes: [bc('M', { ztoReturnedAt: now, ztoSentOutAt: now })] }),
            'server ហាមរួច ➜ UI មិនបង្ហាញ 🔄 ទោះភស្តុតាងបញ្ជូនចេញ').toBe('signed');
    });
    it.each(['sent', 'misplaced', 'left'])('server ហាមរួច លើកញ្ចប់ត្រឡប់ធម្មតា ➜ 🔒 «ត្រឡប់» ទោះឧបករណ៍មានភស្តុតាង %s', (kind) => {
        const blocked = { trashReason: 'returned', restoreBlocked: true, barcodes: [bc('RB1', { ztoReturnedAt: now })] };
        const open = { trashReason: 'returned', barcodes: [bc('RB1', { ztoReturnedAt: now })] };
        expect(trashZtoFinalBlock(blocked), 'ត្រាលើ server គឺ «ត្រឡប់»').toBe('returned');
        expect(trashRestoreBlockOf(blocked), 'គ្មានភស្តុតាងឧបករណ៍').toBe('returned');
        noteZtoReturnedEvidence('RB1', Date.now() - 60000, kind);
        expect(trashRestoreBlockOf(open), 'មិនទាន់ហាម ➜ ស្តារបានតាមភស្តុតាងឧបករណ៍').toBe('');
        expect(trashRestoreBlockOf(blocked), 'server ហាមរួច ➜ មិនបង្ហាញ 🔄').toBe('returned');
        expect(trashRestoreBlockOf(blocked, true)).toBe('returned');
    });
    it('រក្សាច្បាប់ធម្មតាសម្រាប់ Lookup មិនមែន ZTO ហើយបដិសេធពេលវេលាមិនត្រឹមត្រូវ', () => {
        expect(barcodeCloseIsRipe({ isClosed: true, closedAt: now - 3 * hour }, now, 'local')).toBe(true);
        for (const stamp of [undefined, NaN, Infinity, -Infinity, -1, 0, '5', {}, [], now + 1]) {
            expect(barcodeCloseIsRipe({ isClosed: true, closedAt: now - 3 * hour, ztoSignedAt: stamp }, now, 'palm')).toBe(false);
            expect(barcodeCloseIsRipe({ isClosed: true, closedAt: stamp, ztoSignedAt: now - 3 * hour }, now, 'cookie')).toBe(false);
        }
        for (const value of [undefined, null, NaN, {}, []]) expect(barcodeCloseIsRipe(value, now, 'cookie')).toBe(false);
        for (const stamp of [NaN, Infinity, -Infinity]) expect(barcodeCloseIsRipe({ isClosed: true, closedAt: now - 3 * hour }, stamp, 'cookie')).toBe(false);
    });
});

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
    it('ម៉ោង Sign ពិតកែត្រាពេលសង្កេតម្តង ហើយមិនប៉ះកញ្ចប់ស្តារជុំថ្មី', () => {
        const current = item('exact', [bc('A', { isClosed: true, ztoSignedAt: 100 }), bc('B', { isClosed: true, ztoSignedAt: 100, restoredAt: 90 })]);
        const updated = applyZtoFinalMarks(current, { A: { signed: 80, signedExact: true }, B: { signed: 80, signedExact: true } }, false);
        expect(updated.barcodes[0]).toMatchObject({ ztoSignedAt: 80, ztoSignedExact: true });
        expect(updated.barcodes[1].ztoSignedAt).toBe(100);
        expect(applyZtoFinalMarks(updated, { A: { signed: 50, signedExact: true } }, false)).toBeUndefined();
    });

    it('ធុងសំរាម legacy Sign រួចទទួលត្រាហាមស្តារ ទោះ cache ទទេ', async () => {
        seedTrash([item('legacy', [bc('S', { ztoSignedAt: 5 })], { trashReason: 'delete' })]);
        await syncZtoFinalMarks();
        expect(server[T + 'legacy']).toMatchObject({ restoreBlocked: true, trashMode: 'local' });
        expect(server[T + 'legacy'].barcodes[0].ztoSignedAt).toBe(5);
    });

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

    it('⛔ Sign ច្រើនជាងមួយបាច់ (ZTO_FINAL_SWEEP_BATCH) ៖ snapshot history នីមួយៗ (renderHistory) ➜ បាច់បន្ទាប់ក្នុង ZTO_FINAL_SCHEDULE_MS មិនរង់ចាំជុំ ៦០ វិ. (ឧបករណ៍ទុកវេនអានត្រានេះ)', async () => {
        vi.useFakeTimers();
        try {
            const items = Array.from({ length: 2 * ZTO_FINAL_SWEEP_BATCH + 5 }, (_, k) => item('b' + k, [bc('B' + k, { isClosed: true, closedAt: 5 })]));
            seedHistory(items);
            items.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, true));
            const stamped = () => items.filter((it) => server[H + it.id].barcodes[0].ztoSignedAt > 0).length;
            const snapshot = () => {
                dataState.scanHistory = items.map((it) => JSON.parse(JSON.stringify(server[H + it.id])));
                renderHistory(dataState.scanHistory);
            };
            const counts: number[] = [];
            snapshot();
            for (let round = 0; round < 3; round++) {
                await vi.advanceTimersByTimeAsync(ZTO_FINAL_SCHEDULE_MS);
                counts.push(stamped());
                snapshot();
            }
            expect(counts).toEqual([ZTO_FINAL_SWEEP_BATCH, 2 * ZTO_FINAL_SWEEP_BATCH, items.length]);
        } finally {
            vi.useRealTimers();
        }
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
        noteZtoReturnedEvidence('M1', back, 'misplaced');
        noteZtoReturnedEvidence('M2', back);
        expect(buildTrashGroups(dataState.deletedItems).map((g: any) => g.reason)).toEqual(['misplaced', 'returned']);
        expect(trashRestoreBlockOf(dataState.deletedItems[0])).toBe('');
        expect(await syncZtoFinalMarks()).toBe(2);
        expect(server[T + 'm1'].barcodes[0]).toMatchObject({ ztoReturnedAt: back, ztoMisplacedAt: back });
        expect(server[T + 'm2'].barcodes[0].ztoReturnedAt).toBe(back);
        expect(server[T + 'm2'].barcodes[0].ztoMisplacedAt).toBeUndefined();
        resetZtoFinalMarks();
        dataState.deletedItems = [server[T + 'm1'], server[T + 'm2']];
        const groups = buildTrashGroups(dataState.deletedItems);
        expect(groups.map((g: any) => g.reason)).toEqual(['misplaced', 'returned']);
        expect(trashZtoFinalBlock(server[T + 'm1'])).toBe('');
        expect(trashZtoFinalBlock(server[T + 'm2'])).toBe('returned');
        expect(TRASH_REASON_META.misplaced).toMatchObject({ label: 'ខុសទីតាំង', deducted: true });
        expect(applyZtoFinalMarks(item('h9', [bc('M3')]), { M3: { returned: back, misplaced: true } }, false)).toBeUndefined();
    });

    it('📤 បញ្ជូនចេញ (គ្មាន «ទីតាំងមិនត្រឹមត្រូវ») ៖ ztoSentOutAt តែម្យ៉ាង (គ្មាន ztoReturnedAt) · ស្លាក «បញ្ជូនចេញ» លើគ្រប់ឧបករណ៍ · ស្តារបាន · ធាតុចម្រុះជាមួយ -710 ➜ 🔒', async () => {
        seedTrash([
            item('s1', [bc('S1')], { trashReason: 'returned', deletedAt: 9 }),
            item('s2', [bc('S2'), bc('R9')], { trashReason: 'returned', deletedAt: 8 })
        ]);
        const back = Date.now() - 60000;
        noteZtoReturnedEvidence('S1', back, 'sent');
        noteZtoReturnedEvidence('S2', back, 'sent');
        noteZtoReturnedEvidence('R9', back);
        expect(buildTrashGroups([dataState.deletedItems[0]]).map((g: any) => g.reason)).toEqual(['sent']);
        expect(trashRestoreBlockOf(dataState.deletedItems[0])).toBe('');
        expect(trashRestoreBlockOf(dataState.deletedItems[1])).toBe('returned');
        expect(await syncZtoFinalMarks()).toBe(2);
        expect(server[T + 's1'].barcodes[0]).toMatchObject({ ztoSentOutAt: back });
        expect(server[T + 's1'].barcodes[0].ztoReturnedAt).toBeUndefined();
        expect(server[T + 's1'].barcodes[0].ztoMisplacedAt).toBeUndefined();
        expect(server[T + 's2'].barcodes.map((b: any) => [b.code, b.ztoReturnedAt, b.ztoMisplacedAt, b.ztoSentOutAt]))
            .toEqual([['S2', undefined, undefined, back], ['R9', back, undefined, undefined]]);
        expect(await syncZtoFinalMarks(), 'ត្រារួច ➜ មិនសរសេរម្តងទៀត').toBe(0);
        resetZtoFinalMarks();
        dataState.deletedItems = [server[T + 's1'], server[T + 's2']];
        expect(buildTrashGroups([server[T + 's1']]).map((g: any) => g.reason), 'ឧបករណ៍ផ្សេង (គ្មានភស្តុតាង) ៖ ស្លាកពី DB').toEqual(['sent']);
        expect(trashRestoreBlockOf(server[T + 's1']), 'ឧបករណ៍ផ្សេង ៖ ស្តារបាន').toBe('');
        expect(trashZtoFinalBlock(server[T + 's1'])).toBe('');
        expect(trashRestoreBlockOf(server[T + 's2']), 'ធាតុចម្រុះ ៖ -710 នៅ 🔒').toBe('returned');
        expect(TRASH_REASON_META.sent).toMatchObject({ label: 'បញ្ជូនចេញ', deducted: true });
        expect(applyZtoFinalMarks(item('h8', [bc('S3')]), { S3: { sentOut: back } }, false), 'ប្រវត្តិ ៖ មិនកត់').toBeUndefined();
        expect(applyZtoFinalMarks(item('t8', [bc('S3')], { trashReason: 'remove' }), { S3: { sentOut: back } }, true), 'ធុងសំរាម «ដក» ៖ មិនកត់').toBeUndefined();
    });

    it('📤 App ចាស់កត់ «ខុសទីតាំង» លើការបញ្ជូនចេញ (ztoReturnedAt + ztoMisplacedAt) ➜ ភស្តុតាង «បញ្ជូនចេញ» កត់ ztoSentOutAt ➜ «បញ្ជូនចេញ» លើគ្រប់ឧបករណ៍', async () => {
        const back = Date.now() - 60000;
        seedTrash([item('o1', [bc('O1', { ztoReturnedAt: back, ztoMisplacedAt: back })], { trashReason: 'returned', deletedAt: 9 })]);
        expect(buildTrashGroups(dataState.deletedItems)[0].reason, 'លក្ខខណ្ឌ ៖ ត្រា App ចាស់ ➜ «ខុសទីតាំង»').toBe('misplaced');
        noteZtoReturnedEvidence('O1', back, 'sent');
        expect(buildTrashGroups(dataState.deletedItems)[0].reason, 'ឧបករណ៍នេះ ៖ ភស្តុតាងឈ្នះ').toBe('sent');
        expect(await syncZtoFinalMarks()).toBe(1);
        expect(server[T + 'o1'].barcodes[0]).toMatchObject({ ztoReturnedAt: back, ztoMisplacedAt: back, ztoSentOutAt: back });
        resetZtoFinalMarks();
        expect(buildTrashGroups([server[T + 'o1']])[0].reason, 'ឧបករណ៍ផ្សេង ៖ ztoSentOutAt ឈ្នះត្រា «ខុសទីតាំង»').toBe('sent');
        expect(trashRestoreBlockOf(server[T + 'o1'])).toBe('');
    });

    it('📤 APK ចាស់ ៖ rules ចាស់បដិសេធ ztoMisplacedAt ➜ ztoReturnedAt តែម្យ៉ាងលើការបញ្ជូនចេញ ➜ ztoSentOutAt ដោះ 🔒 (ស្តារបាន · «បញ្ជូនចេញ»)', async () => {
        const back = Date.now() - 60000;
        seedTrash([item('o2', [bc('O2', { ztoReturnedAt: back })], { trashReason: 'returned', deletedAt: 9 })]);
        expect(trashRestoreBlockOf(dataState.deletedItems[0]), 'លក្ខខណ្ឌ ៖ ztoReturnedAt តែម្យ៉ាង ➜ 🔒').toBe('returned');
        noteZtoReturnedEvidence('O2', back, 'sent');
        expect(await syncZtoFinalMarks()).toBe(1);
        resetZtoFinalMarks();
        expect(trashZtoFinalBlock(server[T + 'o2'])).toBe('');
        expect(trashRestoreBlockOf(server[T + 'o2'])).toBe('');
        expect(buildTrashGroups([server[T + 'o2']])[0].reason).toBe('sent');
    });

    it('📤 ភស្តុតាង «បញ្ជូនចេញ» មិនទាន់ពិនិត្យស្កេនបញ្ហា (`left` ៖ បញ្ជី 30 អានមិនបាន ឬ off) ➜ គ្មានត្រា · ស្លាក «ត្រឡប់» · ស្តារបាន', async () => {
        seedTrash([item('l1', [bc('L1')], { trashReason: 'returned', deletedAt: 9 })]);
        noteZtoReturnedEvidence('L1', Date.now() - 60000, 'left');
        expect(buildTrashGroups(dataState.deletedItems)[0].reason).toBe('returned');
        expect(trashRestoreBlockOf(dataState.deletedItems[0])).toBe('');
        expect(await syncZtoFinalMarks()).toBe(0);
        expect(txPaths).toEqual([]);
        expect(server[T + 'l1'].barcodes[0]).toEqual(bc('L1'));
    });

    it('⛔ rules បដិសេធត្រាស្លាក (`ztoSentOutAt` · `ztoMisplacedAt`) ➜ ធាតុនោះបរាជ័យទាំងមូល · គ្មានការសរសេរម្តងទៀតដោយដកស្លាកចេញ (Phase B ៖ rules Publish រួច) · ធាតុផ្សេងនៅចូល', async () => {
        seedHistory([item('hs', [bc('P2', { isClosed: true, closedAt: 5 })])]);
        seedTrash([item('so', [bc('SO1')], { trashReason: 'returned', deletedAt: 9 }), item('mr', [bc('MR1')], { trashReason: 'returned', deletedAt: 8 }),
            item('sr', [bc('SR1')], { trashReason: 'returned', deletedAt: 7 })]);
        const real = firebaseState.fb.runTransaction;
        const refusedWrites: string[] = [];
        firebaseState.fb.runTransaction = async (ref: any, fn: (cur: any) => any) => {
            const cur = server[ref.path] === undefined ? null : JSON.parse(JSON.stringify(server[ref.path]));
            const next = fn(cur);
            if (next && /ztoSentOutAt|ztoMisplacedAt/.test(JSON.stringify(next))) {
                refusedWrites.push(ref.path);
                throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
            }
            return real(ref, fn);
        };
        const back = Date.now() - 60000;
        setZtoPickupVerdict('P2', true);
        noteZtoReturnedEvidence('SO1', back, 'sent');
        noteZtoReturnedEvidence('MR1', back, 'misplaced');
        noteZtoReturnedEvidence('SR1', back);
        expect(await syncZtoFinalMarks()).toBe(2);
        expect(refusedWrites.sort(), 'សាកម្តងតែប៉ុណ្ណោះក្នុងមួយធាតុ').toEqual([T + 'mr', T + 'so'].sort());
        expect(ztoState.ztoFinalRefusedDb, 'មិនឈប់ត្រាទាំងអស់').toBeNull();
        expect(server[H + 'hs'].barcodes[0].ztoSignedAt).toBeGreaterThan(0);
        expect(server[T + 'sr'].barcodes[0].ztoReturnedAt).toBe(back);
        expect(server[T + 'so'].barcodes[0].ztoSentOutAt).toBeUndefined();
        expect(server[T + 'mr'].barcodes[0].ztoReturnedAt, 'គ្មាន ztoReturnedAt ដោយគ្មាន ztoMisplacedAt').toBeUndefined();
        expect(ztoFinalFailedAt.has(T + 'mr') && ztoFinalFailedAt.has(T + 'so')).toBe(true);
        expect(['ztoMisplacedRefused', 'ztoSentOutRefused'].some((name) => name in finalMarksModule)).toBe(false);
        firebaseState.fb.runTransaction = real;
    });

    it('📤 rules ចាស់ណាស់ (បដិសេធគ្រប់ត្រា) ➜ ធាតុដែលចង់តែ ztoSentOutAt មិនរារាំងការឈប់សាក ៣០ នាទីសម្រាប់ database នោះ', async () => {
        seedHistory([item('hz', [bc('P3', { isClosed: true, closedAt: 5 })])]);
        seedTrash([item('sz', [bc('SZ1')], { trashReason: 'returned', deletedAt: 9 })]);
        setZtoPickupVerdict('P3', true);
        noteZtoReturnedEvidence('SZ1', Date.now() - 60000, 'sent');
        reject = () => Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });
        expect(await syncZtoFinalMarks()).toBe(0);
        expect(ztoState.ztoFinalRefusedDb).toBe(firebaseState.db);
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
    it('Sign ពិត barcode ណាមួយហាមស្តារគ្រប់មូលហេតុ · unsigned Cookie នៅស្តារបាន', () => {
        expect(trashZtoFinalBlock(item('1', [bc('A', { ztoReturnedAt: 5 })], { trashReason: 'returned' }))).toBe('returned');
        expect(trashZtoFinalBlock(item('2', [bc('A')], { trashReason: 'returned' }))).toBe('');
        expect(trashZtoFinalBlock(item('3', [bc('A', { isClosed: true, ztoSignedAt: 5 })], { trashReason: 'pickup' }))).toBe('signed');
        expect(trashZtoFinalBlock(item('4', [bc('A', { isClosed: true, ztoSignedAt: 5 }), bc('B', { isClosed: true })], { trashReason: 'pickup' }))).toBe('signed');
        expect(trashZtoFinalBlock(item('5', [bc('A', { isClosed: true, ztoSignedAt: 5 })], { trashReason: 'delete' }))).toBe('signed');
        expect(trashZtoFinalBlock(item('6', [bc('A', { isClosed: true, ztoSignedAt: 5 })], { trashReason: 'remove' }))).toBe('signed');
        noteZtoReturnedEvidence('E1', Date.now());
        expect(trashRestoreBlockOf(item('7', [bc('E1')], { trashReason: 'returned' }))).toBe('returned');
        setZtoPickupVerdict('V1', true);
        expect(trashRestoreBlockOf(item('8', [bc('V1', { isClosed: true })], { trashReason: 'pickup' }))).toBe('signed');
    });

    it.each(['palm', 'cookie'])('transaction ការពារស្តារទោះឧបករណ៍មាន view ចាស់ (%s)', async (mode) => {
        const original = item('blocked', [bc('SIGNED', mode === 'cookie' ? { ztoSignedAt: 5 } : {})], { trashReason: 'remove' });
        seedTrash([original]);
        stampTrashPolicy(server[T + 'blocked'], mode);
        const before = JSON.stringify(server);
        await expect(claimDeletedItemForRestore('blocked', 'token', 'target')).rejects.toThrow('RESTORE_ZTO_FINAL');
        expect(JSON.stringify(server)).toBe(before);
        expect(dataState.deletedItems[0].restoreBlocked).toBeUndefined();
        expect(txPaths).toEqual([T + 'blocked']);
    });

    it('ត្រាមិនអាចស្តារបាននៅជាប់ទោះប្តូររបៀប ឬបិទ Lookup', () => {
        const signed = stampTrashPolicy(item('signed', [bc('S', { ztoSignedAt: 5 })]), 'cookie');
        const palm = stampTrashPolicy(item('palm', [bc('P')]), 'palm');
        for (const mode of ['cookie', 'local']) {
            expect(trashRestoreBlockOf(stampTrashPolicy(palm, mode))).toBe('palm');
            expect(trashRestoreBlockOf(stampTrashPolicy(signed, mode))).toBe('signed');
        }
    });

    it.each(['ztoSentOutAt', 'ztoMisplacedAt'])('Sign ថ្មីមុនត្រា DB ហាមស្តារទោះកញ្ចប់មាន %s', async (field) => {
        seedTrash([item('left', [bc('LEFT', { [field]: 5 })], { trashReason: 'returned', trashMode: 'cookie' })]);
        setZtoPickupVerdict('LEFT', true);
        const before = JSON.stringify(server);
        expect(trashRestoreBlockOf(dataState.deletedItems[0])).toBe('signed');
        await expect(claimDeletedItemForRestore('left', 'token', 'target')).rejects.toThrow('RESTORE_ZTO_FINAL');
        expect(JSON.stringify(server)).toBe(before);
    });

    it('🔄 លើធាតុបិទក្នុង ZTO ➜ សារ 🔒 · មិនបើកផ្ទាំងបញ្ជាក់', () => {
        seedTrash([item('t9', [bc('Z1', { ztoReturnedAt: 5 })], { trashReason: 'returned', deletedAt: 9 })]);
        promptRestoreDeletedItem('t9');
        expect(uiState.pendingRestoreId).toBeNull();
        expect(toasts().some((m) => m.startsWith('🔒'))).toBe(true);
    });

    it('📍 ខុសទីតាំង ស្តារបាន (ហាងច្រើនសាខា ៖ សាខាផ្សេងនៃហាងដដែលទទួល) ៖ DB មាន ztoMisplacedAt · ឬ rules មិនទាន់ Publish (តែ ztoReturnedAt + ភស្តុតាងក្នុងឧបករណ៍)', async () => {
        vi.stubGlobal('alert', () => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        for (const [id, extra, evidence] of [['tm1', { ztoReturnedAt: 5, ztoMisplacedAt: 5 }, false], ['tm2', { ztoReturnedAt: 5 }, true]] as const) {
            txPaths = [];
            uiState.toasts = [];
            seedTrash([item(id, [bc('M' + id, extra)], { trashReason: 'returned', deletedAt: 9 })]);
            for (const bucket of ['daily', 'monthly']) {
                const date = bucket === 'daily' ? '2026-10-06' : '2026-10';
                server[`zoew_${bucket}_revenue_cod_dod/${date}`] = { ded: { [id]: { at: 9, cod: 1, dod: 0, count: 1 } } };
            }
            if (evidence) noteZtoReturnedEvidence('M' + id, Date.now() - 60000, 'misplaced');
            expect(trashRestoreBlockOf(dataState.deletedItems[0])).toBe('');
            uiState.pendingRestoreId = id;
            await executeRestoreItem();
            expect(toasts()).not.toContain(ZTO_RESTORE_FINAL_TEXT);
            expect(txPaths.length, id + ' ៖ ការស្តារចាប់ផ្តើម').toBeGreaterThan(0);
        }
    }, 30000);

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
