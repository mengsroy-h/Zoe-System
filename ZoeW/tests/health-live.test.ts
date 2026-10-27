import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import * as live from '../src/app/behaviors/health-live';
const mocks = vi.hoisted(() => ({ run: vi.fn(async () => {}), clock: vi.fn(() => ({ label: 'នាឡិកា Server', state: 'ok', detail: 'ចាស់' })) }));
vi.mock('../src/features/health-check', () => ({ runHealthCheck: mocks.run, openHealthCheck: () => {}, healthCheckResultIsCurrent: () => false, healthNetworkRow: () => ({ state: 'bad', icon: '❌' }), healthClockRow: mocks.clock, healthDatabaseRow: () => ({}), healthDatabaseWriteRow: () => null }));
let stop: (() => void) | undefined;
beforeEach(() => {
    vi.useFakeTimers(); mocks.run.mockReset(); mocks.run.mockResolvedValue(undefined); mocks.clock.mockReturnValue({ label: 'នាឡិកា Server', state: 'ok', detail: 'ចាស់' });
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
    expect(mocks.run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(29750);
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

it('storage សាកល្បង និង unrelated មិនបង្កជុំថ្មីឆ្លង tab', async () => {
    stop = live.watchHealthCheck();
    const seq = uiState.healthRunSeq;
    for (let i = 0; i < 20; i++) {
        window.dispatchEvent(new StorageEvent('storage', { key: '__zoew_health_' + i }));
        window.dispatchEvent(new StorageEvent('storage', { key: 'zoew_unrelated' }));
        await vi.advanceTimersByTimeAsync(300);
    }
    expect(mocks.run).not.toHaveBeenCalled();
    expect(uiState.healthRunSeq).toBe(seq);
});
it('clock ផ្លាស់ប្តូរ កែ row ផ្ទាល់ដោយមិនហៅ network ឬបោះចោលជុំកំពុងរត់', async () => {
    stop = live.watchHealthCheck();
    uiState.healthRows = [mocks.clock()] as any;
    const seq = uiState.healthRunSeq;
    mocks.clock.mockReturnValue({ label: 'នាឡិកា Server', state: 'warn', detail: 'ថ្មី' });
    firebaseState.touch(); firebaseState.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(uiState.healthRunSeq).toBe(seq);
    expect(uiState.healthRows[0].detail).toBe('ថ្មី');
});
it('ព្រឹត្តិការណ៍ញឹកញាប់ ដកលទ្ធផលចាស់ភ្លាម តែមិនហៅជុំក្រោម 30 វិនាទី', async () => {
    stop = live.watchHealthCheck();
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.run).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) {
        uiState.healthRows = [{ state: 'ok' }] as any;
        window.dispatchEvent(new StorageEvent('storage', { key: 'zoew_lookup_api_config' }));
        expect(uiState.healthRows[0].state).not.toBe('ok');
        await vi.advanceTimersByTimeAsync(300);
    }
    expect(mocks.run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(24000);
    expect(mocks.run).toHaveBeenCalledTimes(2);
});
it('ប្តូរគណនីក្នុង cooldown ដកភស្តុតាងចាស់ ហើយជុំថ្មីប្រើ owner ថ្មី', async () => {
    stop = live.watchHealthCheck();
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(250);
    const seq = uiState.healthRunSeq;
    firebaseState.authGeneration++; firebaseState.flush();
    expect(uiState.healthRunSeq).toBeGreaterThan(seq);
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29750);
    expect(mocks.run).toHaveBeenCalledTimes(2);
});

it('storage.clear សំខាន់ តែ sessionStorage មិនបង្កជុំឆ្លង tab', async () => {
    stop = live.watchHealthCheck();
    const seq = uiState.healthRunSeq;
    window.dispatchEvent(new StorageEvent('storage', { key: 'zoew_lookup_api_config', storageArea: sessionStorage }));
    await vi.advanceTimersByTimeAsync(250);
    expect(uiState.healthRunSeq).toBe(seq);
    expect(mocks.run).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }));
    expect(uiState.healthRunSeq).toBeGreaterThan(seq);
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.run).toHaveBeenCalledTimes(1);
});

it('ប្តូរម៉ោងឧបករណ៍ មិនកាត់ cooldown automatic', async () => {
    stop = live.watchHealthCheck();
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.run).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 3600000);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29750);
    expect(mocks.run).toHaveBeenCalledTimes(2);
});
