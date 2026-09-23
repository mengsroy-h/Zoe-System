import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { onAct } from '../../actions';

export interface BarcodeMoneyLine { cls: string; kindDod: boolean; label: string; dollars: string; riel: string }

export interface BarcodeListRow {
    itemId: string;
    code: string;
    index: number;
    locker: string;
    time: string | null;
    moneyClass: string;
    money: BarcodeMoneyLine[];
    sum: { cls: string; dollars: string; riel: string } | null;
    closed: boolean;
}

/** បញ្ជីកញ្ចប់ក្នុងជួរដេកមួយ (ប្រអប់ «📦 បញ្ជី»)។ */
export function BarcodeListContainer() {
    useStore(uiState);
    const rows = uiState.viewListView as BarcodeListRow[] | null;
    if (!rows) return null;
    return (
        <>
            {rows.map((b) => (
                <div className="barcode-list-item" key={b.code + '|' + b.index}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="bc-head-line">
                            <strong>{b.index}.</strong>{' '}
                            <span className="barcode-tag">🏷️ {b.code}</span>{' '}
                            <span className="locker-badge">ទីតាំង: {b.locker}</span>
                        </div>
                        {b.time ? <div className="bc-time-line">{b.time}</div> : null}
                        {b.money.map((m) => (
                            <div className={`bc-money-line ${m.cls}${m.kindDod ? ' kind-dod' : ''}`} key={m.label}>
                                {m.label}: <strong>${m.dollars}</strong> ({m.riel} ៛)
                            </div>
                        ))}
                        {b.sum ? (
                            <div className={`bc-sum-line ${b.sum.cls}`}>
                                សរុប: <strong>${b.sum.dollars}</strong> ({b.sum.riel} ៛)
                            </div>
                        ) : null}
                    </div>
                    <div className="barcode-actions-group">
                        <button className={`btn-toggle-bc-close ${b.closed ? 'is-reopen-action' : 'is-close-action'}`}
                            onClick={onAct('toggleIndividualBarcodeClose', { args: [b.itemId, b.code] })}>
                            {b.closed ? '❌ បើក' : '✅ បិទ'}
                        </button>
                        <button className="btn-edit-item-price"
                            onClick={onAct('openEditBarcodePriceModal', { args: [b.itemId, b.code] })}>✏️ កែ</button>
                    </div>
                </div>
            ))}
        </>
    );
}
