import { originLabel } from '../../../features/barcode-origin';
import { ZTO_LIST_PREVIEW_ROWS, ztoListSkipText } from '../../../features/zto-list-sync';
import type { ZtoListGroup } from './ZtoListSyncBody';

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
                primary: [row.phone || '—', money, row.at].filter(Boolean).join(' · '),
                origin: originLabel(row.from).full,
                notes: [
                    row.closedAtZto === true ? '🔒 ZTO បិទបញ្ជីរួច ➜ បញ្ចូលជា «យករួច»' : '',
                    row.closeInZoew === true ? '🔒 ZTO បិទបញ្ជីរួច ➜ បិទក្នុង ZoeW ពេលចុច «បញ្ចូល»' : '',
                    ztoListSkipText(row.skip)].filter(Boolean)
            };
        })
    };
}
