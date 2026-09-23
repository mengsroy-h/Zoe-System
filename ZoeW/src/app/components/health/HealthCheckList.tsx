import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import type { HealthRow } from './model';

/** 🩺 ពិនិត្យសុខភាពប្រព័ន្ធ — ⛔ អានសុទ្ធសាធ · មិនបង្ខំ PIN · secret មិនឡើង DOM។ */
export function HealthCheckList() {
    useStore(uiState);
    const rows = uiState.healthRows as HealthRow[] | null;
    if (!rows) return null;
    return (
        <>
            {rows.map((r, i) => (
                <div className={r.cls} key={r.label + i}>
                    <span className="health-ico">{r.icon}</span>
                    <span className="health-text">
                        <b>{r.label}</b>
                        {r.detail === null ? null : <span className="health-detail">{r.detail}</span>}
                    </span>
                </div>
            ))}
        </>
    );
}
