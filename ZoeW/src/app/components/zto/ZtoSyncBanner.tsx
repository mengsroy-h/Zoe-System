import { ztoState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';

export interface ZtoBannerView { headline: string; detail: string }

/** របា «ZTO មិនទាន់បិទ» — ⛔ លេចតែពេលមានសាលក្រម `false` ពិត។ */
export function ZtoSyncBanner() {
    useStore(ztoState);
    const view = ztoState.ztoBannerView as ZtoBannerView | null;
    if (!view) return null;
    return (
        <>
            <span className="zto-sync-icon" aria-hidden="true">🔄</span>
            <span className="zto-sync-copy"><strong>{view.headline}</strong><span>{view.detail}</span></span>
            <span className="zto-sync-go" aria-hidden="true">›</span>
        </>
    );
}
