import { createStore, registerStore } from './store';

export type PalmSignResult = { code: string; state: 'signed' | 'failed' | 'unknown'; message: string; saved?: boolean };
export const palmSignState = createStore('palmSign', {
    mode: false, generation: 0, itemId: '', codes: [] as string[], selectedCodes: [] as string[], busy: false,
    message: '', results: [] as PalmSignResult[]
});
registerStore(palmSignState);
