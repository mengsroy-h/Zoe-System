import { uiState } from '../../core/state';
import { useStoreValue } from '../hooks/useStore';
import { refTo } from '../refs';
import { PhoneSuggestList } from './suggest/PhoneSuggestList';

/**
 * ប្រអប់ណែនាំលេខទូរស័ព្ទ (បំពេញដោយ `renderPhoneSuggestions`) — `show` តាម
 * `uiState.phoneSuggestOpen` · ទីតាំង (`width/left/top`) ជា state ដែល
 * `positionPhoneSuggestBox()` វាស់ពីប្រអប់ស្វែងរក។
 *
 * ⛔ `onMouseDown` ➜ `preventDefault()` ៖ ការចុចជួរណែនាំមិនត្រូវយក focus ពីប្រអប់ស្វែងរក
 *    (បើអត់ `blur` លាក់ប្រអប់មុន `click` មកដល់)។
 */
export function PhoneSuggestBox() {
    const open = useStoreValue(uiState, (s) => s.phoneSuggestOpen);
    const width = useStoreValue(uiState, (s) => s.phoneSuggestWidth);
    const left = useStoreValue(uiState, (s) => s.phoneSuggestLeft);
    const top = useStoreValue(uiState, (s) => s.phoneSuggestTop);
    const style = width || left || top ? { width: width || undefined, left: left || undefined, top: top || undefined } : undefined;
    return (
        <div
            className={open ? 'phone-suggest show' : 'phone-suggest'}
            id="phoneSuggestBox"
            ref={refTo('phoneSuggestBox')}
            style={style}
            onMouseDown={(e) => { e.preventDefault(); }}
        >
            <PhoneSuggestList />
        </div>
    );
}
