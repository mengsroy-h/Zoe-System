import { beforeEach, expect, it } from 'vitest';
import { firebaseState } from '../src/core/state';
import { restoreClaimedItemToScanHistory } from '../src/domain/cleanup';
import { itemHasLiveTrashClaim } from '../src/domain/trash-claim';

/**
 * Remove · Delete · cleanup ដែលការសរសេរធុងសំរាមបរាជ័យគ្រប់ដង បញ្ចូល barcode ដែលបាន claim ត្រឡប់ទៅ history វិញ។ claim
 * (`trashClaim` · `trashClaimAt`) ត្រូវបានប្រើអស់ពេល move ➜ ការបញ្ចូលវិញត្រូវដកវាចេញ។ មុនកែ ៖ token ចាស់ត្រលប់មកជាមួយ ➜
 * barcode មើលទៅដូចប្រតិបត្តិការផ្សេងកាន់ ➜ Remove · Delete · ការសម្អាត ២ ម៉ោង/៨ ថ្ងៃ បដិសេធ «កំពុងដំណើរការ» រហូត claim ចាស់ ២៤ ម៉ោង។
 */

const HISTORY = 'zoew_scan_history_cod_dod';
const NOW = Date.now();
const clone = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
let store: Record<string, any>;

function fakeSdk() {
    const at = (path: string) => clone(path.split('/').filter(Boolean).reduce((node, key) => node?.[key], store) ?? null);
    const put = (path: string, value: any) => {
        const keys = path.split('/').filter(Boolean); let target = store;
        for (const key of keys.slice(0, -1)) target = target[key] ||= {};
        if (value == null) delete target[keys.at(-1)!]; else target[keys.at(-1)!] = clone(value);
    };
    return {
        ref: (_db: any, path = '') => ({ path, toString: () => 'https://reclaim.firebaseio.com/' + path }),
        runTransaction: async (ref: any, updater: any) => {
            const next = updater(at(ref.path));
            if (next === undefined) return { committed: false, snapshot: { val: () => at(ref.path) } };
            put(ref.path, next);
            return { committed: true, snapshot: { val: () => at(ref.path) } };
        }
    };
}

const consumed = (code: string) => ({ code, cod: 5, dod: 0, createdAt: NOW - 60000, isClosed: false, isDeducted: true,
    trashClaim: 'tc_' + 'a'.repeat(24), trashClaimAt: NOW - 1000 });

beforeEach(() => {
    store = {};
    firebaseState.authGeneration++;
    firebaseState.db = { app: { options: { databaseURL: 'https://reclaim.firebaseio.com' } } } as any;
    firebaseState.fb = fakeSdk() as any;
});

it('Remove ៖ barcode ដែលបញ្ចូលវិញក្នុងជួរដែលនៅ លែងជាប់ claim ចាស់ ហើយ claim រស់របស់ barcode ផ្សេងនៅដដែល', async () => {
    const live = { code: 'OTHER0001', cod: 1, dod: 0, createdAt: NOW - 50000, isClosed: false, trashClaim: 'tc_' + 'b'.repeat(24), trashClaimAt: NOW - 500 };
    store[HISTORY] = { row: { id: 'row', phone: '012000111', scanDate: '2026-11-03', createdAt: NOW - 60000, count: 1, barcodes: [live] } };
    const parent = { id: 'row', phone: '012000111', scanDate: '2026-11-03', createdAt: NOW - 60000, barcodes: [] };
    await restoreClaimedItemToScanHistory('row', null, { ...parent, barcodes: [consumed('REMOVE0001')] });
    const row = store[HISTORY].row;
    const back = row.barcodes.find((barcode: any) => barcode.code === 'REMOVE0001');
    expect(back, 'barcode ត្រឡប់មក history').toBeTruthy();
    expect(back.trashClaim, 'claim ដែលប្រើអស់មិនត្រលប់មក').toBeUndefined();
    expect(back.trashClaimAt).toBeUndefined();
    expect(back.isDeducted).toBeUndefined();
    const other = row.barcodes.find((barcode: any) => barcode.code === 'OTHER0001');
    expect(other.trashClaim, 'claim រស់របស់ប្រតិបត្តិការផ្សេងមិនត្រូវប៉ះ').toBe(live.trashClaim);
});

it('Delete ៖ ជួរទាំងមូលដែលបង្កើតវិញ លែងជាប់ claim ចាស់ ➜ ប្រតិបត្តិការបន្ទាប់មិនឃើញ «កំពុងដំណើរការ»', async () => {
    store[HISTORY] = {};
    const whole = { id: 'gone', phone: '012000222', scanDate: '2026-11-03', createdAt: NOW - 60000, count: 2,
        barcodes: [consumed('DELETE0001'), consumed('DELETE0002')] };
    await restoreClaimedItemToScanHistory('gone', whole, null);
    const row = store[HISTORY].gone;
    expect(row.barcodes).toHaveLength(2);
    expect(row.barcodes.every((barcode: any) => barcode.trashClaim === undefined && barcode.trashClaimAt === undefined)).toBe(true);
    expect(itemHasLiveTrashClaim(row, NOW), 'ជួរដែលបញ្ចូលវិញមិនមែនជាប់ claim').toBe(false);
});
