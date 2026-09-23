import { RecentPhonesOptions } from './RecentPhonesOptions';

/** ⛔ ត្រូវឈរនៅទីតាំងដដែលនឹង `index.html` ដើម */
export function RecentPhonesDatalist() {
    return (
        <datalist id="recentPhonesList">
            <RecentPhonesOptions />
        </datalist>
    );
}
