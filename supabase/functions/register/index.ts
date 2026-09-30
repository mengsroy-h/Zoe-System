import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.117.2/cors';
import { handleRegister } from '../_shared/account-core.ts';
import { adminDeps } from '../_shared/admin-deps.ts';
import { handleHttp, readConfig } from '../_shared/http.ts';

const config = readConfig((name) => Deno.env.get(name));
const admin = config.ok
    ? createClient(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    : null;
const allowHeaders = corsHeaders['Access-Control-Allow-Headers'] + ', x-region';

Deno.serve((request) => handleHttp(request, config, allowHeaders, (body) => {
    if (!admin) return Promise.resolve({ status: 503, body: { ok: false, code: 'server-unconfigured' } });
    return handleRegister(body, { ...adminDeps(admin), loginDomain: config.loginDomain });
}));
