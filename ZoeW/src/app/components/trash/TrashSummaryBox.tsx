import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { onAct } from '../../actions';
import type { TrashBucket, TrashSummaryModel } from './model';

function SummaryCard({ cls, bucketKey, active, head, note, bucket }: { cls: string; bucketKey: string; active: boolean; head: string; note: string; bucket: TrashBucket }) {
    return (
        <button type="button" className={`trash-sum-card ${cls}${active ? ' trash-sum-active' : ''}`} aria-pressed={active}
            title={active ? 'ចុចម្តងទៀត ដើម្បីបង្ហាញទាំងអស់' : 'ចុច ដើម្បីបង្ហាញតែប្រភេទនេះ'}
            onClick={onAct('toggleTrashReasonFilter', { args: [bucketKey] })}>
            <div className="trash-sum-head">{head}</div>
            <div className="trash-sum-note">{note}</div>
            <div className="trash-sum-money">${bucket.total.toFixed(2)}</div>
            <div className="trash-sum-riel">{bucket.riel.toLocaleString()} ៛</div>
            <div className="trash-sum-count">📦 {bucket.count} កញ្ចប់</div>
        </button>
    );
}

export function TrashSummaryBox() {
    useStore(uiState);
    const s = uiState.trashSummary as TrashSummaryModel | null;
    if (!s) return null;
    return (
        <>
            <div className="trash-sum-grid">
                <SummaryCard cls="trash-sum-deducted" bucketKey="deducted" active={s.filter === 'deducted'} head="➖ ដក + ត្រឡប់" note="ដកចេញពីស្ថិតិរួចហើយ" bucket={s.deducted} />
                <SummaryCard cls="trash-sum-kept" bucketKey="kept" active={s.filter === 'kept'} head="✅ យករួច + លុប" note="មិនប៉ះស្ថិតិចំណូល" bucket={s.kept} />
            </div>
            <div className="trash-sum-total">
                <span>{s.scopeNote}</span>
                <strong>សរុប ${s.grandTotal.toFixed(2)} · 📦 {s.grandCount} កញ្ចប់ · {s.groupCount} ជួរ</strong>
            </div>
        </>
    );
}
