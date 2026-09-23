import { onAct } from '../actions';

/** ផ្ទាំងខ្មៅពីក្រោយរបា Slide */
export function DrawerBackdrop() {
    return (
        <div className="drawer-backdrop" id="drawerBackdrop" onClick={onAct("closeSideDrawer")}></div>
    );
}
