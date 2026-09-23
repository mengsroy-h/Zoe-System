import { scanState, securityState, uiState } from '../../core/state';
import { isMobileDevice } from '../../core/timezone';
import { closeConfigQrScanner } from '../../features/config-qr';
import { showCameraClosedBox, stopCurrentStream, submitManualBarcode } from '../../features/daily-stats';
import { focusFieldAsIs } from '../refs';

/**
 * ម៉ាស៊ីនស្កេន hardware (Bluetooth/USB = ក្តារចុច) ៖ ចុចកន្លែងទំនេរលើ desktop ➜
 * focus ប្រអប់ស្កេន (listener **ទូទាំង document** ➜ ចាក់ពេល boot) · Enter ➜ បញ្ជូន
 * (`onKeyPress` របស់ JSX ក្នុង `PageEntry`)។
 */
export function setupHardwareScanner() {
    document.addEventListener('click', (e) => {
        const clickTarget = e.target as any;
        if (!uiState.isModalOpen && clickTarget.tagName !== 'INPUT' && clickTarget.tagName !== 'TEXTAREA' && clickTarget.tagName !== 'SELECT' && clickTarget.tagName !== 'BUTTON' && clickTarget.tagName !== 'A' && !isMobileDevice()) {
            focusFieldAsIs('hwScannerInput');
        }
    });
}

/** `onKeyPress` របស់ `#hwScannerInput` ៖ Enter ➜ បញ្ជូន Barcode */
export function hardwareScannerKeyPress(e: { key: string; preventDefault(): void }) {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitManualBarcode();
    }
}

/** ចាកចេញពី App (tab លាក់) ➜ បិទកាមេរ៉ា និងម៉ាស៊ីនស្កេន QR */
export function setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && securityState.configQrScanActive) closeConfigQrScanner();
        if (document.hidden && scanState.isCameraScanning) {
            stopCurrentStream();
            showCameraClosedBox();
        }
    });
}
