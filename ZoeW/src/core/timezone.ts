import { activeElementIsInModal, activeElementIsTextField, focusFieldAsIs } from '../app/refs';
import { securityState, uiState } from './state';
import { getServerNow } from './clock';

export const APP_TIME_ZONE = 'Asia/Phnom_Penh';

export const APP_TIME_ZONE_OFFSET_MINUTES = 420;

export function appZoneParts(ms) {
    const at = typeof ms === 'number' ? ms : Number(ms);
    try {
        const parts: any = {};
        const memo: any = appZoneParts;
        if (!memo.zoneFormat || memo.zoneFormat.ctor !== Intl.DateTimeFormat) {
            memo.zoneFormat = {
                ctor: Intl.DateTimeFormat,
                fmt: new Intl.DateTimeFormat('en-GB', {
                    timeZone: APP_TIME_ZONE, hour12: false,
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                })
            };
        }
        memo.zoneFormat.fmt.formatToParts(at).forEach((p) => { if (p.type !== 'literal') parts[p.type] = p.value; });
        if (parts.year && parts.month && parts.day) {
            if (parts.hour === '24') parts.hour = '00';
            return parts;
        }
    } catch (e) {}
    const shifted = new Date(at + APP_TIME_ZONE_OFFSET_MINUTES * 60000);
    return {
        year: String(shifted.getUTCFullYear()),
        month: String(shifted.getUTCMonth() + 1).padStart(2, '0'),
        day: String(shifted.getUTCDate()).padStart(2, '0'),
        hour: String(shifted.getUTCHours()).padStart(2, '0'),
        minute: String(shifted.getUTCMinutes()).padStart(2, '0'),
        second: String(shifted.getUTCSeconds()).padStart(2, '0')
    };
}

export function getZoneDateKey(ms, dayOffset) {
    const parts = appZoneParts(ms);
    const base = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
    const shifted = new Date(base + (dayOffset || 0) * 86400000);
    return shifted.getUTCFullYear() + '-'
        + String(shifted.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(shifted.getUTCDate()).padStart(2, '0');
}

export function getFormattedClockTime(ms) {
    const parts = appZoneParts(ms);
    return parts.hour + ':' + parts.minute + ':' + parts.second;
}

export function formatScanStamp(raw) {
    const text = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!text) return '';
    const parts = text.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*\((\d{4}-\d{2}-\d{2})\)$/);
    if (!parts) return text;
    return parts[2] + ' ' + parts[1];
}

export function getFormattedDate(d = new Date(getServerNow())) {
    return getZoneDateKey(d instanceof Date ? d.getTime() : Number(d), 0);
}

export function appZoneWallClockToMillis(year, month, day, hour, minute, second) {
    const probe = Date.UTC(year, month - 1, day, hour, minute, second);
    if (!isFinite(probe)) return 0;
    const parts = appZoneParts(probe);
    const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour), Number(parts.minute), Number(parts.second));
    if (!isFinite(shown)) return 0;
    return probe - (shown - probe);
}

export function ztoScanStampMillis(raw) {
    const text = String(raw === undefined || raw === null ? '' : raw).trim();
    const parts = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!parts) return 0;
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    const hour = Number(parts[4]);
    const minute = Number(parts[5]);
    const second = Number(parts[6] || 0);
    if (month < 1 || month > 12 || day < 1 || day > 31) return 0;
    if (hour > 23 || minute > 59 || second > 59) return 0;
    const ms = appZoneWallClockToMillis(year, month, day, hour, minute, second);
    return isFinite(ms) && ms > 0 ? ms : 0;
}

export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function safeFocusScanner() {
    if (securityState.appIsLocked) return;
    if (!uiState.isModalOpen && !isMobileDevice()) {
        if (activeElementIsTextField() && !activeElementIsInModal()) {
            return;
        }
        focusFieldAsIs('hwScannerInput');
    }
}
