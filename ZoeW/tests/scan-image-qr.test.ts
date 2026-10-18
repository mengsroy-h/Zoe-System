/**
 * ⛔ «📁 យក Barcode ពីរូបភាព» ក្នុង tab ស្កេនអាន QR ផង (សំណើម្ចាស់គម្រោង) ៖ រូបដែល Code128 ខូច តែ QR លេខកញ្ចប់នៅ ➜ ស្កេនបាន ·
 * រូបដែលមានតែ QR ផ្សព្វផ្សាយ ➜ «រកមិនឃើញ» (មិនដែលចូលជាកញ្ចប់)។
 */
import { beforeEach, expect, it, vi } from 'vitest';
import { scanState, uiState } from '../src/core/state';
import { decodeBarcodeFromImageDataUrl } from '../src/domain/registry';
import { triggerScanAction } from '../src/features/scan-action';
import { readCanvasSymbols } from '../src/services/scan-engine';

vi.mock('../src/features/scan-action', async (orig) => ({ ...(await orig<object>()), triggerScanAction: vi.fn() }));
vi.mock('../src/services/scan-engine', async (orig) => ({ ...(await orig<object>()), readCanvasSymbols: vi.fn() }));
vi.mock('../src/platform/document-io', async (orig) => ({
    ...(await orig<object>()),
    createScratchCanvas: () => ({ width: 0, height: 0, getContext: () => ({ setTransform() {}, clearRect() {}, translate() {}, rotate() {}, drawImage() {} }) }),
    loadScratchImage: (_url: string, done: (img: unknown) => void) => done({ naturalWidth: 1200, naturalHeight: 1600 })
}));

beforeEach(() => {
    vi.mocked(triggerScanAction).mockClear();
    uiState.toasts = [];
    scanState.codeReader = { formats: ['Code128'] };
});

it('QR លេខកញ្ចប់ក្នុងរូប (Code128 ខូច) ➜ triggerScanAction ជាមួយលេខនោះ · reader រូបអាន QR', async () => {
    vi.mocked(readCanvasSymbols).mockResolvedValue([{ format: 'QRCode', text: 'https://earn.example/app' }, { format: 'QRCode', text: '77130500000012' }] as any);
    decodeBarcodeFromImageDataUrl('data:image/png;base64,x');
    await vi.waitFor(() => expect(triggerScanAction).toHaveBeenCalledWith('77130500000012'));
    expect((vi.mocked(readCanvasSymbols).mock.calls[0][0] as any).formats).toEqual(['Code128', 'QRCode']);
});
it('⛔ រូបមានតែ QR ផ្សព្វផ្សាយ ➜ គ្មានការស្កេន · ប្រាប់ «រកមិនឃើញ»', async () => {
    vi.mocked(readCanvasSymbols).mockResolvedValue([{ format: 'QRCode', text: 'https://earn.example/app' }] as any);
    decodeBarcodeFromImageDataUrl('data:image/png;base64,x');
    await vi.waitFor(() => expect(uiState.toasts.length).toBeGreaterThan(0));
    expect(triggerScanAction).not.toHaveBeenCalled();
    expect(String(uiState.toasts[0].msg)).toContain('រកមិនឃើញ');
});
