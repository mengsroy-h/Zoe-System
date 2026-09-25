import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { act } from '../../actions';

/**
 * ជម្រើសខែរបស់របាយការណ៍។
 * ⛔ តម្លៃរស់ក្នុង `uiState.monthlyReportMonth` (ឃ្លាំង) មិនមែនក្នុង DOM ➜
 *    `renderMonthlyReport()` លែងត្រូវអាន `select.value` ។
 * ⛔ ការហៅឆ្លងកាត់ `act()` (ព្រំដែន `ACTION_REGISTRY`) ដូច `data-act="renderMonthlyReport"`
 *    ដើម ➜ ធាតុក្នុងបញ្ជីអនុញ្ញាតមានអ្នកប្រើពិត (`wiring` ៖ សិទ្ធិតូចបំផុត ២ ទិស)។
 */
export function MonthlyReportMonthSelect() {
    useStore(uiState);
    const months = (uiState.monthlyReportMonths || []) as string[];
    return (
        <select id="monthlyReportMonthSel" aria-label="ជ្រើសរើសខែ"
            value={uiState.monthlyReportMonth || ''}
            onChange={(e) => { uiState.monthlyReportMonth = e.target.value; act('renderMonthlyReport'); }}>
            {months.map((m) => <option value={m} key={m}>{m}</option>)}
        </select>
    );
}
