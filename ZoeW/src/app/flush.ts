import { flushSync } from 'react-dom';
import { allStores, setImmediateCommit, type StoreMeta } from '../core/store';

export function renderNow(store: StoreMeta): void {
    flushSync(() => { store.flush(); });
}

export function commitNow(): void {
    flushSync(() => {
        for (const s of allStores()) s.flush();
    });
}

setImmediateCommit(commitNow);
