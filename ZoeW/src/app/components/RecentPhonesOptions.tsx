import { dataState } from '../../core/state';
import { useStore } from '../hooks/useStore';

/** ជម្រើស autocomplete នៃលេខទូរស័ព្ទថ្មីៗ (`<datalist>`)។ */
export function RecentPhonesOptions() {
    useStore(dataState);
    const phones = (dataState.recentPhonesOptions || []) as string[];
    return <>{phones.map((phone) => <option value={phone} key={phone} />)}</>;
}
