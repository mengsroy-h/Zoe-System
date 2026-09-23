import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { renderMonthlyReport } from '../../../features/monthly-report';

/**
 * ជម្រើសខែរបស់របាយការណ៍។
 * ⛔ តម្លៃរស់ក្នុង `uiState.monthlyReportMonth` (ឃ្លាំង) មិនមែនក្នុង DOM ➜
 *    `renderMonthlyReport()` លែងត្រូវអាន `select.value` ។
 */
export function MonthlyReportMonthSelect() {
    useStore(uiState);
    const months = (uiState.monthlyReportMonths || []) as string[];
    return (
        <select id="monthlyReportMonthSel" aria-label="ជ្រើសរើសខែ"
            value={uiState.monthlyReportMonth || ''}
            onChange={(e) => { uiState.monthlyReportMonth = e.target.value; renderMonthlyReport(); }}>
            {months.map((m) => <option value={m} key={m}>{m}</option>)}
        </select>
    );
}
