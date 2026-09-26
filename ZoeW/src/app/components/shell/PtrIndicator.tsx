import { ptrState } from '../../../core/state';
import { pullToRefreshSupported } from '../../../platform/native';
import { useStoreValue } from '../../hooks/useStore';
import { refTo } from '../../refs';

export function PtrIndicator() {
    const view = useStoreValue(ptrState, (s) => s.view);
    if (!pullToRefreshSupported()) return null;
    let cls = 'ptr-indicator';
    if (view && view.ready) cls += ' ready';
    if (view && view.snapping) cls += ' snapping';
    if (view && view.spinning) cls += ' spinning';
    const style = view ? { transform: view.transform || undefined, opacity: view.opacity === '' ? undefined : view.opacity } : undefined;
    return (
        <div className={cls} aria-hidden="true" ref={refTo('ptrIndicator')} style={style}>
            <div className="ptr-spinner"></div>
        </div>
    );
}
