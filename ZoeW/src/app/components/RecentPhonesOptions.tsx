import { dataState } from '../../core/state';
import { useStore } from '../hooks/useStore';

export function RecentPhonesOptions() {
    useStore(dataState);
    const phones = (dataState.recentPhonesOptions || []) as string[];
    return <>{phones.map((phone) => <option value={phone} key={phone} />)}</>;
}
