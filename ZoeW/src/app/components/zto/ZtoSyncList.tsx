import { ztoState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { Code128Svg } from './Code128Svg';
import { code128Bars } from '../../../features/zto-status';

export interface ZtoSyncEntry { code: string; phone: string; locker: string }
export interface ZtoSyncListView { empty: string | null; entries: ZtoSyncEntry[] }

/** បញ្ជីកញ្ចប់ដែល ZTO មិនទាន់បិទ — ⛔ តែសាលក្រម `false` ពិតប៉ុណ្ណោះ។ */
export function ZtoSyncList() {
    useStore(ztoState);
    const view = ztoState.ztoSyncListView as ZtoSyncListView | null;
    if (!view) return null;
    if (view.empty !== null) return <div className="zto-sync-empty">{view.empty}</div>;
    return (
        <>
            {view.entries.map((entry, idx) => {
                const meta = (entry.phone || '—') + (entry.locker ? ' · ' + entry.locker : '');
                const drawable = !!code128Bars(entry.code);
                return (
                    <div className="zto-sync-item" key={entry.code}>
                        <div className="zto-sync-head">
                            <span className="zto-sync-no">{idx + 1}</span>
                            <span className="zto-sync-body">
                                <span className="zto-sync-code">{entry.code}</span>
                                <span className="zto-sync-meta">{meta}</span>
                            </span>
                        </div>
                        {/* ⛔ លេខដែលគូរមិនបាន ត្រូវប្រាប់អ្នកប្រើ — មិនមែនទុកទទេ */}
                        <div className={'zto-sync-bc-wrap' + (drawable ? '' : ' zto-sync-bc-none')}>
                            {drawable ? <Code128Svg code={entry.code} /> : '⚠️ លេខនេះគូរជារូប Barcode មិនបាន — សូមវាយដោយដៃ'}
                        </div>
                    </div>
                );
            })}
        </>
    );
}
