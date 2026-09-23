import { useEffect } from 'react';
import { viewState } from '../../core/view-state';
import { armBootSplashFallback } from '../../ui/boot-splash';
import { useStoreValue } from '../hooks/useStore';

/**
 * ផ្ទាំងបើក — `boot-splash-out` (រសាត់) · `boot-splash-gone` គូរពី
 * `viewState.bootSplashPhase`។ ផ្លូវបម្រុង ៦ វិនាទីចាប់ផ្តើមពេល mount ។
 *
 * ⛔ `public/boot-flags.js` ក៏បន្ថែម class ទាំង ២ លើធាតុនេះដែរ (សំណាញ់ពេល bundle
 *    ដួល) ➜ `className` ត្រូវតែ **ប្រែតែពេល phase ប្រែ** (React មិនសរសេរ DOM
 *    ពេល prop ដដែល) — កុំបន្ថែម class ដែលប្រែញឹកញាប់លើធាតុនេះ។
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
