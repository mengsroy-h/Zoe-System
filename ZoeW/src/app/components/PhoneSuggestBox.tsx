import { uiState } from '../../core/state';
import { useStoreValue } from '../hooks/useStore';
import { refTo } from '../refs';
import { PhoneSuggestList } from './suggest/PhoneSuggestList';

/**
 * ប្រអប់ណែនាំលេខទូរស័ព្ទ (បំពេញដោយ `renderPhoneSuggestions`) — `show` តាម
 * `uiState.phoneSuggestOpen` · ទីតាំងគណនាដោយ `positionPhoneSuggestBox()` តាម ref។
 */
export function PhoneSuggestBox() {
    const open = useStoreValue(uiState, (s) => s.phoneSuggestOpen);
    return (
        <div className={open ? 'phone-suggest show' : 'phone-suggest'} id="phoneSuggestBox" ref={refTo('phoneSuggestBox')}>
            <PhoneSuggestList />
        </div>
    );
}
