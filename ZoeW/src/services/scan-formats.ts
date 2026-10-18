export const SCAN_FORMAT_NAMES = ['Code128'];

export const SCAN_QR_FORMAT_NAMES = ['Code128', 'QRCode'];

export const NATIVE_SCAN_QR_FORMAT_NAMES = ['code_128', 'qr_code'];

export const SCAN_QR_MAX_SYMBOLS = 4;

export const ZTO_BARCODE_RE = /^[A-Za-z0-9_-]{6,64}$/;

export function ztoBarcodeShapeIsValid(barcode) {
    return ZTO_BARCODE_RE.test(String(barcode == null ? '' : barcode).trim());
}

export function buildReaderOptions(tryHarder, formats?) {
    return {
        formats: formats || SCAN_FORMAT_NAMES,
        tryHarder: !!tryHarder,
        tryRotate: !!tryHarder,
        tryInvert: !!tryHarder,
        tryDownscale: !!tryHarder,
        maxNumberOfSymbols: 1
    };
}

export function scanQrReader(deep) {
    return { ...buildReaderOptions(deep, SCAN_QR_FORMAT_NAMES), maxNumberOfSymbols: SCAN_QR_MAX_SYMBOLS };
}

export function nativeScanResults(found) {
    return (Array.isArray(found) ? found : []).map((r) => ({ format: r && r.format === 'qr_code' ? 'QRCode' : 'Code128', text: r && r.rawValue }));
}

export function pickScanCode(results) {
    const valid = (Array.isArray(results) ? results : []).filter((r) => r && r.isValid !== false && String(r.text || '').trim());
    const linear = valid.find((r) => r.format !== 'QRCode');
    if (linear) return String(linear.text).trim();
    const qr = valid.find((r) => ztoBarcodeShapeIsValid(r.text));
    return qr ? String(qr.text).trim() : '';
}
