import { uiState } from '../../core/state';
import { onAct } from '../actions';
import { useStoreValue } from '../hooks/useStore';

export function DrawerBackdrop() {
    const open = useStoreValue(uiState, (s) => s.drawerOpen);
    return (
        <div className={open ? 'drawer-backdrop open' : 'drawer-backdrop'} id="drawerBackdrop" onClick={onAct("closeSideDrawer")}></div>
    );
}
