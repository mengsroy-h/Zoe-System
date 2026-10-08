/**
 * ⛔ SENTRY-2 ៖ ម៉ាស៊ីនស្កេន ZXing (WASM) ផ្ទុកមិនបានម្តង មិនត្រូវធ្វើឲ្យការស្កេនស្លាប់ស្ងាត់រហូតដល់ Refresh។
 *
 * `zxing-wasm` ចងចាំ promise របស់ module (`WeakMap`) ➜ `prepareZXingModule()` reject ម្តង (WASM ទាញមិនបាន · អស់ memory ពេល compile)
 *    ➜ រាល់ `readBarcodes()` បន្ទាប់ reject ជានិច្ច ➜ `decodeBarcodeFromCanvasManual()` ត្រឡប់ `''` ➜ កាមេរ៉ា · រូបភាព · QR Config
 *    «រកមិនឃើញ» ជារៀងរហូត ខណៈ promise ដែល reject គ្មានអ្នកចាប់ (unhandled rejection)។
 * ⛔ ក្រោយ `purgeZXingModule()` ការហៅ `readBarcodes()` ដំបូងប្រើ `locateFile` លំនាំដើមរបស់បណ្ណាល័យ (CDN) ➜ App ត្រូវ prepare ឡើងវិញ
 *    ជាមួយ `./vendor/` មុន decode (decode ខណៈម៉ាស៊ីនធ្លាក់ ➜ `''` ដោយមិនហៅ `readBarcodes()`)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scanState, uiState } from '../src/core/state';
import * as engine from '../src/services/scan-engine';

const STEPS: number[] = (engine as any).SCAN_ENGINE_RETRY_STEPS_MS || [3000, 10000, 30000, 60000];
const TOAST_AFTER: number = (engine as any).SCAN_ENGINE_FAIL_TOAST_AFTER || 3;

let rejections: unknown[] = [];
const onRejection = (r: unknown) => { rejections.push(r); };

function installZXing(failTimes: number, mode: 'reject' | 'throw' = 'reject') {
    let fails = failTimes;
    const zx = {
        prepareZXingModule: vi.fn((_opts: any) => {
            if (fails > 0) {
                fails--;
                if (mode === 'throw') throw new Error('WebAssembly.Memory(): could not allocate memory');
                return Promise.reject(new Error('WebAssembly.instantiate(): fetch failed'));
            }
            return Promise.resolve({});
        }),
        purgeZXingModule: vi.fn(),
        readBarcodes: vi.fn(() => Promise.resolve([{ text: 'ZT123456', isValid: true }])),
    };
    (globalThis as any).ZXingWASM = zx;
    return zx;
}

const canvas: any = {
    width: 4,
    height: 4,
    getContext: () => ({ getImageData: () => ({ data: new Uint8ClampedArray(64), width: 4, height: 4 }) }),
};

async function flush() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
}

const seenToasts = new Map<number, string>();
const noteToasts = () => uiState.toasts.forEach((t: any) => seenToasts.set(t.id, String(t.msg)));

async function advance(ms: number) {
    noteToasts();
    vi.advanceTimersByTime(ms);
    await flush();
    noteToasts();
}

const engineToasts = () => { noteToasts(); return [...seenToasts.values()].filter((m) => /ស្កេន/.test(m)); };

beforeEach(() => {
    vi.useFakeTimers();
    rejections = [];
    seenToasts.clear();
    process.on('unhandledRejection', onRejection);
    uiState.toasts = [];
    (window as any).ZoeErrors = { capture: vi.fn() };
    const s: any = scanState;
    for (const k of ['scanEngineDown', 'scanEngineFailures', 'scanEngineFailureReported']) if (k in s) s[k] = k === 'scanEngineFailures' ? 0 : false;
    if (s.scanEngineRetryTimer) { clearTimeout(s.scanEngineRetryTimer); s.scanEngineRetryTimer = null; }
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    process.off('unhandledRejection', onRejection);
    delete (globalThis as any).ZXingWASM;
    uiState.toasts = [];
});

describe('SENTRY-2 ៖ ម៉ាស៊ីនស្កេន WASM ផ្ទុកមិនបាន ➜ ស្តារខ្លួនឯង', () => {
    it('ធ្លាក់ ២ ដង ➜ purge · decode មិនហៅ readBarcodes ខណៈធ្លាក់ · prepare ឡើងវិញជាមួយ ./vendor/ · ជោគជ័យ ➜ ស្កេនបានវិញ · Sentry ១ · គ្មាន toast', async () => {
        const zx = installZXing(2);
        engine.initScanEngine();
        await flush();
        expect(zx.purgeZXingModule).toHaveBeenCalledTimes(1);
        expect(await engine.decodeBarcodeFromCanvasManual(scanState.liveScanCodeReader, canvas)).toBe('');
        expect(zx.readBarcodes).not.toHaveBeenCalled();

        await advance(STEPS[0]);
        expect(zx.prepareZXingModule).toHaveBeenCalledTimes(2);
        expect(zx.purgeZXingModule).toHaveBeenCalledTimes(2);

        await advance(STEPS[1]);
        expect(zx.prepareZXingModule).toHaveBeenCalledTimes(3);
        expect(await engine.decodeBarcodeFromCanvasManual(scanState.liveScanCodeReader, canvas)).toBe('ZT123456');
        expect(zx.readBarcodes).toHaveBeenCalledTimes(1);

        for (const [opts] of zx.prepareZXingModule.mock.calls) {
            expect(opts.fireImmediately).toBe(true);
            expect(opts.overrides.locateFile('zxing_reader.wasm', 'https://cdn.example/')).toBe('./vendor/zxing_reader.wasm');
        }
        expect((window as any).ZoeErrors.capture).toHaveBeenCalledTimes(1);
        expect(engineToasts()).toEqual([]);
        await advance(STEPS[STEPS.length - 1] * 3);
        expect(zx.prepareZXingModule).toHaveBeenCalledTimes(3);
        expect(rejections).toEqual([]);
    });

    it('ធ្លាក់ជាប់ ➜ toast ម្តងពេលដល់ព្រំដែន · ព្យាយាមបន្តតាមជំហានចុងក្រោយ · Sentry ១', async () => {
        const zx = installZXing(1000);
        engine.initScanEngine();
        await flush();
        let elapsed = 0;
        for (let i = 0; i < STEPS.length + 4; i++) { const step = STEPS[Math.min(i, STEPS.length - 1)]; elapsed += step; await advance(step); }
        expect(zx.prepareZXingModule.mock.calls.length).toBe(STEPS.length + 5);
        expect(engineToasts().length).toBe(1);
        expect(zx.prepareZXingModule.mock.calls.length).toBeGreaterThan(TOAST_AFTER);
        expect((window as any).ZoeErrors.capture).toHaveBeenCalledTimes(1);
        expect(zx.readBarcodes).not.toHaveBeenCalled();
        expect(rejections).toEqual([]);
        expect(elapsed).toBeGreaterThan(0);
    });

    it('prepareZXingModule បោះភ្លាម (memory) ➜ ស្តារដូចគ្នា', async () => {
        const zx = installZXing(1, 'throw');
        engine.initScanEngine();
        await flush();
        expect(zx.purgeZXingModule).toHaveBeenCalledTimes(1);
        await advance(STEPS[0]);
        expect(zx.prepareZXingModule).toHaveBeenCalledTimes(2);
        expect(await engine.decodeBarcodeFromCanvasManual(scanState.liveScanCodeReader, canvas)).toBe('ZT123456');
    });

    it('ទិសផ្ទុយ ៖ ផ្ទុកបានលើកដំបូង ➜ គ្មាន purge · គ្មាន retry · គ្មាន Sentry · គ្មាន toast · ស្កេនបាន', async () => {
        const zx = installZXing(0);
        engine.initScanEngine();
        await flush();
        await advance(STEPS[STEPS.length - 1] * 2);
        expect(zx.prepareZXingModule).toHaveBeenCalledTimes(1);
        expect(zx.purgeZXingModule).not.toHaveBeenCalled();
        expect((window as any).ZoeErrors.capture).not.toHaveBeenCalled();
        expect(engineToasts()).toEqual([]);
        expect(await engine.decodeBarcodeFromCanvasManual(scanState.liveScanCodeReader, canvas)).toBe('ZT123456');
    });
});
