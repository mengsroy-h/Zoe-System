import { memo } from 'react';
import { onAct } from '../../actions';
import { sameHistoryRowModel, type HistoryRowModel } from './rowModel';

const MONEY_SM = { fontSize: 'calc(10 * var(--fs-unit))' } as const;
const MONEY_MD = { fontSize: 'calc(10.5 * var(--fs-unit))' } as const;
const MONEY_XS = { fontSize: 'calc(9.5 * var(--fs-unit))' } as const;
const BADGE_BASE = { padding: '2px 5px', borderRadius: '4px', fontSize: 'calc(9 * var(--fs-unit))', fontWeight: 600 } as const;

function PriceFigures({ money }: { money: HistoryRowModel['money'] }) {
    if (money.hasCod && money.hasDod) {
        return (
            <>
                <div className="money-pending" style={MONEY_SM}>COD: <strong>${money.cod.toFixed(2)}</strong> ({money.codRiel.toLocaleString()} ៛)</div>
                <div className="money-pending kind-dod" style={{ ...MONEY_SM, marginTop: '2px' }}>DOD: <strong>${money.dod.toFixed(2)}</strong> ({money.dodRiel.toLocaleString()} ៛)</div>
                <div className="price-sum-line money-pending">សរុប: <strong>${money.sum.toFixed(2)}</strong> ({money.sumRiel.toLocaleString()} ៛)</div>
            </>
        );
    }
    if (money.hasCod) {
        return (
            <>
                <div className="money-pending" style={MONEY_MD}>COD: <strong>${money.cod.toFixed(2)}</strong></div>
                <div className="money-pending" style={MONEY_XS}>{money.codRiel.toLocaleString()} ៛</div>
            </>
        );
    }
    if (money.hasDod) {
        return (
            <>
                <div className="money-pending kind-dod" style={MONEY_MD}>DOD: <strong>${money.dod.toFixed(2)}</strong></div>
                <div className="money-pending" style={MONEY_XS}>{money.dodRiel.toLocaleString()} ៛</div>
            </>
        );
    }
    return <div style={{ ...MONEY_MD, color: 'var(--text-muted)' }}>0.00 $ (0 ៛)</div>;
}

function CallAction({ row }: { row: HistoryRowModel }) {
    if (row.callKind === 'none') return null;
    if (row.callKind === 'fix-phone') {
        return (
            <button className="btn-sm fix-phone-btn btn-primary-action" title="លេខខុស — សូមកែលេខថ្មី"
                onClick={onAct('openEditModal', { args: [row.id] })}>✏️ កែលេខ</button>
        );
    }
    if (row.callKind === 'called') {
        return (
            <a href={`tel:${row.phone}`} className="btn-sm called-btn btn-primary-action"
                onClick={onAct('handleCallAction', { args: [row.id] })}>✔️ ខល</a>
        );
    }
    return (
        <a href={`tel:${row.phone}`} className={`btn-sm call-btn btn-primary-action${row.needsRecall ? ' call-btn-recall' : ''}`}
            title={row.needsRecall ? 'សូមខលម្ដងទៀត' : ''}
            onClick={onAct('handleCallAction', { args: [row.id] })}>📞 ខល</a>
    );
}

export const HistoryRow = memo(function HistoryRow({ row }: { row: HistoryRowModel }) {
    return (
        <>
            <td style={{ textAlign: 'center' }}>
                {row.rowNumClass
                    ? <span className={`row-num-mark ${row.rowNumClass}`} title={row.rowNumLabel}>{row.rowNum}</span>
                    : row.rowNum}
            </td>
            <td>
                <div className="customer-info-stack">
                    <div className="cust-badge-line">
                        {row.calledBadge ? <span className="called-badge">ខល</span> : null}
                        {row.statusBadge === 'closed'
                            ? <span key="closed" className="closed-badge">យកហើយ</span>
                            : row.statusBadge === 'old'
                                ? <span key="old" style={{ ...BADGE_BASE, background: '#fef3c7', color: '#b45309' }}>ចាស់</span>
                                : <span key="new" style={{ ...BADGE_BASE, background: 'var(--success-light)', color: 'var(--success)' }}>ថ្មី</span>}
                    </div>
                    <div className="phone-title">
                        {row.hasPhone
                            ? <span key="phone" className="phone-clickable" title="ចុចដើម្បីសម្គាល់ការខល" onClick={onAct('openCallMarkModal', { args: [row.id] })}>{row.phone}</span>
                            : <span key="nophone" style={{ color: '#ef4444', fontStyle: 'italic' }}>គ្មានលេខ</span>}
                    </div>
                    {row.origin
                        ? <div className="origin-line">
                            <span className="origin-chip" title={row.originFull}>
                                <span className="origin-chip-icon">{row.originIcon}</span>
                                <span className="origin-chip-text">{row.origin}</span>
                                {row.originMore ? <span className="origin-chip-more">+{row.originMore}</span> : null}
                            </span>
                        </div>
                        : null}
                    {row.scanTime ? <span className="scan-time-tag">{row.scanTime}</span> : null}
                </div>
            </td>
            <td className="col-price">
                <div className="price-stack">
                    <span className="locker-badge">ទីតាំង: {row.lockerLoc}</span>
                    <div className="price-figures"><PriceFigures money={row.money} /></div>
                    <button type="button" className="count-badge count-badge-btn" onClick={onAct('openViewListModal', { args: [row.id] })}>កញ្ចប់សរុប: {row.activeCount}</button>
                </div>
            </td>
            <td className="action-cell">
                <div className="more-dropdown row-more-corner">
                    <button className="more-btn" title="ជម្រើសបន្ថែម"
                        onClick={onAct('toggleMoreDropdown', { args: [row.id], self: true, evt: true })}>⋮</button>
                </div>
                <div className="action-group">
                    <CallAction row={row} />
                    <button className={`btn-sm close-btn btn-primary-action ${row.closeIsReopen ? 'is-reopen-action' : 'is-close-action'}`}
                        onClick={onAct('toggleCloseStatus', { args: [row.id] })}>{row.closeIsReopen ? '❌ បើក' : '✅ បិទ'}</button>
                </div>
            </td>
        </>
    );
}, (prev, next) => sameHistoryRowModel(prev.row, next.row));
