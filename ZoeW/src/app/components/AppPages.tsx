import { uiState } from '../../core/state';
import { useStoreFields } from '../hooks/useStore';
import { refTo } from '../refs';
import { PageData } from './PageData';
import { PageEntry } from './PageEntry';

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
