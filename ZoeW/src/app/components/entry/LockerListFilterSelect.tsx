import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { renderLockerList } from '../../../ui/entry-list';

export function LockerListFilterSelect() {
    useStore(uiState);
    const options = (uiState.lockerFilterOptions || []) as string[];
    return (
        <select id="lockerListFilter"
            value={uiState.lockerFilterValue || ''}
            onChange={(e) => { uiState.lockerFilterValue = e.target.value; renderLockerList(); }}>
            <option value="">ទីតាំងទាំងអស់</option>
            {options.map((l) => <option value={l} key={l}>{l}</option>)}
        </select>
    );
}
