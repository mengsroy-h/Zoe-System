import { scrollThumbState } from '../../../core/state';
import { useStoreValue } from '../../hooks/useStore';

export function ScrollThumb() {
    const view = useStoreValue(scrollThumbState, (s) => s.view);
    if (!view) return null;
    return (
        <div
            className={view.shown ? 'scroll-thumb shown' : 'scroll-thumb'}
            aria-hidden="true"
            style={{ transform: 'translate3d(' + view.x + 'px, ' + view.y + 'px, 0)', height: view.h + 'px' }}
        />
    );
}
