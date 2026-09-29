import { useEffect } from 'react';
import { viewState } from '../../core/view-state';
import { armBootSplashFallback } from '../../ui/boot-splash';
import { useStoreValue } from '../hooks/useStore';
import { AppIconMark } from './shell/AppIconMark';

export function BootSplash() {
    const phase = useStoreValue(viewState, (s) => s.bootSplashPhase);
    useEffect(() => { armBootSplashFallback(); }, []);
    let cls = 'boot-splash';
    if (phase !== 'shown') cls += ' boot-splash-out';
    if (phase === 'gone') cls += ' boot-splash-gone';
    return (
        <div className={cls} id="bootSplash" aria-hidden="true">
            <div className="boot-splash-card">
                <div className="boot-splash-logo"><AppIconMark idPrefix="splashLogo" /></div>
                <div className="boot-splash-name">ប្រព័ន្ធគ្រប់គ្រងអីវ៉ាន់</div>
                <div className="boot-splash-bar">
                    <span></span>
                </div>
            </div>
        </div>
    );
}
