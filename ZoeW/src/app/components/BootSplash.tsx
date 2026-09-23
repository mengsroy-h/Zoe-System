import { useEffect } from 'react';
import { viewState } from '../../core/view-state';
import { armBootSplashFallback } from '../../ui/boot-splash';
import { useStoreValue } from '../hooks/useStore';

/**
 * ផ្ទាំងបើក — `boot-splash-out` (រសាត់) · `boot-splash-gone` គូរពី
 * `viewState.bootSplashPhase`។ ផ្លូវបម្រុង ៦ វិនាទីចាប់ផ្តើមពេល mount (`armBootSplashFallback`)។
 *
 * ⛔ React ជាម្ចាស់ **តែមួយ** នៃធាតុនេះ ៖ `boot-flags.js` លែងប៉ះវា។ ផ្ទាំងនេះកើតតែពេល React
 *    mount រួច ➜ បើ bundle ដួល វាមិនកើតសោះ (គ្មានផ្ទាំងជាប់) · បើ boot ជាប់ក្រោយ mount ➜
 *    ផ្លូវបម្រុង ៦ វិនាទីនៅទីនេះរសាត់វាចេញ។
 */
export function BootSplash() {
    const phase = useStoreValue(viewState, (s) => s.bootSplashPhase);
    useEffect(() => { armBootSplashFallback(); }, []);
    let cls = 'boot-splash';
    if (phase !== 'shown') cls += ' boot-splash-out';
    if (phase === 'gone') cls += ' boot-splash-gone';
    return (
        <div className={cls} id="bootSplash" aria-hidden="true">
            <div className="boot-splash-card">
                <div className="boot-splash-logo">Zoe</div>
                <div className="boot-splash-name">ប្រព័ន្ធគ្រប់គ្រងអីវ៉ាន់</div>
                <div className="boot-splash-bar">
                    <span></span>
                </div>
            </div>
        </div>
    );
}
