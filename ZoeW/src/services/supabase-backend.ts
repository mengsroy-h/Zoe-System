import { createSupabaseSdk } from './supabase-sdk';
import { createSupabaseTransport } from './supabase-transport';

export function createZoeSupabaseSdk(env) {
    return createSupabaseSdk((cfg) => createSupabaseTransport(cfg), env);
}
