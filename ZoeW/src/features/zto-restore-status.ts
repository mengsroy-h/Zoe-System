import { barcodeEntriesOf, barcodeZtoSigned } from '../domain/barcode';
import { pickupBarcodeKey } from '../domain/pickup';
import { fetchWithTimeout } from '../services/network';
import { addZtoIdentityHeader, buildLookupRequestHeaders } from './lookup-api';
import { getLookupApiConfig, getShopZtoTrashMode, getZtoTrashMode } from './lookup-config';
import { captureZtoSession, setZtoPickupVerdict } from './zto-status';
import { ZTO_AUTO_LOOKUP_TIMEOUT_MS } from './auto-lookup';

export async function verifyZtoRestoreStatus(item) {
    const mode = getShopZtoTrashMode();
    if (!mode) throw new Error('RESTORE_SHOP_MODE_UNSYNCED');
    if (mode === 'palm' || item?.trashMode === 'palm' || item?.restoreBlocked === true) return;
    const barcodes = barcodeEntriesOf(item?.barcodes).map(({ barcode }) => barcode);
    if (barcodes.some(barcodeZtoSigned)) return;
    if (mode !== 'cookie' && item?.trashMode !== 'cookie') return;
    if (getZtoTrashMode() !== 'cookie') throw new Error('RESTORE_ZTO_NEEDS_LOOKUP');
    if (navigator.onLine === false) throw new Error('RESTORE_ZTO_UNVERIFIED');
    const cfg = getLookupApiConfig();
    const signature = JSON.stringify(cfg);
    const session = captureZtoSession();
    const current = () => session.current() && JSON.stringify(getLookupApiConfig()) === signature;
    const codes = [...new Set(barcodes.map((b) => pickupBarcodeKey(b.code)).filter(Boolean))];
    if (!codes.length) throw new Error('RESTORE_ZTO_UNVERIFIED');
    let next = 0;
    let signed = false;
    const worker = async () => {
        while (next < codes.length && !signed) {
            if (!current()) throw new Error('RESTORE_SESSION_SWITCHED');
            const code = codes[next++];
            const url = new URL(cfg.url.replace('{barcode}', encodeURIComponent(code)), window.location.href);
            url.searchParams.set('restore', '1');
            const headers = await buildLookupRequestHeaders(cfg);
            await addZtoIdentityHeader(cfg, headers);
            if (!current()) throw new Error('RESTORE_SESSION_SWITCHED');
            let out;
            try {
                out = await fetchWithTimeout(url.href, { headers }, ZTO_AUTO_LOOKUP_TIMEOUT_MS,
                    'ZTO restore verification timed out', (r) => r.json().catch(() => null));
            } catch { throw new Error('RESTORE_ZTO_UNVERIFIED'); }
            if (!current()) throw new Error('RESTORE_SESSION_SWITCHED');
            const body = out.body;
            const answered = out.res.ok && !!body && typeof body === 'object' && body.cached === false && pickupBarcodeKey(body.barcode) === code;
            if (answered && body.found === false && body.code === 'ZTO_NOT_FOUND') continue;
            if (answered && body.found === false && body.code === 'ZTO_NO_CUSTOMER_DATA' && typeof body.ztoClosed === 'boolean') {
                setZtoPickupVerdict(code, body.ztoClosed);
                if (body.ztoClosed) signed = true;
                continue;
            }
            if (!answered || body.success !== true || body.found !== true || body.verifiedForRestore !== true
                || typeof body.ztoClosed !== 'boolean') throw new Error(answered ? 'RESTORE_ZTO_UNCONFIRMED' : 'RESTORE_ZTO_UNVERIFIED');
            setZtoPickupVerdict(code, body.ztoClosed, body.ztoSignedAt);
            if (body.ztoClosed) signed = true;
        }
    };
    const results = await Promise.allSettled(Array.from({ length: Math.min(3, codes.length) }, worker));
    if (!current()) throw new Error('RESTORE_SESSION_SWITCHED');
    if (signed) throw new Error('RESTORE_ZTO_FINAL');
    const failure = results.find((r) => r.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
}
