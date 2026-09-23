import { scanState, securityState, uiState } from '../../core/state';
import { isMobileDevice } from '../../core/timezone';
import { closeConfigQrScanner } from '../../features/config-qr';
import { showCameraClosedBox, stopCurrentStream, submitManualBarcode } from '../../features/daily-stats';
import { elementOf } from '../refs';

/**
 * ម៉ាស៊ីនស្កេន hardware (Bluetooth/USB = ក្តារចុច) ៖ ចុចកន្លែងទំនេរលើ desktop ➜
 * focus ប្រអប់ស្កេន · Enter ➜ បញ្ជូន។ ⛔ វាស្តាប់ព្រឹត្តិការណ៍ **ទូទាំង document**
 * ➜ រស់នៅស្រទាប់ React (`src/app`) ហើយប៉ះប្រអប់តាម ref។
 */
export function setupHardwareScanner() {
    const hwInput = elementOf('hwScannerInput');

    document.addEventListener('click', (e) => {
        const clickTarget = e.target as any;
        if (!uiState.isModalOpen && clickTarget.tagName !== 'INPUT' && clickTarget.tagName !== 'TEXTAREA' && clickTarget.tagName !== 'SELECT' && clickTarget.tagName !== 'BUTTON' && clickTarget.tagName !== 'A' && !isMobileDevice()) {
            if (hwInput) hwInput.focus();
        }
    });

    if (hwInput) {
        hwInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitManualBarcode();
            }
        });
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
