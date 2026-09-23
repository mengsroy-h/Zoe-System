import { ptrState } from '../../../core/state';
import { pullToRefreshSupported } from '../../../platform/native';
import { useStoreValue } from '../../hooks/useStore';
import { refTo } from '../../refs';

/**
 * សញ្ញា Pull-to-Refresh — គូរពី `ptrState.view` (transform · opacity · `ready` ·
 * `snapping` · `spinning`) ដែលកាយវិការ (`app/behaviors/pull-to-refresh.ts`) សរសេរ។
 *
 * ⛔ **ឃ្លាំងដាច់ដោយឡែក · អ្នកជាវតែមួយ** ៖ កាយវិការសរសេររាល់ `touchmove` ហើយគូរភ្លាម
 *    (`renderNow(ptrState)`) ➜ មានតែ component នេះទេដែលគូរឡើងវិញរាល់ស៊ុមនៃម្រាមដៃ។
 * ⛔ `view === null` (មុនកាយវិការរៀបចំ) ➜ គ្មាន `style` ដូចធាតុដែលទើបសាង។
 *
 * ⛔ លក្ខខណ្ឌត្រូវ **ដូច `setupIOSPullToRefresh()` បេះបិទ** ៖
 *    `pullToRefreshSupported()` (iOS standalone · Android native)។ App ដើម
 *    សាងធាតុនេះ *តែលើ iOS standalone* ➜ ការគូរវាលើ browser ធម្មតា នឹងបន្ថែម
 *    ធាតុដែល App ដើមគ្មាន (ការបាត់ parity)។
 */
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
