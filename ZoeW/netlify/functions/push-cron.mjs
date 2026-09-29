import { getStore } from '@netlify/blobs';
import { PUSH_STORE_NAME, createPushService } from '../lib/push-core.mjs';

export default async function pushCron() {
    const service = createPushService({ env: process.env, store: getStore({ name: PUSH_STORE_NAME, consistency: 'strong' }) });
    const notices = await service.dispatchNotices().catch(() => ({ ok: false, reason: 'error' }));
    const expiry = await service.dispatchExpiry().catch(() => ({ ok: false, reason: 'error' }));
    console.log(JSON.stringify({ notices: notices, expiry: expiry }));
}

export const config = { schedule: '*/5 * * * *' };
