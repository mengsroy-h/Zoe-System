import { PhoneSuggestList } from './suggest/PhoneSuggestList';

/** ប្រអប់ណែនាំលេខទូរស័ព្ទ (បំពេញដោយ `renderPhoneSuggestions`) */
export function PhoneSuggestBox() {
    return (
        <div className="phone-suggest" id="phoneSuggestBox">
            <PhoneSuggestList />
        </div>
    );
}
