import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import type { TrashBucket, TrashSummaryModel } from './model';

function SummaryCard({ cls, head, note, bucket }: { cls: string; head: string; note: string; bucket: TrashBucket }) {
    return (
        <div className={`trash-sum-card ${cls}`}>
            <div className="trash-sum-head">{head}</div>
            <div className="trash-sum-note">{note}</div>
            <div className="trash-sum-money">${bucket.total.toFixed(2)}</div>
            <div className="trash-sum-riel">{bucket.riel.toLocaleString()} ៛</div>
            <div className="trash-sum-count">📦 {bucket.count} កញ្ចប់</div>
        </div>
    );
}

/** តួលេខសរុបរបស់ធុងសំរាម — ⛔ ២ ក្រុមដេរីវេពី `TRASH_REASON_META[r].deducted`។ */
export function TrashSummaryBox() {
    useStore(uiState);
    const s = uiState.trashSummary as TrashSummaryModel | null;
    if (!s) return null;
    return (
        <>
            <div className="trash-sum-grid">
                <SummaryCard cls="trash-sum-deducted" head="➖ ដក + ផុតកំណត់" note="ដកចេញពីស្ថិតិរួចហើយ" bucket={s.deducted} />
                <SummaryCard cls="trash-sum-kept" head="✅ យករួច + លុប" note="មិនប៉ះស្ថិតិចំណូល" bucket={s.kept} />
            </div>
            <div className="trash-sum-total">
                <span>{s.scopeNote}</span>
                <strong>សរុប ${s.grandTotal.toFixed(2)} · 📦 {s.grandCount} កញ្ចប់ · {s.groupCount} ជួរ</strong>
            </div>
        </>
    );
}
