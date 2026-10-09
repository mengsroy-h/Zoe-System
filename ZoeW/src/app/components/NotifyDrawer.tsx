import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { uiState } from '../../core/state';
import { APP_VERSION } from '../../core/version';
import { NOTIFY_EXPIRY_HOURS_MAX, NOTIFY_GROUP_EXPIRY, NOTIFY_GROUP_REMOVED, newerAppVersion, visibleNotifyFeed, type NotifyExpiryRow, type NotifyFeedItem, type NotifyRemovedRow, type NotifyRemovedView, type NotifyView } from '../../features/notifications';
import { APK_ERROR_TEXT, type ApkReleaseState, type ApkUpdateState } from '../../features/apk-update';
import { PUSH_STATUS_TEXT, type PushStatus } from '../../features/push';
import { isNativeApp } from '../../platform/native';
import { onAct } from '../actions';
import { useStoreFields } from '../hooks/useStore';
import { DrawerGroup } from './DrawerGroup';

const KIND_ICON: Record<string, string> = { update: '🆕', maintenance: '🛠️', notice: '📢' };

const KIND_CLASS: Record<string, string> = {
    update: 'notify-feed-item notify-kind-update',
    maintenance: 'notify-feed-item notify-kind-maintenance',
    notice: 'notify-feed-item notify-kind-notice'
};

function hoursText(h: number): string {
    return h <= 0 ? 'ដល់ពេលហើយ' : '≤ ' + h + ' ម៉ោង';
}

function PushSection({ status }: { status: PushStatus }) {
    const canToggle = status === 'on' || status === 'off' || status === 'error' || status === 'server-off' || status === 'no-account';
    const cls = status === 'on' ? 'notify-summary is-info' : (status === 'denied' || status === 'error' || status === 'server-off' || status === 'no-account' || status === 'shop-inactive' ? 'notify-summary is-warn' : 'notify-summary');
    return (
        <section className="notify-section" id="notifyPushSection">
            <div className="notify-section-title">📲 ជូនដំណឹងលើទូរស័ព្ទ</div>
            <div className={cls} id="notifyPushStatus">{PUSH_STATUS_TEXT[status] || PUSH_STATUS_TEXT.unknown}</div>
            {canToggle || status === 'busy' ? (
                <button
                    type="button"
                    className={status === 'on' ? 'notify-refresh-btn notify-push-btn is-on' : 'notify-refresh-btn notify-push-btn'}
                    id="notifyPushBtn"
                    disabled={status === 'busy'}
                    onClick={onAct("togglePush")}
                >
                    {status === 'on' ? '🔕 បិទការជូនដំណឹង' : (status === 'busy' ? '⏳ កំពុងភ្ជាប់…' : '🔔 បើកការជូនដំណឹង')}
                </button>
            ) : null}
        </section>
    );
}

export const NOTIFY_PAGE_ROWS = 20;

function NotifyPageMore({ remaining, onMore }: { remaining: number; onMore: () => void }) {
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver !== 'function') return;
        let fired = false;
        const io = new IntersectionObserver((entries) => {
            if (fired || !entries.some((e) => e.isIntersecting)) return;
            fired = true;
            onMore();
        }, { root: el.closest('.drawer-body'), rootMargin: '0px 0px 240px 0px' });
        io.observe(el);
        return () => io.disconnect();
    }, [remaining, onMore]);
    return (
        <div className="notify-page-more" ref={ref}>
            <button type="button" className="btn-sm notify-page-more-btn" onClick={onMore}>⬇️ បង្ហាញ {remaining} ទៀត</button>
        </div>
    );
}

function NotifyPagedList<T extends { key: string }>({ id, rows, renderRow }: { id: string; rows: T[]; renderRow: (row: T) => ReactNode }) {
    const [limit, setLimit] = useState(NOTIFY_PAGE_ROWS);
    const more = useCallback(() => setLimit((n) => n + NOTIFY_PAGE_ROWS), []);
    const shown = rows.slice(0, limit);
    const remaining = rows.length - shown.length;
    return (
        <>
            <ul className="notify-expiry-list" id={id}>
                {shown.map((row) => <li key={row.key} className="notify-expiry-row">{renderRow(row)}</li>)}
            </ul>
            {remaining > 0 ? <NotifyPageMore remaining={remaining} onMore={more} /> : null}
        </>
    );
}

function NotifyGroupCount({ view }: { view: { measurable: boolean; packages: number } | null }) {
    const measurable = !!(view && view.measurable);
    const packages = measurable && view ? view.packages : 0;
    return <span className={packages > 0 ? 'notify-group-count is-warn' : 'notify-group-count'}>{measurable ? String(packages) : '—'}</span>;
}

function expiryRow(row: NotifyExpiryRow) {
    return (
        <>
            <span className="notify-expiry-phone">{row.phone || '—'}</span>
            <span className="notify-expiry-meta">
                {row.count} កញ្ចប់{row.locker ? ' · ' + row.locker : ''}
            </span>
            <span className={row.hoursLeft <= 0 ? 'notify-expiry-left is-due' : 'notify-expiry-left'}>{hoursText(row.hoursLeft)}</span>
        </>
    );
}

function ExpirySection({ view }: { view: NotifyView | null }) {
    const measurable = !!(view && view.measurable);
    return (
        <DrawerGroup
            id={NOTIFY_GROUP_EXPIRY}
            headId="notifyExpiryHead"
            bodyId="notifyExpirySection"
            icon="📦"
            label="កញ្ចប់ជិតផុតកំណត់"
            className="notify-group"
            action="toggleNotifyGroup"
            lazy
            extra={<NotifyGroupCount view={view} />}
        >
            {measurable && view && view.packages > 0 ? (
                <>
                    <div className="notify-summary is-warn" id="notifyExpirySummary">
                        <strong>{view.packages}</strong> កញ្ចប់ · <strong>{view.customers}</strong> អតិថិជន
                        {' '}នឹងផុតកំណត់ក្នុង {NOTIFY_EXPIRY_HOURS_MAX} ម៉ោងខាងមុខ ➜ ប្រព័ន្ធដកចេញស្វ័យប្រវត្តិ (ដកលុយ) បើមិនទាន់យក
                    </div>
                    <NotifyPagedList id="notifyExpiryList" rows={view.rows} renderRow={expiryRow} />
                </>
            ) : (
                <div className="notify-summary" id="notifyExpirySummary">{view ? view.emptyText : '⏳ កំពុងរៀបចំ…'}</div>
            )}
        </DrawerGroup>
    );
}

function removedAgoText(h: number): string {
    if (h < 0) return '';
    return h < 1 ? 'ទើបដក' : 'ដកមុន ' + h + ' ម៉ោង';
}

function removedRow(row: NotifyRemovedRow) {
    return (
        <>
            <span className="notify-expiry-phone">{row.phone || '—'}</span>
            <span className="notify-expiry-meta">
                {row.count} កញ្ចប់{row.locker ? ' · ' + row.locker : ''}
            </span>
            <span className="notify-expiry-left">
                {removedAgoText(row.hoursAgo)}
                {row.isNew ? <span className="notify-new-tag">ថ្មី</span> : null}
            </span>
        </>
    );
}

function RemovedSection({ view }: { view: NotifyRemovedView | null }) {
    const measurable = !!(view && view.measurable);
    const unseen = measurable && view ? view.unseen : 0;
    return (
        <DrawerGroup
            id={NOTIFY_GROUP_REMOVED}
            headId="notifyRemovedHead"
            bodyId="notifyRemovedSection"
            icon="📤"
            label="កញ្ចប់ដែលដករួច"
            className="notify-group"
            action="toggleNotifyGroup"
            lazy
            extra={<><NotifyGroupCount view={view} />{unseen > 0 ? <span className="notify-new-tag">ថ្មី {unseen}</span> : null}</>}
        >
            {measurable && view && view.packages > 0 ? (
                <>
                    <div className="notify-summary is-warn" id="notifyRemovedSummary">
                        <strong>{view.packages}</strong> កញ្ចប់ · <strong>{view.customers}</strong> អតិថិជន
                        {' '}ផុតកំណត់ ➜ ប្រព័ន្ធដកចេញ និងដកលុយ ➜ យកចេញពីទូ ហើយប្រគល់ត្រឡប់ · ស្តារវិញបានពី 🗑️ ធុងសំរាម
                    </div>
                    <NotifyPagedList id="notifyRemovedList" rows={view.rows} renderRow={removedRow} />
                </>
            ) : (
                <div className="notify-summary" id="notifyRemovedSummary">{view ? view.emptyText : '⏳ កំពុងរៀបចំ…'}</div>
            )}
        </DrawerGroup>
    );
}

function megabytes(bytes: number) {
    return (bytes / (1024 * 1024)).toFixed(1);
}

function ApkUpdateBlock({ version }: { version: string }) {
    const s = useStoreFields(uiState, ['apkRelease', 'apkUpdate']);
    const release: ApkReleaseState = s.apkRelease;
    const update: ApkUpdateState = s.apkUpdate;
    if (release.version !== version || release.state === 'idle' || release.state === 'checking') {
        return <div className="notify-apk-status" id="notifyApkStatus">⏳ កំពុងពិនិត្យ APK កំណែ {version} លើ GitHub Release…</div>;
    }
    if (release.state === 'absent') {
        return <div className="notify-apk-status" id="notifyApkStatus">⏳ APK កំណែ {version} មិនទាន់មានលើ GitHub Release — App ពិនិត្យម្តងទៀតពេលបើក 🔔</div>;
    }
    if (release.state === 'failed') {
        return <div className="notify-apk-status is-warn" id="notifyApkStatus">⚠️ ពិនិត្យ GitHub Release មិនបាន — App ពិនិត្យម្តងទៀតពេលបើក 🔔</div>;
    }
    const mine = update.version === version;
    const phase = mine ? update.phase : 'idle';
    if (phase === 'download') {
        const pct = update.total > 0 ? Math.min(100, Math.floor((update.received * 100) / update.total)) : 0;
        return (
            <div className="notify-apk-progress-wrap">
                <progress className="notify-apk-progress" id="notifyApkProgress" max={update.total > 0 ? update.total : undefined} value={update.total > 0 ? update.received : undefined} />
                <div className="notify-apk-status" id="notifyApkStatus">
                    ⬇️ កំពុងទាញយក {update.total > 0 ? pct + '% (' + megabytes(update.received) + ' / ' + megabytes(update.total) + ' MB)' : '…'}
                </div>
                <button type="button" className="notify-apk-cancel-btn" id="notifyApkCancelBtn" onClick={onAct('cancelApkUpdate')}>✖️ បោះបង់</button>
            </div>
        );
    }
    if (phase === 'install') {
        return <div className="notify-apk-status" id="notifyApkStatus">📲 កំពុងបើកផ្ទាំងដំឡើង…</div>;
    }
    let note = null;
    let label = '📥 ទាញយក និងដំឡើង APK កំណែ ' + version;
    if (phase === 'opened') {
        note = <div className="notify-apk-status" id="notifyApkStatus">📲 សូមចុច «ដំឡើង» (Install) នៅផ្ទាំងរបស់ Android</div>;
        label = '📲 បើកផ្ទាំងដំឡើងម្តងទៀត';
    } else if (phase === 'denied') {
        note = <div className="notify-apk-status is-warn" id="notifyApkStatus">⚠️ សូមបើក «អនុញ្ញាតពីប្រភពនេះ» (Allow from this source) សម្រាប់ ZoeW ហើយចុចម្តងទៀត</div>;
    } else if (phase === 'error') {
        note = <div className="notify-apk-status is-warn" id="notifyApkStatus">{APK_ERROR_TEXT[update.error] || APK_ERROR_TEXT.failed}</div>;
    }
    return (
        <>
            {note}
            <button type="button" className="notify-refresh-btn notify-apk-btn" id="notifyApkBtn" onClick={onAct('startApkUpdate', { args: [version] })}>{label}</button>
        </>
    );
}

function UpdateCheckButton({ check }: { check: { phase: string; at: number } }) {
    const busy = check.phase === 'checking';
    return (
        <>
            {check.phase === 'failed' ? <div className="notify-apk-status is-warn" id="notifyUpdateCheckStatus">⚠️ ពិនិត្យកំណែថ្មីមិនបាន — សូមពិនិត្យអ៊ីនធឺណិត ហើយចុចម្តងទៀត</div> : null}
            <button type="button" className="notify-refresh-btn notify-check-btn" id="notifyCheckUpdateBtn" disabled={busy} onClick={onAct('checkForAppUpdate')}>
                {busy ? '⏳ កំពុងពិនិត្យកំណែថ្មី…' : '🔄 ពិនិត្យកំណែថ្មី'}
            </button>
        </>
    );
}

function VersionSection({ feed, updateReady, check }: { feed: NotifyFeedItem[]; updateReady: boolean; check: { phase: string; at: number } }) {
    const newer = newerAppVersion(feed);
    let status;
    if (updateReady) {
        status = (
            <>
                <div className="notify-summary is-info">🔄 កំណែថ្មីបានទាញរួច — Refresh ដើម្បីប្រើវា</div>
                <button type="button" className="notify-refresh-btn" onClick={() => window.location.reload()}>Refresh ឥឡូវនេះ</button>
            </>
        );
    } else if (newer) {
        status = (
            <>
                <div className="notify-summary is-info">
                    🆕 កំណែ {newer} មានហើយ — {isNativeApp() ? 'សូមដំឡើង APK ថ្មី' : 'App នឹងទាញវាដោយស្វ័យប្រវត្តិ (ឬ Refresh)'}
                </div>
                {isNativeApp() ? <ApkUpdateBlock version={newer} /> : null}
            </>
        );
    } else if (feed.length) {
        status = <div className="notify-summary">✅ អ្នកកំពុងប្រើកំណែចុងក្រោយ</div>;
    } else {
        status = <div className="notify-summary">⚠️ មិនទាន់ទាញព័ត៌មានកំណែពី Server បាន</div>;
    }
    return (
        <section className="notify-section" id="notifyVersionSection">
            <div className="notify-section-title">📱 កំណែ App</div>
            <div className="notify-version-line">កំណែបច្ចុប្បន្ន ៖ <strong>{APP_VERSION}</strong></div>
            {status}
            {updateReady ? null : <UpdateCheckButton check={check} />}
        </section>
    );
}

function FeedSection({ feed, seen }: { feed: NotifyFeedItem[]; seen: string[] }) {
    return (
        <section className="notify-section" id="notifyFeedSection">
            <div className="notify-section-title notify-title-row">
                <span>📢 សេចក្តីប្រកាស និងការថែទាំ</span>
                {feed.length ? (
                    <button type="button" className="notify-clear-btn" id="notifyClearBtn" onClick={onAct("clearNotifications")}>
                        🧹 សម្អាត
                    </button>
                ) : null}
            </div>
            {feed.length ? (
                <ul className="notify-feed-list" id="notifyFeedList">
                    {feed.map((item) => (
                        <li key={item.id} className={KIND_CLASS[item.kind] || 'notify-feed-item'}>
                            <div className="notify-feed-head">
                                <span className="notify-feed-ico" aria-hidden="true">{KIND_ICON[item.kind] || '📢'}</span>
                                <span className="notify-feed-title">{item.title}</span>
                                {seen.indexOf(item.id) === -1 ? <span className="notify-new-tag">ថ្មី</span> : null}
                            </div>
                            {item.date ? <div className="notify-feed-date">{item.date}</div> : null}
                            {item.body ? <div className="notify-feed-body">{item.body}</div> : null}
                            {item.points.length ? (
                                <ul className="notify-feed-points">
                                    {item.points.map((p, i) => <li key={i}>{p}</li>)}
                                </ul>
                            ) : null}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="notify-summary">គ្មានសេចក្តីប្រកាសទេ</div>
            )}
        </section>
    );
}

export function NotifyDrawer() {
    const s = useStoreFields(uiState, ['notifyDrawerOpen', 'notifyView', 'notifyRemovedView', 'notifyFeed', 'notifySellerFeed', 'notifySeenIds', 'notifyDismissedIds', 'updateReady', 'pushStatus', 'appUpdateCheck']);
    const open = s.notifyDrawerOpen;
    return (
        <aside className={open ? 'side-drawer side-drawer-right open' : 'side-drawer side-drawer-right'} id="notifyDrawer" aria-hidden={open ? 'false' : 'true'}>
            <div className="drawer-head">
                <div className="drawer-title">🔔 ជូនដំណឹង</div>
                <button
                    type="button"
                    className="drawer-close"
                    title="បិទ"
                    aria-label="បិទ"
                    onClick={onAct("closeSideDrawer")}
                >
                    ✖
                </button>
            </div>
            <div className="drawer-body">
                <PushSection status={s.pushStatus} />
                <ExpirySection view={s.notifyView} />
                <RemovedSection view={s.notifyRemovedView} />
                <VersionSection feed={s.notifyFeed} updateReady={s.updateReady} check={s.appUpdateCheck} />
                <FeedSection feed={visibleNotifyFeed(s.notifyFeed, s.notifySellerFeed, s.notifyDismissedIds)} seen={s.notifySeenIds} />
            </div>
            <div className="drawer-foot notify-foot">
                <div className="credit-tag">Powered By ZoeW</div>
            </div>
        </aside>
    );
}
