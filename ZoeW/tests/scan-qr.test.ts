/**
 * ⛔ ស្កេនក្នុង tab ស្កេន (បញ្ចូល · ដក · Locker) ស្គាល់ QR លើបុង (សំណើម្ចាស់គម្រោង ៖ «អោយ ការស្កេន ក្នុង tab ស្កេន … ស្គាល់ QR ដូចគ្នា»)។
 * ទីនេះគ្មានបញ្ជី Barcode រំពឹងទុកដូចផ្ទាំង Sign ➜ QR ទទួលតែពេលអត្ថបទមានរាង Barcode ZTO (`ztoBarcodeShapeIsValid()`) ហើយ Code128 ក្នុងការអានដដែលឈ្នះជានិច្ច ៖
 * QR ផ្សព្វផ្សាយ (URL «SCAN TO EARN») មិនក្លាយជាកញ្ចប់ ឬលុយទេ។ Android ៖ `BarcodeDetector` ឡើងទៅ `code_128` + `qr_code` តែពេលប្រព័ន្ធគាំទ្រ។
 */
import { afterEach, expect, it, vi } from 'vitest';
import { scanState } from '../src/core/state';
import { NATIVE_SCAN_QR_FORMAT_NAMES, nativeScanResults, pickScanCode, scanQrReader } from '../src/services/scan-formats';
import { upgradeNativeDetectorForQr } from '../src/services/scan-engine';

const OWN = '77130500000012';
const PROMO = 'https://earn.example.com/download?ref=zto';

afterEach(() => { vi.unstubAllGlobals(); scanState.nativeDetector = null; });

it('Code128 ក្នុងការអានដដែលឈ្នះ QR ជានិច្ច', () => {
    expect(pickScanCode([{ format: 'QRCode', text: '99990000000001' }, { format: 'Code128', text: OWN }])).toBe(OWN);
});
it('QR រាង Barcode ZTO ទទួល ពេល Code128 អានមិនបាន', () => {
    expect(pickScanCode([{ format: 'QRCode', text: PROMO }, { format: 'QRCode', text: OWN }])).toBe(OWN);
});
it('⛔ QR ផ្សព្វផ្សាយ (URL) តែឯង ➜ គ្មានលេខ (មិនក្លាយជាកញ្ចប់)', () => {
    expect(pickScanCode([{ format: 'QRCode', text: PROMO }])).toBe('');
    expect(pickScanCode([{ format: 'QRCode', text: 'abc' }])).toBe('');
    expect(pickScanCode([{ format: 'Code128', text: OWN, isValid: false }])).toBe('');
    expect(pickScanCode(null)).toBe('');
});
it('QR reader ៖ Code128 + QR · ច្រើននិមិត្ត · ITF មិនចូល', () => {
    const reader = scanQrReader(false);
    expect(reader.formats).toEqual(['Code128', 'QRCode']);
    expect(reader.maxNumberOfSymbols).toBeGreaterThan(1);
    expect(reader.tryHarder).toBe(false);
    expect(scanQrReader(true).tryHarder).toBe(true);
});
it('លទ្ធផល BarcodeDetector ➜ ទម្រង់ដូចគ្នា (qr_code ➜ QRCode · ផ្សេង ➜ Code128)', () => {
    expect(pickScanCode(nativeScanResults([{ format: 'qr_code', rawValue: PROMO }, { format: 'qr_code', rawValue: OWN }]))).toBe(OWN);
    expect(pickScanCode(nativeScanResults([{ rawValue: OWN }]))).toBe(OWN);
    expect(pickScanCode(nativeScanResults([{ format: 'qr_code', rawValue: PROMO }]))).toBe('');
});
it('Android ៖ ប្រព័ន្ធគាំទ្រ qr_code ➜ detector ថ្មី code_128 + qr_code', async () => {
    const built: string[][] = [];
    class FakeDetector {
        static getSupportedFormats = async () => ['code_128', 'qr_code', 'ean_13'];
        formats: string[];
        constructor(opts: { formats: string[] }) { built.push(opts.formats); this.formats = opts.formats; }
        detect = async () => [];
    }
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    scanState.nativeDetector = { formats: ['code_128'] };
    const next = await upgradeNativeDetectorForQr();
    expect(built).toEqual([NATIVE_SCAN_QR_FORMAT_NAMES]);
    expect(scanState.nativeDetector).toBe(next);
});
it('Android ៖ ប្រព័ន្ធមិនគាំទ្រ qr_code ឬ detector ប្តូររួច ➜ មិនប៉ះ detector ដើម', async () => {
    let builds = 0;
    class OldDetector { static getSupportedFormats = async () => ['code_128']; constructor() { builds++; } }
    vi.stubGlobal('BarcodeDetector', OldDetector);
    const base = { formats: ['code_128'] };
    scanState.nativeDetector = base;
    await upgradeNativeDetectorForQr();
    expect(scanState.nativeDetector).toBe(base);
    let release!: (v: string[]) => void;
    class SlowDetector { static getSupportedFormats = () => new Promise<string[]>((yes) => { release = yes; }); constructor() { builds++; } }
    vi.stubGlobal('BarcodeDetector', SlowDetector);
    const pending = upgradeNativeDetectorForQr();
    const other = { formats: ['code_128'] };
    scanState.nativeDetector = other;
    release(['code_128', 'qr_code']);
    await pending;
    expect(scanState.nativeDetector).toBe(other);
    expect(builds).toBe(0);
    scanState.nativeDetector = null;
    expect(await upgradeNativeDetectorForQr()).toBeNull();
});
