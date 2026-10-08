/**
 * ⛔ SCALE-6 ៖ `flushPendingRegistryReleases()` សួរ `registryReleaseVerdict(key)` ម្តងមួយ key ➜ `registryKeyIsOwned()` ដើរប្រវត្តិ + ធុងសំរាមទាំងមូល
 *    ហើយគណនា `barcodeRegistryKey()` (regex) លើគ្រប់ barcode **ម្តងទៀតសម្រាប់ key នីមួយៗ** ➜ O(key × barcode) ៖ ការលុបធុងសំរាមច្រើនរយ (ធុងសំរាម ៣០ ថ្ងៃធំ)
 *    ធ្វើឲ្យ main thread កកនៅ listener callback បន្ទាប់។
 * ⛔ ការ flush មួយគណនាសំណុំ key ដែលមានម្ចាស់ **ម្តង** (អាន `barcodes` របស់ធាតុនីមួយៗម្តង) — វាស់តាមចំនួនការអាន មិនមែនតាមម៉ោង · លទ្ធផលដូចដើម ៖
 *    key គ្មានម្ចាស់ ➜ ដោះ · key មានម្ចាស់ ➜ ទុក (មិនដោះ មិនដាក់ជួរ) · ទិដ្ឋភាពមិនស្រស់ ➜ ពន្យារ (នៅក្នុងជួរ) · ⛔ មិនផ្លាស់ទៅវដ្ត ៦០ វិ.។
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { pendingRegistryReleases } from '../src/core/clock';
import { DB_LISTENER_KEY_DELETED, dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { barcodeRegistryKey, flushPendingRegistryReleases, registryKeyIsOwned } from '../src/domain/registry';

let reads = 0;
function item(prefix: string, i: number) {
    const barcodes = [{ code: prefix + i + 'a' }, { code: prefix + i + 'b' }];
    const out: any = { id: prefix + i, phone: '012', scanDate: '2026-09-01' };
    Object.defineProperty(out, 'barcodes', { enumerable: true, get() { reads++; return barcodes; } });
    return out;
}

let updates: any[] = [];
beforeEach(() => {
    reads = 0;
    updates = [];
    pendingRegistryReleases.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    dataState.registryReleaseFlushInFlight = false;
    dataState.scanHistory = Array.from({ length: 300 }, (_, i) => item('H', i));
    dataState.deletedItems = Array.from({ length: 1500 }, (_, i) => item('T', i));
    firebaseState.db = { name: 'db' } as any;
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        update: vi.fn(async (_ref: any, u: any) => { updates.push(u); }),
    } as any;
});

const ITEMS = () => dataState.scanHistory.length + dataState.deletedItems.length;
function onePassReads() {
    reads = 0;
    registryKeyIsOwned(barcodeRegistryKey('NOPE'));
    const pass = reads;
    reads = 0;
    return pass;
}

describe('SCALE-6 ៖ flush registry គណនាសំណុំ key មានម្ចាស់ម្តង', () => {
    it('ជាន់អប្បបរមា ៖ getter រាប់ការអានពិត · key មានម្ចាស់ពិតមែន', () => {
        expect(registryKeyIsOwned(barcodeRegistryKey('T7a'))).toBe(true);
        expect(reads).toBeGreaterThan(0);
        reads = 0;
        expect(registryKeyIsOwned(barcodeRegistryKey('NOPE'))).toBe(false);
        expect(reads).toBeGreaterThanOrEqual(ITEMS());
    });

    it('⛔ key ២០០ (គ្មានម្ចាស់ ១៥០ · មានម្ចាស់ ៥០) ➜ អាន barcodes ≤ ២ ដងនៃការដើរម្តង · ដោះតែ ១៥០ · មានម្ចាស់មិនដាក់ជួរវិញ', async () => {
        const free = Array.from({ length: 150 }, (_, i) => barcodeRegistryKey('Z' + i));
        const owned = Array.from({ length: 50 }, (_, i) => barcodeRegistryKey('T' + (i * 7) + 'b'));
        [...free, ...owned].forEach((k) => pendingRegistryReleases.set(k, { attempts: 0 }));
        const pass = onePassReads();
        flushPendingRegistryReleases();
        expect(reads).toBeLessThanOrEqual(2 * pass);
        await Promise.resolve();
        expect(updates.length).toBe(1);
        expect(Object.keys(updates[0]).sort()).toEqual([...free].sort());
        expect(Object.values(updates[0]).every((v) => v === null)).toBe(true);
        expect(pendingRegistryReleases.size).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ ទិដ្ឋភាពធុងសំរាមមិនស្រស់ ➜ ពន្យារ (គ្មាន update · key នៅក្នុងជួរ)', () => {
        dbListenerPendingPaths.add(DB_LISTENER_KEY_DELETED);
        ['Z1', 'Z2'].forEach((c) => pendingRegistryReleases.set(barcodeRegistryKey(c), { attempts: 1 }));
        flushPendingRegistryReleases();
        expect(updates).toEqual([]);
        expect([...pendingRegistryReleases.keys()].sort()).toEqual(['Z1', 'Z2']);
        expect(pendingRegistryReleases.get('Z1')).toEqual({ attempts: 1 });
    });

    it('ទិសផ្ទុយ ៖ key ដែលធាតុថ្មីចូលកាន់កាប់បន្ទាប់ពី flush មុន ➜ មានម្ចាស់ក្នុង flush បន្ទាប់ (សំណុំគណនាថ្មីរាល់ flush)', async () => {
        const k = barcodeRegistryKey('LATE1');
        pendingRegistryReleases.set(k, { attempts: 0 });
        dataState.scanHistory = dataState.scanHistory.concat([{ id: 'late', barcodes: [{ code: 'late1' }] }]);
        flushPendingRegistryReleases();
        await Promise.resolve();
        expect(updates).toEqual([]);
        expect(pendingRegistryReleases.size).toBe(0);
    });
});
