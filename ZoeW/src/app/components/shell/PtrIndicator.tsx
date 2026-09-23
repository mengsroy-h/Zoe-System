import { pullToRefreshSupported } from '../../../platform/native';
import { refTo } from '../../refs';

/**
 * សញ្ញា Pull-to-Refresh ។
 *
 * ⛔ **ការបែងចែកភារកិច្ច** ៖ React ជាម្ចាស់ *វត្តមាន និងរចនាសម្ព័ន្ធ* របស់
 *    ធាតុនេះ ចំណែក `setupIOSPullToRefresh()` (`app/behaviors/pull-to-refresh.ts`)
 *    ធ្វើ *ចលនា* តាម ref (`style.transform` · `opacity` · class ចលនា រាល់ `touchmove`)។ ការដាក់ចលនានោះចូល state របស់
 *    React នឹងគូរឡើងវិញ **រាល់ស៊ុមនៃម្រាមដៃ** ➜ វាប្តូរឥរិយាបថនៃតំបន់ដែល
 *    `CLAUDE.md` ហាមប៉ះ (PTR · ភាពរលូននៃការរមូរ)។
 *
 * ⛔ លក្ខខណ្ឌត្រូវ **ដូច `setupIOSPullToRefresh()` បេះបិទ** ៖
 *    `pullToRefreshSupported()` (iOS standalone · Android native)។ App ដើម
 *    សាងធាតុនេះ *តែលើ iOS standalone* ➜ ការគូរវាលើ browser ធម្មតា នឹងបន្ថែម
 *    ធាតុដែល App ដើមគ្មាន (ការបាត់ parity)។
 */
export function PtrIndicator() {
    if (!pullToRefreshSupported()) return null;
    return (
        <div className="ptr-indicator" aria-hidden="true" ref={refTo('ptrIndicator')}>
            <div className="ptr-spinner"></div>
        </div>
    );
}
