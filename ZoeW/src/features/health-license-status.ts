import { captureConnectionOperation } from '../services/connection-flow';
import { LICENSE_APP_CODE } from './license';

export interface HealthLicenseStatus {
    state: 'active' | 'required' | 'unverified';
    reason?: string;
    exp?: number;
    daysLeft?: number;
}

export async function healthLicenseStatus(): Promise<HealthLicenseStatus> {
    const unknown = (reason = 'verify-unavailable'): HealthLicenseStatus => ({ state: 'unverified', reason });
    const licenseApi = window.ZoeLicense;
    if (!licenseApi || ['activationKeyString', 'verifyKeyString', 'checkOnline', 'getServerNow', 'getServerTimeOffset']
        .some(name => typeof licenseApi[name] !== 'function')) return unknown();
    let ended = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const operation = captureConnectionOperation();
        const key = licenseApi.activationKeyString(LICENSE_APP_CODE);
        const current = () => !ended && operation.current() && window.ZoeLicense === licenseApi
            && licenseApi.activationKeyString(LICENSE_APP_CODE) === key;
        if (!current()) return unknown();
        if (!key) return { state: 'required' };
        const clockTrusted = () => Number.isFinite(licenseApi.getServerTimeOffset()) && Number.isFinite(licenseApi.getServerNow());
        const check = async (): Promise<HealthLicenseStatus> => {
            const verified = await licenseApi.verifyKeyString(key, LICENSE_APP_CODE);
            if (!current()) return unknown();
            if (!verified || verified.unverified) return unknown();
            if (verified.valid !== true && verified.reason !== 'expired') {
                return ['format', 'signature', 'app-mismatch'].includes(verified.reason)
                    ? { state: 'required', reason: verified.reason } : unknown();
            }
            const signed = verified.payload;
            if (!signed || typeof signed.id !== 'string' || !/^[0-9A-Za-z_-]+$/.test(signed.id)
                || (signed.a !== LICENSE_APP_CODE && signed.a !== 'ALL')) return unknown();
            const online = await licenseApi.checkOnline(LICENSE_APP_CODE, signed.id, { claimSeat: false });
            if (!current()) return unknown();
            if (!online || online.ok !== true) {
                if (online?.ok === false && ['revoked', 'not-found', 'seat-taken'].includes(online.reason)) {
                    return { state: 'required', reason: online.reason };
                }
                if (online?.ok === false && online.reason === 'expired-server') {
                    return clockTrusted() ? { state: 'required', reason: 'expired-server' } : unknown('clock-unverified');
                }
                return unknown('network');
            }
            if (online.seat !== 'mine') return unknown(online.seat === 'no-device' ? 'device-unverified'
                : online.seat === 'seat-unavailable' ? 'seat-unavailable' : 'verify-unavailable');
            if (!clockTrusted()) return unknown('clock-unverified');
            const expiry = online.expiresAt;
            if (!Number.isFinite(expiry) || expiry <= 0) return unknown();
            const serverNow = licenseApi.getServerNow();
            if (!Number.isFinite(serverNow)) return unknown('clock-unverified');
            if (serverNow >= expiry) return { state: 'required', reason: 'expired-server' };
            return { state: 'active', exp: expiry, daysLeft: Math.ceil((expiry - serverNow) / 86400000) };
        };
        const deadline = new Promise<HealthLicenseStatus>(resolve => {
            timer = setTimeout(() => { ended = true; resolve(unknown('network')); }, 7500);
        });
        return await Promise.race([check(), deadline]);
    } catch {
        return unknown();
    } finally {
        ended = true;
        if (timer !== undefined) clearTimeout(timer);
    }
}
