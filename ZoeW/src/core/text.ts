
export const DB_LISTENER_KEYS = ['exchangeRate', 'dailyRevenue', 'monthlyRevenue', 'dailyPickup', 'dailyCollected', 'history', 'deleted'];

export const DB_LISTENER_KEY_DELETED = 'deleted';

export const DB_LISTENER_KEY_HISTORY = 'history';

export const DB_LISTENER_KEY_DAILY_REVENUE = 'dailyRevenue';

export const DB_LISTENER_KEY_MONTHLY_REVENUE = 'monthlyRevenue';

export const DB_LISTENER_KEY_DAILY_COLLECTED = 'dailyCollected';

export const VIEW_NOT_MEASURABLE_TEXT = 'ទិន្នន័យមិនទាន់មកដល់គ្រប់ ➜ វាស់មិនបាន';

export const VIEW_NOT_MEASURABLE_NOTICE = '⏳ ' + VIEW_NOT_MEASURABLE_TEXT;

export const ZTO_SIGNED_REOPEN_TEXT = '🔒 កញ្ចប់នេះ Sign ក្នុង ZTO រួច — មិនអាចបើកវិញក្នុង ZoeW បានទេ។';

export const ZTO_RESTORE_FINAL_TEXT = '🔒 កញ្ចប់នេះមិនអាចស្តារបានតាមគោលការណ៍ ZTO និងធុងសំរាម។';

export const RESTORE_IN_PROGRESS_CLOSE_TEXT = '⏳ កញ្ចប់នេះកំពុងស្តារពីធុងសំរាម — សូមបញ្ចប់ការស្តារ (🔄 ក្នុង 🗑️) មុនបិទ ឬបើក។';

export const TRASH_FINAL_CONFIRM_NOTE = '\n⚠️ ZTO Login ឬកញ្ចប់ Sign រួចក្នុង ZTO ៖ ចូលធុងសំរាមហើយមិនអាចស្តារបានទេ។';

export const STATS_DAILY_VIEW_KEYS = [DB_LISTENER_KEY_DAILY_REVENUE, DB_LISTENER_KEY_HISTORY, DB_LISTENER_KEY_DELETED];

export const STATS_COLLECTED_VIEW_KEYS = [DB_LISTENER_KEY_DAILY_COLLECTED];

export const ZTO_SYNC_VIEW_KEYS = [DB_LISTENER_KEY_HISTORY, DB_LISTENER_KEY_DELETED];

export const dbListenerPendingPaths = new Set();

export const dbListenerFailedPaths = new Set();

export function latinDigits(text: string): string {
    return String(text).replace(/[\u17E0-\u17E9]/g, (d) => String(d.charCodeAt(0) - 0x17E0));
}

export function sanitizePhoneNumber(phoneStr) {
    if (!phoneStr) return '';
    let trimmed = String(phoneStr).trim();
    trimmed = trimmed.replace(/^(\+?855-?)/, '0');
    return trimmed;
}

export function normalizeStoredPhone(phoneStr) {
    if (!phoneStr) return '';
    return String(phoneStr).split(/[\/,]/).map(normalizeOneStoredPhone).filter(Boolean).join('/');
}

export function normalizeOneStoredPhone(part) {
    let trimmed = String(part).trim();
    trimmed = trimmed.replace(/^[='"\s-]+/, '').replace(/["'\s]+$/, '');
    if (/^\+?855/.test(trimmed)) {
        trimmed = trimmed.replace(/^\+?855[\s-]*/, '');
    }
    if (/^\d/.test(trimmed) && trimmed.charAt(0) !== '0') {
        trimmed = '0' + trimmed;
    }
    return trimmed;
}

export const ZTO_MISMATCH_TEXTS_MAX = 5;

export const ZTO_MISMATCH_TEXT_LEN = 64;

export function ztoMismatchTexts(value: unknown, into: string[] = []): string[] {
    if (!Array.isArray(value)) return into;
    for (let i = 0; i < value.length && into.length < ZTO_MISMATCH_TEXTS_MAX; i++) {
        const item = value[i];
        if (typeof item !== 'string' || !item) continue;
        const text = item.slice(0, ZTO_MISMATCH_TEXT_LEN);
        if (into.indexOf(text) === -1) into.push(text);
    }
    return into;
}

export function ztoExpectedTexts(value: unknown): string[] {
    return ztoMismatchTexts(typeof value === 'string' ? [value] : value);
}

export function ztoTextWithCodePoints(text: string): string {
    const points = Array.from(String(text)).map((ch) => (ch.codePointAt(0) || 0).toString(16).toUpperCase().padStart(4, '0'));
    return '«' + text + '» (U+' + points.join(' ') + ')';
}
