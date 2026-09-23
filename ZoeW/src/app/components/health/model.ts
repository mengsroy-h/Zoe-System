import { HEALTH_ICONS } from '../../../features/health-check';

export interface HealthRow { state: string; icon: string; cls: string; label: string; detail: string | null }

/**
 * ជួរពិនិត្យសុខភាពមួយ — **model** មិនមែន HTML។
 * ⛔ សាលក្រមនៅដដែល ៖ `ok` · `warn` · `bad` · `info`; ស្ថានភាពមិនស្គាល់
 *    ធ្លាក់ទៅ `info` ដូចដើម («ពិនិត្យមិនបាន» មិនមែន «ខុស»)។
 */
export function healthRow(state: string, label: string, detail: string): HealthRow {
    const known = !!HEALTH_ICONS[state];
    return {
        state,
        icon: HEALTH_ICONS[state] || HEALTH_ICONS.info,
        cls: 'health-row health-' + (known ? state : 'info'),
        label,
        detail
    };
}

/**
 * ជួរ «កំពុងពិនិត្យ…» ខណៈការវាស់កំពុងដំណើរការ។
 * ⛔ វាខុសពីជួរធម្មតា **ដោយចេតនា** (ដូចដើមបេះបិទ) ៖ រូប `⏳` មិនមែន `ℹ️`
 *    ហើយ **គ្មាន** `.health-detail` — វាមិនមែនជាសាលក្រមទេ។
 */
export function healthPendingRow(): HealthRow {
    return { state: 'info', icon: '⏳', cls: 'health-row health-info', label: 'កំពុងពិនិត្យ…', detail: null };
}
