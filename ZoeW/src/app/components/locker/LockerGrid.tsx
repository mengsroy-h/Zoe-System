import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { chooseLocker } from '../../../features/locker';

export interface LockerGridView { cells: string[]; active: string }

/** ក្រឡាជ្រើសទីតាំង Locker — ⛔ ចំនួនឆ្លងកាត់ `clampLockerCount()` ជានិច្ច។ */
export function LockerGrid() {
    useStore(uiState);
    const view = uiState.lockerGridView as LockerGridView | null;
    if (!view) return null;
    return (
        <>
            {view.cells.map((val) => (
                <button type="button" key={val}
                    className={'locker-cell' + (val === view.active ? ' current' : '')}
                    onClick={() => chooseLocker(val)}>{val}</button>
            ))}
        </>
    );
}
