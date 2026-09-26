import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';

export interface DailyStatCard {
    label: string;
    key: string;
    count: number;
    codText: string;
    dodText: string;
    collectedText: string;
    collectedRielText: string;
    totalText: string;
    pendingText: string;
}

export interface CollectedStatCard {
    day: string;
    count: number;
    cod: string;
    dod: string;
    total: string;
    riel: string;
}

export interface CardsView<T> { empty: string | null; cards: T[] }

export function DailyStatsCards() {
    useStore(uiState);
    const view = uiState.dailyStatsView as CardsView<DailyStatCard> | null;
    if (!view) return null;
    if (view.empty !== null) {
        return <p style={{ textAlign: 'center', color: '#888', padding: '12px' }}>{view.empty}</p>;
    }
    return (
        <>
            {view.cards.map((c) => (
                <div className="stat-card-item" key={c.key}>
                    <div className="m-title">📅 {c.label}៖ {c.key}</div>
                    <div className="m-details">
                        <span>កញ្ចប់សរុប៖ <strong>{c.count}</strong></span>
                        <span>COD: <strong className="money-collected">{c.codText}</strong> | DOD: <strong className="money-collected kind-dod">{c.dodText}</strong></span>
                    </div>
                    <div className="stat-money-row money-collected">
                        ចំណូល (យករួច)៖ <strong>{c.collectedText}</strong> ({c.collectedRielText})
                    </div>
                    <div className="stat-money-row stat-money-breakdown">
                        <span className="money-total">តម្លៃកញ្ចប់ទាំងអស់៖ ${c.totalText}</span>
                        <span className="money-pending">មិនទាន់យក៖ {c.pendingText}</span>
                    </div>
                </div>
            ))}
        </>
    );
}

export function CollectedStatsCards() {
    useStore(uiState);
    const view = uiState.collectedStatsView as CardsView<CollectedStatCard> | null;
    if (!view) return null;
    if (view.empty !== null) {
        return <p style={{ textAlign: 'center', color: '#888', padding: '12px' }}>{view.empty}</p>;
    }
    return (
        <>
            {view.cards.map((c) => (
                <div className="stat-card-item" key={c.day}>
                    <div className="m-title">💵 ថ្ងៃយក៖ {c.day}</div>
                    <div className="m-details">
                        <span>កញ្ចប់យករួច៖ <strong>{c.count}</strong></span>
                        <span>COD: <strong className="money-collected">${c.cod}</strong> | DOD: <strong className="money-collected kind-dod">${c.dod}</strong></span>
                    </div>
                    <div className="stat-money-row money-collected">
                        ចំណូលថ្ងៃនេះ៖ <strong>${c.total}</strong> ({c.riel} ៛)
                    </div>
                </div>
            ))}
        </>
    );
}
