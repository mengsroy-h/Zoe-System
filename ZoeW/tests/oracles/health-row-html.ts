/**
 * ⛔ **oracle របស់តេស្ត parity តែប៉ុណ្ណោះ** — builder HTML ដើមនៃជួរ 🩺 ពិនិត្យសុខភាព។ App គូរជួរដោយ
 *    `HealthCheckList` (JSX) ពី `healthRow()` ➜ function នេះ **មិនចូលផលិតកម្ម** ទៀតទេ។
 */
import { HEALTH_ICONS } from '../../src/features/health-check';
import { sanitizeInput } from '../../src/domain/barcode';

export function healthRowHtml(state, label, detail) {
    const icon = HEALTH_ICONS[state] || HEALTH_ICONS.info;
    const cls = 'health-row health-' + (HEALTH_ICONS[state] ? state : 'info');
    return '<div class="' + cls + '"><span class="health-ico">' + sanitizeInput(icon) + '</span>'
        + '<span class="health-text"><b>' + sanitizeInput(label) + '</b>'
        + '<span class="health-detail">' + sanitizeInput(detail) + '</span></span></div>';
}
