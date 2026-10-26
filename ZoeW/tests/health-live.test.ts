import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import * as live from '../src/app/behaviors/health-live';
const mocks = vi.hoisted(() => ({ run: vi.fn(async () => {}) }));
vi.mock('../src/features/health-check', () => ({ runHealthCheck: mocks.run, openHealthCheck: () => {}, healthCheckResultIsCurrent: () => false, healthNetworkRow: () => ({ state: 'bad', icon: '❌' }), healthClockRow: () => ({}), healthDatabaseRow: () => ({}), healthDatabaseWriteRow: () => null }));
let stop: (() => void) | undefined;
beforeEach(() => {
    vi.useFakeTimers(); mocks.run.mockClear();
    uiState.modalDisplay = { healthCheckModal: 'flex' };
    viewState.healthRecheckBusy = false;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => { stop?.(); stop = undefined; vi.restoreAllMocks(); vi.useRealTimers(); uiState.modalDisplay = {}; });
it('offline event ដកបៃតងភ្លាម ហើយរត់តែម្តងក្រោយ debounce', async () => {
    stop = live.watchHealthCheck();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    uiState.healthRows = [{ state: 'ok' }] as any;
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('offline'));
    expect(uiState.healthRows[0].state).toBe('bad');
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.run).toHaveBeenCalledTimes(1);
});
it('busy ➜ មិនផ្ញើជុំស្ទួន ហើយពិនិត្យក្រោយចប់', async () => {
    stop = live.watchHealthCheck();
    viewState.healthRecheckBusy = true;
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.run).not.toHaveBeenCalled();
    viewState.healthRecheckBusy = false; viewState.flush();
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.run).toHaveBeenCalledTimes(1);
});
it('គណនីប្តូរ ➜ ដកលទ្ធផលចាស់ និងពិនិត្យថ្មី', async () => {
    stop = live.watchHealthCheck();
    const seq = uiState.healthRunSeq;
    firebaseState.authGeneration++; firebaseState.flush();
    expect(uiState.healthRunSeq).toBeGreaterThan(seq);
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.run).toHaveBeenCalledTimes(1);
});
it('បិទ watcher ➜ គ្មាន request ឬ timer នៅសល់', async () => {
    stop = live.watchHealthCheck(); stop(); stop = undefined;
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});
it('modal បើក ➜ ពិនិត្យជុំថ្មីក្នុង 30 វិនាទី ដោយមិនធ្វើ polling លឿន', async () => {
    stop = live.watchHealthCheck();
    await vi.advanceTimersByTimeAsync(29999);
    expect(mocks.run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(251);
    expect(mocks.run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30250);
    expect(mocks.run).toHaveBeenCalledTimes(2);
});
it('hidden ផ្អាក និងដកភស្តុតាងចាស់; visible ផ្ទៀងផ្ទាត់វិញ', async () => {
    let hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    stop = live.watchHealthCheck();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(mocks.run).not.toHaveBeenCalled();
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.run).toHaveBeenCalledTimes(1);
});
it('touch ដែលមិនប្តូរស្ថានភាព មិនធ្វើឱ្យ request ដដែលៗ', async () => {
    stop = live.watchHealthCheck();
    for (let i = 0; i < 20; i++) { firebaseState.touch(); firebaseState.flush(); }
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.run).not.toHaveBeenCalled();
});
