import { useLayoutEffect } from 'react';
import { uiState } from '../../../core/state';
import { viewState } from '../../../core/view-state';
import { useStoreValue } from '../../hooks/useStore';

let capturedBaseTitle: string | null = null;

/** ចំណងជើងដើមរបស់ document (`<title>` ក្នុង `index.html`) */
export function documentBaseTitle(): string {
    if (capturedBaseTitle === null) capturedBaseTitle = document.title;
    return capturedBaseTitle;
}

function useBodyClass(className: string, on: boolean): void {
    useLayoutEffect(() => {
        document.body.classList.toggle(className, on);
    }, [className, on]);
}

/**
 * ធាតុដែលនៅ **ក្រៅ** root របស់ React (`<body>` · `document.title`) ក៏គូរពី
 * state ដែរ ៖ component នេះមិនគូរអ្វីទេ — វាគ្រាន់តែធ្វើឲ្យ `<body>` ស៊ីនឹង
 * ឃ្លាំង ក្នុង `useLayoutEffect` (មុនការគូរលើអេក្រង់)។
 *
 * ⛔ វាជាកន្លែង **តែមួយ** ដែលប៉ះ `document.body` · `document.title` ក្នុង App —
 *    កូដមុខងារសរសេរតែ state។
 */
export function DocumentEffects() {
    const scrollLocked = useStoreValue(uiState, (s) => s.isModalOpen);
    const chromeHidden = useStoreValue(uiState, (s) => s.chromeHidden);
    const appLocked = useStoreValue(viewState, (s) => s.appLockOpen);
    const bootRevealing = useStoreValue(viewState, (s) => s.bootRevealing);
    const perfLite = useStoreValue(viewState, (s) => s.perfLite);
    const title = useStoreValue(viewState, (s) => s.documentTitle);

    useLayoutEffect(() => {
        document.body.style.overflow = scrollLocked ? 'hidden' : '';
    }, [scrollLocked]);

    useBodyClass('app-locked', appLocked);
    useBodyClass('boot-reveal', bootRevealing);
    useBodyClass('perf-lite', perfLite);
    useBodyClass('chrome-hidden', chromeHidden);

    useLayoutEffect(() => {
        const base = documentBaseTitle();
        const next = title === null ? base : title;
        if (document.title !== next) document.title = next;
    }, [title]);

    return null;
}
