import { afterEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import * as flush from '../src/app/flush';
import { positionPhoneSuggestBox, setupPhoneSuggestions } from '../src/app/behaviors/phone-search';

afterEach(() => {
    uiState.phoneSuggestOpen = false;
    vi.restoreAllMocks();
});

describe('ការរមូរ App ខណៈបញ្ជីណែនាំលេខបិទ', () => {
    it('គ្មានបញ្ជី ➜ មិន flush React គ្រប់ store ពេលវាស់ទីតាំង', () => {
        uiState.phoneSuggestOpen = false;
        const commit = vi.spyOn(flush, 'commitNow').mockImplementation(() => {});
        positionPhoneSuggestBox();
        expect(commit).not.toHaveBeenCalled();
    });

    it('រមូរ/resize ខណៈបញ្ជីបិទ ➜ ០ rAF · បើក ➜ រួមក្នុង ១ ស៊ុម', () => {
        uiState.phoneSuggestOpen = false;
        const frame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
        setupPhoneSuggestions();
        for (let i = 0; i < 30; i++) window.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('resize'));
        expect(frame).not.toHaveBeenCalled();
        uiState.phoneSuggestOpen = true;
        for (let i = 0; i < 30; i++) window.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('resize'));
        expect(frame).toHaveBeenCalledTimes(1);
    });
});
