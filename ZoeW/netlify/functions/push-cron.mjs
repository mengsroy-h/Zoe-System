import { getStore } from '@netlify/blobs';
import { PUSH_STORE_NAME, createPushService, runPushCron } from '../lib/push-core.mjs';

export default async function pushCron() {
    const service = createPushService({ env: process.env, store: getStore({ name: PUSH_STORE_NAME, consistency: 'strong' }) });
    console.log(JSON.stringify(await runPushCron(service)));
}

export const config = { schedule: '*/5 * * * *' };
