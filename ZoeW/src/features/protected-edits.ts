import { openEditBarcodePriceModal } from './barcode-ops';
import { openEditModal } from './entry-ops';
import { captureAuthDatabaseGuard, openExchangeRateModal } from './exchange-rate';
import { requestPinBeforeConfig } from './pin';

export function requestEditBarcodePrice(itemId?, code?) {
    const isCurrent = captureAuthDatabaseGuard();
    requestPinBeforeConfig(() => {
        if (isCurrent()) openEditBarcodePriceModal(itemId, code);
    }, 'editBarcodePrice');
}

export function requestEditPhone(id?) {
    const isCurrent = captureAuthDatabaseGuard();
    requestPinBeforeConfig(() => {
        if (isCurrent()) openEditModal(id);
    }, 'editPhone');
}

export function requestEditExchangeRate() {
    const isCurrent = captureAuthDatabaseGuard();
    requestPinBeforeConfig(() => {
        if (isCurrent()) openExchangeRateModal();
    }, 'exchangeRate');
}
