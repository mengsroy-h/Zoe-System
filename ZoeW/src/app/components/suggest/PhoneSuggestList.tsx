import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { pickPhoneSuggestion } from '../../behaviors/phone-search';

export function PhoneSuggestList() {
    useStore(uiState);
    const items = (uiState.phoneSuggestItems || []) as { phone: string; packages: number }[];
    const active = uiState.phoneSuggestActiveIndex;
    return (
        <>
            {items.map((entry, index) => (
                <div className={'phone-suggest-item' + (index === active ? ' active' : '')}
                    data-index={String(index)} key={entry.phone} onClick={() => pickPhoneSuggestion(index)}>
                    <span className="phone-suggest-number">{entry.phone}</span>
                    <span className="phone-suggest-meta">{entry.packages} កញ្ចប់</span>
                </div>
            ))}
        </>
    );
}
