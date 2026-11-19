import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../../ZoeW/src/services/scan-pending', () => ({
    preparePendingScan: (barcode, cod, dod) => ({ db: {}, record: { v: 2, barcode, cod, dod, createdAt: 1, scanDate: '2026-01-01' } }),
    notePendingScan: vi.fn(), releasePendingScan: vi.fn(), releasePendingScanAfter: vi.fn(),
    finishPendingScan: vi.fn(), pendingScanIsCurrent: () => true,
    scanEvidenceRefusalText: () => '', settlePendingScanRelease: vi.fn()
}));
vi.mock('../../../../ZoeW/src/services/scan-operation', () => ({ saveScanOperation: vi.fn(), cancelScanOperation: vi.fn(), claimScanOperation: vi.fn(), scanImportCollectedOwned: () => false }));
import * as network from '../../../../ZoeW/src/services/network';
import * as operation from '../../../../ZoeW/src/services/scan-operation';
import * as registry from '../../../../ZoeW/src/domain/registry';
import * as lookup from '../../../../ZoeW/src/features/auto-lookup';
import * as toast from '../../../../ZoeW/src/ui/toast';
import { confirmPhone } from '../../../../ZoeW/src/features/scan-action';
import { startBatchScan, resetBatchScan, batchScanIsRunning, stopBatchScan } from '../../../../ZoeW/src/features/batch-scan';
import { dataState, firebaseState, uiState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { registerModalMeta, unregisterModalMeta, modalIsOpen } from '../../../../ZoeW/src/core/modals';
import { refTo } from '../../../../ZoeW/src/app/refs';
const messages: string[] = [];
let input: HTMLTextAreaElement;
let resolveSave: (value: any) => void;
beforeEach(() => {
    messages.length = 0;
    vi.spyOn(toast, 'showToast').mockImplementation((s: any) => { messages.push(String(s)); return 0; });
    vi.spyOn(registry, 'claimBarcodeInRegistry').mockResolvedValue('claimed');
    vi.spyOn(lookup, 'attemptAutoLookup').mockResolvedValue(false);
    vi.mocked(operation.saveScanOperation).mockImplementation(() => new Promise<true | 'unknown'>(r => { resolveSave = r; }));
    dataState.scanHistory = []; dataState.deletedItems = [];
    uiState.entryScanMode = 'parcel'; uiState.isModalOpen = false; uiState.modalDisplay = {}; uiState.modalStack = [];
    viewState.phoneModalBusy = false; firebaseState.authGeneration++;
    registerModalMeta('phoneModal', {}); registerModalMeta('batchScanModal', {});
    input = document.createElement('textarea'); refTo('batchBarcodeInput')(input); input.value = 'A1';
});
afterEach(() => { resetBatchScan(); vi.restoreAllMocks(); refTo('batchBarcodeInput')(null); unregisterModalMeta('phoneModal'); unregisterModalMeta('batchScanModal'); });
const flush = () => { uiState.flush(); viewState.flush(); };
it('real confirmPhone closes before save acknowledgement; summary waits for confirmed outcome', async () => {
    startBatchScan();
    const confirming = confirmPhone(true);
    await vi.waitFor(() => expect(modalIsOpen('phoneModal')).toBe(false)); flush();
    expect(messages.filter(s => s.includes('បញ្ចូលច្រើនចប់'))).toEqual([]);
    resolveSave(true); await confirming; await Promise.resolve(); flush();
    expect(batchScanIsRunning()).toBe(false);
    expect(messages.at(-1)).toBe('✅ បញ្ចូលច្រើនចប់ ៖ បញ្ចូល 1');
});
it('unknown result never becomes saved from an optimistic local view or skipped', async () => {
    startBatchScan(); const confirming = confirmPhone(true);
    await vi.waitFor(() => expect(modalIsOpen('phoneModal')).toBe(false));
    dataState.scanHistory = [{ id: 'optimistic', barcodes: [{ code: 'A1' }] }]; flush();
    resolveSave('unknown'); await confirming; await Promise.resolve(); flush();
    expect(messages.at(-1)).toContain('បញ្ចូល 0');
    expect(messages.at(-1)).toMatch(/^⚠️/);
    expect(messages.at(-1)).toContain('មិនទាន់បញ្ជាក់ 1');
    expect(messages.at(-1)).not.toContain('រំលង');
});
it('next modal opens before acknowledgement; out-of-order results stay per item', async () => {
    const saves: Array<(value: any) => void> = [];
    vi.mocked(operation.saveScanOperation).mockImplementation(() => new Promise<true | 'unknown'>(r => saves.push(r)));
    input.value = 'A1 B2'; startBatchScan(); const first = confirmPhone(true);
    await vi.waitFor(() => expect(saves).toHaveLength(1)); flush();
    expect(modalIsOpen('phoneModal')).toBe(true);
    const second = confirmPhone(true);
    await vi.waitFor(() => expect(saves).toHaveLength(2)); flush();
    saves[1](true); await second; await Promise.resolve(); flush();
    expect(messages.filter(s => s.includes('បញ្ចូលច្រើនចប់'))).toEqual([]);
    saves[0]('unknown'); await first; await Promise.resolve(); flush();
    expect(messages.at(-1)).toContain('បញ្ចូល 1');
    expect(messages.at(-1)).toContain('មិនទាន់បញ្ជាក់ 1');
});
it('reset/new run ignores the previous confirmation callback', async () => {
    startBatchScan(); const first = confirmPhone(true);
    await vi.waitFor(() => expect(modalIsOpen('phoneModal')).toBe(false)); flush();
    const oldResolve = resolveSave;
    resetBatchScan(); input.value = 'B2'; startBatchScan();
    oldResolve(true); await first; await Promise.resolve(); flush();
    expect(batchScanIsRunning()).toBe(true);
    expect(viewState.batchScanStatus).toContain('B2');
    expect(messages.filter(s => s.includes('បញ្ចូលច្រើនចប់'))).toEqual([]);
});
it('logout/session change ends silently despite a later successful result', async () => {
    startBatchScan(); const first = confirmPhone(true);
    await vi.waitFor(() => expect(modalIsOpen('phoneModal')).toBe(false)); flush();
    firebaseState.authGeneration++; firebaseState.flush();
    resolveSave(true); await first; await Promise.resolve(); flush();
    expect(batchScanIsRunning()).toBe(false);
    expect(messages.filter(s => s.includes('បញ្ចូលច្រើនចប់'))).toEqual([]);
});
it('bounded save timeout reports pending and late success cannot revise a finished batch', async () => {
    const original = network.withTimeout;
    vi.spyOn(network, 'withTimeout').mockImplementation((promise, ms, label) => label === 'Save timed out' ? Promise.reject(new Error(label)) : original(promise, ms, label));
    startBatchScan(); await confirmPhone(true); await Promise.resolve(); flush();
    expect(batchScanIsRunning()).toBe(false);
    expect(messages.at(-1)).toContain('មិនទាន់បញ្ជាក់ 1');
    const summaries = messages.filter(s => s.includes('បញ្ចូលច្រើនចប់'));
    resolveSave(true); await Promise.resolve(); flush();
    expect(messages.filter(s => s.includes('បញ្ចូលច្រើនចប់'))).toEqual(summaries);
});
it('stop after modal close reports in-flight item as pending, not skipped', async () => {
    startBatchScan(); const confirming = confirmPhone(true);
    await vi.waitFor(() => expect(modalIsOpen('phoneModal')).toBe(false)); flush();
    stopBatchScan();
    expect(messages.at(-1)).toContain('មិនទាន់បញ្ជាក់ 1');
    expect(messages.at(-1)).not.toContain('រំលង');
    resolveSave(true); await confirming; await Promise.resolve(); flush();
    expect(messages.filter(s => s.includes('បញ្ចូលច្រើនចប់'))).toEqual([]);
});
it('claim failure followed by retry reports one item, not two outcomes', async () => {
    vi.mocked(registry.claimBarcodeInRegistry).mockRejectedValueOnce(new Error('connection lost'));
    startBatchScan(); await confirmPhone(true); await Promise.resolve(); flush();
    expect(modalIsOpen('phoneModal')).toBe(true);
    const retry = confirmPhone(true);
    await vi.waitFor(() => expect(modalIsOpen('phoneModal')).toBe(false)); flush();
    resolveSave(true); await retry; await Promise.resolve(); flush();
    expect(messages.at(-1)).toBe('✅ បញ្ចូលច្រើនចប់ ៖ បញ្ចូល 1');
});
