import { createStore, registerStore } from './store';

export type PalmSignResult = { code: string; state: 'dispatched' | 'signed' | 'failed' | 'unknown'; message: string; saved?: boolean; proof?: string };
export type PalmProblemScan = { action: string; time: string; message: string };
export type PalmSignConfirmation = { code: string; message: string; token: string; codes: string[]; current: () => boolean };
export const palmSignState = createStore('palmSign', {
    mode: false, checking: false, checked: {} as Record<string, boolean>, signMan: '', generation: 0, itemId: '', stage: 'dispatch' as 'dispatch' | 'receipt', requestId: '',
    codes: [] as string[], selectedCodes: [] as string[], photos: {} as Record<string, string>, busy: false,
    problemScans: {} as Record<string, PalmProblemScan>,
    confirmation: null as PalmSignConfirmation | null, warnings: {} as Record<string, string>,
    message: '', dispatchResults: [] as PalmSignResult[], results: [] as PalmSignResult[]
});
registerStore(palmSignState);
