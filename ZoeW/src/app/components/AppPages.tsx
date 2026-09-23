import { uiState } from '../../core/state';
import { useStoreFields } from '../hooks/useStore';
import { refTo } from '../refs';
import { PageData } from './PageData';
import { PageEntry } from './PageEntry';

/**
 * កន្សោមរមូរខាងក្រៅតែមួយ (`#appPages`) — ⛔ PTR និង scroll-snap ពឹងលើវា។
 * `history-expanded` · `panel-gliding` ជា state (តំបន់ហាមចូល ៖ `CLAUDE.md` ច្បាប់ ១១)។
 */
export function AppPages() {
    const v = useStoreFields(uiState, ['historyExpanded', 'panelGliding']);
    let cls = 'app-pages';
    if (v.historyExpanded) cls += ' history-expanded';
    if (v.panelGliding) cls += ' panel-gliding';
    return (
        <div className={cls} id="appPages" ref={refTo('appPages')}>
            <PageData />
            <PageEntry />
        </div>
    );
}
