import { uiState } from '../../core/state';
import { useStoreFields } from '../hooks/useStore';
import { refTo } from '../refs';
import { MoreMenuContent } from './menu/MoreMenuContent';

/**
 * ម៉ឺនុយ (...) សកល — បើក/បិទ · មាតិកា · ទីតាំង (`positionMenuSafely()`)
 * គូរពី state។
 */
export function GlobalMoreMenu() {
    const v = useStoreFields(uiState, ['moreMenuOpen', 'moreMenuPosition']);
    const pos = v.moreMenuPosition;
    return (
        <div
            id="globalMoreMenu"
            className={v.moreMenuOpen ? 'more-menu show' : 'more-menu'}
            ref={refTo('globalMoreMenu')}
            style={pos ? { top: pos.top + 'px', left: pos.left + 'px' } : undefined}
        >
            <div id="menuContentContainer">
                <MoreMenuContent />
            </div>
        </div>
    );
}
