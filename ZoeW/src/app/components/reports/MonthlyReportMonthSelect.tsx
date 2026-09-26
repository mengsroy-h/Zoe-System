import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { act } from '../../actions';

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
