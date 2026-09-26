import { HEALTH_ICONS } from '../../../features/health-check';

export interface HealthRow { state: string; icon: string; cls: string; label: string; detail: string | null }

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

export function healthPendingRow(): HealthRow {
    return { state: 'info', icon: '⏳', cls: 'health-row health-info', label: 'កំពុងពិនិត្យ…', detail: null };
}
