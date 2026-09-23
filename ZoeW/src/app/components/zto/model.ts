import { ZTO_LIST_PREVIEW_ROWS, ztoListSkipText } from '../../../features/zto-list-sync';
import type { ZtoListGroup } from './ZtoListSyncBody';

/** ⛔ អត្ថបទ meta ដដែលនឹង `ztoListGroupHtml()` ដើម — កុំសរសេររូបមន្តទី ២។ */
export function ztoListGroupModel(title: string, rows: any[], tone: string): ZtoListGroup {
    const shown = rows.slice(0, ZTO_LIST_PREVIEW_ROWS);
    return {
        title: title + ' (' + rows.length + ')',
        tone,
        more: Math.max(0, rows.length - shown.length),
        rows: shown.map((row) => {
            const money = [
                row.cod ? 'COD $' + row.cod.toFixed(2) : '',
                row.dod ? 'DOD $' + row.dod.toFixed(2) : ''
            ].filter(Boolean).join(' · ');
            return {
                barcode: row.barcode || '—',
                meta: [row.phone || '—', money, row.at,
                    row.closedAtZto === true ? '🔒 ZTO បិទបញ្ជីរួច ➜ បញ្ចូលជា «យករួច»' : '',
                    ztoListSkipText(row.skip)].filter(Boolean).join(' · ')
            };
        })
    };
}
