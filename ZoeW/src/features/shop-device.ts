import { firebaseState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { loadDeviceInfo } from './device-info';

export const SHOP_DEVICE_RETRY_MS = 5 * 60 * 1000;

const shopDeviceState = { noted: '', pending: null as null | { key: string; promise: Promise<boolean> }, failedKey: '', failedAt: 0 };

function shopTenantOf(sdk, account) {
    return sdk && typeof sdk.tenantScope === 'function' ? sdk.tenantScope(account) : '';
}

export async function noteShopDevice() {
    const sdk = firebaseState.fb;
    const account = firebaseState.auth;
    if (!sdk || !sdk.__supabase || typeof sdk.noteDevice !== 'function' || !account || !account.currentUser) return false;
    const tenant = shopTenantOf(sdk, account);
    if (!tenant) return false;
    const info = await loadDeviceInfo();
    if (!info || !info.serial) return false;
    if (firebaseState.fb !== sdk || firebaseState.auth !== account || !account.currentUser || shopTenantOf(sdk, account) !== tenant) return false;
    const key = [tenant, account.currentUser.uid, info.serial, info.model, info.platform].join('|');
    if (key === shopDeviceState.noted) return true;
    if (shopDeviceState.pending && shopDeviceState.pending.key === key) return shopDeviceState.pending.promise;
    if (shopDeviceState.failedKey === key && elapsedSince(shopDeviceState.failedAt) < SHOP_DEVICE_RETRY_MS) return false;
    const promise = Promise.resolve()
        .then(() => sdk.noteDevice(account, { serial: info.serial, model: info.model, platform: info.platform }))
        .then((ok) => {
            if (ok !== true) return false;
            shopDeviceState.noted = key;
            shopDeviceState.failedKey = '';
            return true;
        }, () => {
            shopDeviceState.failedKey = key;
            shopDeviceState.failedAt = Date.now();
            return false;
        })
        .finally(() => {
            if (shopDeviceState.pending && shopDeviceState.pending.promise === promise) shopDeviceState.pending = null;
        });
    shopDeviceState.pending = { key, promise };
    return promise;
}
