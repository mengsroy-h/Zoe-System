import { getStore } from '@netlify/blobs';
import { createSeatStageService, handleSeatStageRequest, SEAT_STAGE_STORE } from '../lib/license-seat-stage.mjs';

export default async function licenseSeatStage(request) {
    if (process.env.ZOE_LICENSE_SEAT_STAGE !== 'enabled') return handleSeatStageRequest(request, createSeatStageService());
    try {
        const store = getStore({ name: SEAT_STAGE_STORE, consistency: 'strong' });
        return await handleSeatStageRequest(request, createSeatStageService({ store, enabled: true }));
    } catch {
        return handleSeatStageRequest(request, createSeatStageService());
    }
}
