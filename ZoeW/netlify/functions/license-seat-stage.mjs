import { getStore } from '@netlify/blobs';
import { createSeatStageService, handleSeatStageRequest, SEAT_STAGE_STORE, SEAT_AUDIENCE } from '../lib/license-seat-stage.mjs';

export default async function licenseSeatStage(request, context) {
    if (process.env.ZOE_LICENSE_SEAT_STAGE !== 'enabled' || context?.deploy?.context !== 'production' || new URL(request.url).origin !== SEAT_AUDIENCE) return handleSeatStageRequest(request, createSeatStageService());
    try {
        let receiptPrivateJwk = null;
        try { receiptPrivateJwk = JSON.parse(process.env.ZOE_LICENSE_SEAT_RECEIPT_PRIVATE_JWK || 'null'); } catch {}
        const store = getStore({ name: SEAT_STAGE_STORE, consistency: 'strong' });
        return await handleSeatStageRequest(request, createSeatStageService({ store, enabled: true, receiptPrivateJwk }));
    } catch {
        return handleSeatStageRequest(request, createSeatStageService());
    }
}
