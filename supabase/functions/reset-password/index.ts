import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.117.2/cors';
import { handleResetPassword } from '../_shared/account-core.ts';
import { adminDeps } from '../_shared/admin-deps.ts';
import { createCachedKeySource, verifyFirebasePhoneToken } from '../_shared/firebase-phone-token.ts';
import { handleHttp, readConfig } from '../_shared/http.ts';

const config = readConfig((name) => Deno.env.get(name));
const keys = createCachedKeySource(fetch);
const admin = config.ok
    ? createClient(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    : null;
const allowHeaders = corsHeaders['Access-Control-Allow-Headers'] + ', x-region';

Deno.serve((request) => handleHttp(request, config, allowHeaders, (body) => {
    if (!admin) return Promise.resolve({ status: 503, body: { ok: false, code: 'server-unconfigured' } });
    return handleResetPassword(body, {
        ...adminDeps(admin),
        verifyPhoneToken: (token) => verifyFirebasePhoneToken(token, { projectId: config.otpProjectId, keys })
    });
}));
