/**
 * Deep audit ជុំ ៥ (Toast ៖ ⏳ ➜ ✅/❌ តាមការពិត) ៖ `reconcileCollectedHistory()` ពេលការសរសេរ mirror «ចំណូលប្រចាំថ្ងៃ» ព្យួរ (dbOp ១៥ វិ.) ៖
 *   - មុនកែ ៖ «⚠️ … ចំណូលប្រចាំថ្ងៃមិនទាន់ Sync ពេញលេញទេ!» ទោះ `armLateWrite` រត់ការផ្ទៀងផ្ទាត់ឡើងវិញពេលការសរសេរចុះ ➜ Sync ស្ងាត់ក្រោយ ⚠️ (សារចាស់ · គ្មាន ✅)
 *   - ក្រោយកែ ៖ «⏳ … នឹង Sync ដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ» · លទ្ធផល `'pending'` · ការសរសេរចុះយឺត ➜ ផ្ទៀងផ្ទាត់ឡើងវិញ ➜ «✅ បណ្តាញត្រឡប់មកវិញ — … Sync រួចរាល់»
 *     · ការសរសេរយឺតបរាជ័យ ➜ ⚠️ (មិនស្ងាត់)។
 *   ទិសផ្ទុយ ៖ ការបដិសេធ (មិនព្យួរ) · រកប្រភពមិនឃើញ ➜ ⚠️ ដូចដើម · គ្មាន ⏳។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { reconcileCollectedHistory } from '../src/domain/collected';
import { pickupBarcodeKey } from '../src/domain/pickup';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';

type Deferred = { resolve: (v?: any) => void; reject: (e: any) => void; payload: any };
let updates: Deferred[];
let item: any;
const savedFb = firebaseState.fb;
const KEY = pickupBarcodeKey('ZTX0001');
const texts = () => uiState.toasts.map((t: any) => t.msg);
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
    vi.useFakeTimers();
    updates = [];
    item = { id: 'item1', phone: '0961111111', barcodes: [{ code: 'ZTX0001', cod: 5, dod: 0, isClosed: true, closedAt: Date.now() }] };
    uiState.toasts = [];
    dataState.dailyCollectedData = {};
    firebaseState.db = { name: 'db' } as any;
    firebaseState.authGeneration = 1;
    firebaseState.dbRefDailyCollected = { path: 'zoew_daily_collected_cod_dod' } as any;
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        get: async (ref: any) => ({ val: () => (String(ref.path).indexOf('zoew_scan_history_cod_dod/') === 0 ? item : null), exists: () => false }),
        update: (_ref: any, payload: any) => new Promise((resolve, reject) => { updates.push({ resolve, reject, payload }); })
    } as any;
});

afterEach(() => {
    firebaseState.fb = savedFb;
    firebaseState.dbLivenessProbe = null as any;
    vi.clearAllTimers();
    vi.useRealTimers();
});

async function stallFirstWrite() {
    const run = reconcileCollectedHistory('item1', [KEY]);
    await flush();
    expect(updates.length).toBe(1);
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
    return run;
}

describe('ចំណូលប្រចាំថ្ងៃ ៖ ការសរសេរព្យួរ ➜ ⏳ រួច ✅/⚠️ តាមការពិត', () => {
    it('ព្យួរ ➜ ⏳ (មិនមែន ⚠️) · pending · ការសរសេរចុះយឺត ➜ ✅', async () => {
        const result = await stallFirstWrite();
        expect(result).toBe('pending');
        expect(texts().some((m) => m.indexOf('⏳') === 0 && /ចំណូលប្រចាំថ្ងៃ/.test(m) && /ស្វ័យប្រវត្តិ/.test(m))).toBe(true);
        expect(texts().some((m) => m.indexOf('⚠️') === 0)).toBe(false);
        updates[0].resolve();
        await flush();
        await flush();
        expect(updates.length).toBe(2);
        updates[1].resolve();
        await flush();
        await flush();
        await flush();
        expect(texts().some((m) => m.indexOf('✅') === 0 && /ចំណូលប្រចាំថ្ងៃ/.test(m))).toBe(true);
        expect(texts().some((m) => m.indexOf('⚠️') === 0)).toBe(false);
    });

    it('ព្យួរ ➜ ⏳ · ការសរសេរយឺតបរាជ័យ ➜ ⚠️ (មិនស្ងាត់ · គ្មាន ✅)', async () => {
        await stallFirstWrite();
        updates[0].reject(new Error('permission_denied'));
        await flush();
        await flush();
        expect(texts().some((m) => m.indexOf('⚠️') === 0 && /ចំណូលប្រចាំថ្ងៃ/.test(m))).toBe(true);
        expect(texts().some((m) => m.indexOf('✅') === 0)).toBe(false);
    });

    it('ព្យួរ ➜ ⏳ · ការផ្ទៀងផ្ទាត់ឡើងវិញបរាជ័យ ➜ ⚠️ (គ្មាន ✅)', async () => {
        await stallFirstWrite();
        updates[0].resolve();
        await flush();
        await flush();
        expect(updates.length).toBe(2);
        updates[1].reject(new Error('permission_denied'));
        await flush();
        await flush();
        await flush();
        expect(texts().some((m) => m.indexOf('⚠️') === 0 && /ចំណូលប្រចាំថ្ងៃ/.test(m))).toBe(true);
        expect(texts().some((m) => m.indexOf('✅') === 0)).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ ការបដិសេធភ្លាម ➜ ⚠️ ដូចដើម · null · គ្មាន ⏳', async () => {
        const run = reconcileCollectedHistory('item1', [KEY]);
        await flush();
        updates[0].reject(new Error('permission_denied'));
        const result = await run;
        expect(result).toBe(null);
        expect(texts().some((m) => m.indexOf('⚠️') === 0 && /ចំណូលប្រចាំថ្ងៃ/.test(m))).toBe(true);
        expect(texts().some((m) => m.indexOf('⏳') === 0)).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ រកប្រភពមិនឃើញ ➜ ⚠️ ដូចដើម · null · គ្មានការសរសេរ', async () => {
        item = null;
        const result = await reconcileCollectedHistory('item1', [KEY]);
        expect(result).toBe(null);
        expect(updates.length).toBe(0);
        expect(texts().some((m) => m.indexOf('⚠️') === 0 && /ចំណូលប្រចាំថ្ងៃ/.test(m))).toBe(true);
    });
});
