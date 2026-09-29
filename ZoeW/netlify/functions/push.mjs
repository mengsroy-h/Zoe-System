import { getStore } from '@netlify/blobs';
import { PUSH_STORE_NAME, createPushService, handlePushRequest, jsonResponse } from '../lib/push-core.mjs';

export default async function push(req) {
    let service;
    try {
        service = createPushService({ env: process.env, store: getStore({ name: PUSH_STORE_NAME, consistency: 'strong' }) });
    } catch (_) {
        return jsonResponse(503, { ok: false, reason: 'store:unavailable' });
    }
    try {
        return await handlePushRequest(req, service);
    } catch (_) {
        return jsonResponse(500, { ok: false, reason: 'error' });
    }
}
