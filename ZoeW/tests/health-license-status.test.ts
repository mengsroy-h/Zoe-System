import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { healthLicenseStatus } from '../src/features/health-license-status';
const owner = vi.hoisted(() => ({ current: true }));
vi.mock('../src/services/connection-flow', () => ({ captureConnectionOperation: () => ({ current: () => owner.current }) }));
vi.mock('../src/features/license', () => ({ LICENSE_APP_CODE: 'ZOE' }));
const now = 1800000000000;
const payload = { a: 'ZOE', id: 'public-id', exp: now / 1000 + 86400 };
let api: any;
function deferred() { let resolve!: (value: any) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
beforeEach(() => {
    owner.current = true;
    api = { activationKeyString: vi.fn(() => 'private-key'), verifyKeyString: vi.fn(async () => ({ valid: true, payload })),
        checkOnline: vi.fn(async () => ({ ok: true, seat: 'mine', expiresAt: now + 864000000 })),
        getServerNow: vi.fn(() => now), getServerTimeOffset: vi.fn(() => 0), getStatus: vi.fn(), claimSeat: vi.fn() };
    window.ZoeLicense = api;
});
afterEach(() => { vi.useRealTimers(); delete window.ZoeLicense; });
describe('ការផ្ទៀងផ្ទាត់ License សម្រាប់សុខភាព', () => {
    it('សកម្មតែពេលផ្ទៀងផ្ទាត់គ្រប់ផ្នែក និងមិនកែ Activation ឬ Seat', async () => {
        expect(await healthLicenseStatus()).toEqual({ state: 'active', exp: now + 864000000, daysLeft: 10 });
        expect(api.checkOnline).toHaveBeenCalledWith('ZOE', 'public-id', { claimSeat: false });
        expect(api.getStatus).not.toHaveBeenCalled(); expect(api.claimSeat).not.toHaveBeenCalled();
    });
    it('បង្ហាញថ្ងៃនៅសល់ជិតផុតកំណត់', async () => {
        api.checkOnline.mockResolvedValue({ ok: true, seat: 'mine', expiresAt: now + 86400000 });
        expect(await healthLicenseStatus()).toMatchObject({ state: 'active', daysLeft: 1 });
    });
    it.each(['revoked', 'not-found', 'seat-taken'])('ការបដិសេធ %s', async reason => {
        api.checkOnline.mockResolvedValue({ ok: false, reason }); expect(await healthLicenseStatus()).toEqual({ state: 'required', reason });
    });
    it.each(['signature', 'format', 'app-mismatch'])('បដិសេធ %s មុនភ្ជាប់ Server', async reason => {
        api.verifyKeyString.mockResolvedValue({ valid: false, reason });
        expect(await healthLicenseStatus()).toEqual({ state: 'required', reason }); expect(api.checkOnline).not.toHaveBeenCalled();
    });
    it('ការពន្យារនៅ Server លើហត្ថលេខាដែលផុតកំណត់', async () => {
        api.verifyKeyString.mockResolvedValue({ valid: false, reason: 'expired', payload: { ...payload, exp: 1 } });
        expect(await healthLicenseStatus()).toMatchObject({ state: 'active', daysLeft: 10 });
    });
    it.each([{ ok: null, reason: 'network' }, { ok: true, seat: 'unknown', expiresAt: now + 864000000 }, { ok: true, seat: 'mine' }, { ok: true, seat: 'mine', expiresAt: Infinity }])('មិនសកម្មពេលខ្វះភស្តុតាង %j', async online => {
        api.checkOnline.mockResolvedValue(online); expect(await healthLicenseStatus()).toMatchObject({ state: 'unverified' });
    });
    it.each([null, undefined, Infinity, NaN])('មិនសកម្មបើម៉ោងមិនបានផ្ទៀងផ្ទាត់ %s', async offset => {
        api.getServerTimeOffset.mockReturnValue(offset); expect(await healthLicenseStatus()).toMatchObject({ state: 'unverified' });
    });
    it('ការផុតកំណត់ពី API ត្រូវការម៉ោងដែលទុកចិត្តបាន', async () => {
        api.checkOnline.mockResolvedValue({ ok: false, reason: 'expired-server' }); api.getServerTimeOffset.mockReturnValue(null);
        expect(await healthLicenseStatus()).toMatchObject({ state: 'unverified' }); api.getServerTimeOffset.mockReturnValue(0);
        expect(await healthLicenseStatus()).toEqual({ state: 'required', reason: 'expired-server' });
    });
    it('គ្មាន Key', async () => {
        api.activationKeyString.mockReturnValue(''); expect(await healthLicenseStatus()).toEqual({ state: 'required' }); expect(api.verifyKeyString).not.toHaveBeenCalled();
    });
    it('Crypto មិនអាចផ្ទៀងផ្ទាត់ មិនមែនហត្ថលេខាខុស', async () => {
        api.verifyKeyString.mockResolvedValue({ valid: false, reason: 'verify-unavailable', unverified: true, payload });
        expect(await healthLicenseStatus()).toMatchObject({ state: 'unverified' }); expect(api.checkOnline).not.toHaveBeenCalled();
    });
    it.each(['key', 'owner', 'module'])('មិនចាប់ផ្ដើម Server បន្ទាប់ពី %s ប្ដូរ', async change => {
        const pending = deferred(); api.verifyKeyString.mockReturnValue(pending.promise); const result = healthLicenseStatus();
        if (change === 'key') api.activationKeyString.mockReturnValue('replacement'); else if (change === 'owner') owner.current = false; else window.ZoeLicense = { ...api };
        pending.resolve({ valid: true, payload }); expect(await result).toMatchObject({ state: 'unverified' }); expect(api.checkOnline).not.toHaveBeenCalled();
    });
    it('មិនបង្ហាញលទ្ធផលចាស់ពី Server', async () => {
        const pending = deferred(); api.checkOnline.mockReturnValue(pending.promise); const result = healthLicenseStatus(); await Promise.resolve(); await Promise.resolve();
        owner.current = false; pending.resolve({ ok: true, seat: 'mine', expiresAt: now + 864000000 }); expect(await result).toMatchObject({ state: 'unverified' });
    });
    it('ផុតពេល និងមិនចាប់ផ្ដើមការងារថ្មីពេល Crypto ត្រឡប់យឺត', async () => {
        vi.useFakeTimers(); const pending = deferred(); api.verifyKeyString.mockReturnValue(pending.promise); const result = healthLicenseStatus();
        await vi.advanceTimersByTimeAsync(7500); expect(await result).toMatchObject({ state: 'unverified' });
        pending.resolve({ valid: true, payload }); await Promise.resolve(); await Promise.resolve(); expect(api.checkOnline).not.toHaveBeenCalled();
    });
    it('កំហុសមិនបង្ហាញ Key', async () => {
        api.checkOnline.mockRejectedValue(new Error('private-key')); const result = await healthLicenseStatus();
        expect(result).toMatchObject({ state: 'unverified' }); expect(JSON.stringify(result)).not.toContain('private-key');
    });
    it('ផុតពេល Server មិនឆ្លើយ និងមិនយកលទ្ធផលយឺត', async () => {
        vi.useFakeTimers(); const pending = deferred(); api.checkOnline.mockReturnValue(pending.promise);
        const result = healthLicenseStatus(); await vi.advanceTimersByTimeAsync(7500);
        expect(await result).toMatchObject({ state: 'unverified' });
        pending.resolve({ ok: true, seat: 'mine', expiresAt: now + 864000000 }); await Promise.resolve();
        expect(api.checkOnline).toHaveBeenCalledTimes(1); expect(api.getServerNow).not.toHaveBeenCalled();
    });
    it('មិនយកលទ្ធផល Server បន្ទាប់ពី Key ប្ដូរ', async () => {
        const pending = deferred(); api.checkOnline.mockReturnValue(pending.promise);
        const result = healthLicenseStatus(); await Promise.resolve(); await Promise.resolve();
        api.activationKeyString.mockReturnValue('replacement');
        pending.resolve({ ok: false, reason: 'revoked' }); expect(await result).toMatchObject({ state: 'unverified' });
    });
    it.each([now - 1, now])('ផុតកំណត់ %s', async expiresAt => {
        api.checkOnline.mockResolvedValue({ ok: true, seat: 'mine', expiresAt });
        expect(await healthLicenseStatus()).toEqual({ state: 'required', reason: 'expired-server' });
    });
    it.each([undefined, null, NaN, {}, []])('ទិន្នន័យផ្ទៀងផ្ទាត់មិនគ្រប់ %j', async value => {
        api.verifyKeyString.mockResolvedValue(value); expect(await healthLicenseStatus()).toMatchObject({ state: 'unverified' });
        expect(api.checkOnline).not.toHaveBeenCalled();
    });

});
