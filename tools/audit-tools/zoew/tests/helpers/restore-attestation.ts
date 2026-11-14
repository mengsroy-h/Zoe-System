import { createRequire } from 'node:module';
import { firebaseState } from '../../../../../ZoeW/src/core/state';
import { liveShopScope } from '../../../../../ZoeW/src/core/shop-scope';

const require = createRequire(import.meta.url);
const { createRestoreProofHandler, PROOF_TTL_MS } = require('../../../../../ZoeW/netlify/functions/_shared/zto-restore-proof.cjs');
const { allowedTargetSlots } = require('../../../../../ZoeW/netlify/functions/_shared/zto-restore-firebase.cjs');
const core = require('../../../../../ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs');
const clone = <T>(value: T): T => value == null ? value : structuredClone(value);
const canonical = (value: any): string => JSON.stringify(value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value ?? null);
const SOURCE = 'zoew_recently_deleted_cod_dod', PROOFS = 'zoew_restore_attestations';

type Lookup = (event: any, context: any) => any;
type Policy = { v: 1; mode: 'local' | 'palm' | 'cookie'; scope: string; branch: string; epoch: number };
type Options = { get: (path: string) => any; set: (path: string, value: any) => void; policy?: Policy;
    scope?: string; actorUid?: string; lookup?: Lookup };

// Unit seam: real issuer and real lookup core; the supplied store replaces the
// trusted DB/auth adapter only. This does not simulate Firebase Rules or PG RLS.
export function createRestoreAttestationFixture(options: Options) {
    const scope = options.scope || liveShopScope();
    const actorUid = options.actorUid || firebaseState.auth?.currentUser?.uid;
    if (!scope || !actorUid) throw new Error('Attestation fixture requires an accepted owner');
    const get = (path: string) => clone(options.get(path));
    const set = (path: string, value: any) => options.set(path, clone(value));
    if (options.policy) set('zoew_restore_policy/shop', options.policy);
    let lookup: Lookup = options.lookup || core.createTrustedRestoreHandler({ getStore: () => null });
    const requests: any[] = [], answers: any[] = [], lookups: any[] = [], providerReplies: any[] = [];
    let version = 0;
    const issuerFor = (original: string | null) => createRestoreProofHandler({ env: {},
        lookup: async (event: any, context: any) => {
            lookups.push(clone(event.queryStringParameters));
            const result = await lookup({ ...event, headers: { ...event.headers, ...(original ? { 'x-zoe-id-token': original } : {}) } }, context);
            const out = result instanceof Response ? { statusCode: result.status, body: await result.text() } : result;
            let body: any;
            try { body = JSON.parse(out.body); } catch { body = {}; }
            providerReplies.push({ statusCode: out.statusCode, code: body.code, found: body.found, success: body.success,
                cached: body.cached, ztoClosed: body.ztoClosed, verifiedForRestore: body.verifiedForRestore,
                restoreTransitionsVerified: body.restoreTransitionsVerified });
            return out;
        },
        firebaseBackend: async ({ claims }: any) => {
            if (claims.sub !== actorUid) throw new Error('fixture actor mismatch');
            return {
                context: async (input: any) => {
                    if (firebaseState.auth?.currentUser?.uid !== actorUid || liveShopScope() !== scope) throw new Error('fixture owner switched');
                    const source = get(`${SOURCE}/${input.sourceId}`), policy = get('zoew_restore_policy/shop');
                    const receipt = get(`zoew_trash_consumptions/${input.sourceId}`), finalization = get(`zoew_restore_finalizations/${input.sourceId}`);
                    if (!source && receipt?.kind === 'restore' && receipt.actorUid === actorUid && receipt.scope === scope
                        && receipt.sourceId === input.sourceId && receipt.generation === input.expectedGeneration
                        && receipt.token === input.token && receipt.targetId === input.targetId
                        && finalization?.token === input.token && finalization.targetId === input.targetId) {
                        return { kind: 'already_applied' };
                    }
                    const claim = source?.restoreClaim, proof = get(`${PROOFS}/${input.sourceId}`);
                    if (claim && (claim.token !== input.token || claim.targetId !== input.targetId)) {
                        const target = get(`zoew_scan_history_cod_dod/${claim.targetId}`);
                        if (target?.restoreClaimId === input.sourceId || claim.token !== input.token && claim.claimedAt + PROOF_TTL_MS > Date.now()
                            || claim.token === input.token && input.action !== 'rebind') throw new Error('fixture foreign live claim');
                    }
                    if (proof && proof.actorUid !== actorUid) throw new Error('fixture foreign proof');
                    return { v: 1, backend: 'fixture', scope, actorUid, branch: policy?.branch, policy, source,
                        attestation: proof, expectedRevision: proof?.revision ?? 0, version, expiresAt: Date.now() + 3600000 };
                },
                apply: async (input: any, context: any, verdict: string, id: string) => {
                    if (version !== context.version || canonical(get(`${SOURCE}/${input.sourceId}`)) !== canonical(context.source)
                        || canonical(get('zoew_restore_policy/shop')) !== canonical(context.policy)) throw new Error('fixture source CAS lost');
                    const previous = get(`${PROOFS}/${input.sourceId}`);
                    if ((previous?.revision ?? 0) !== context.expectedRevision) throw new Error('fixture proof CAS lost');
                    if (previous?.status === 'deny' && previous.generation === input.expectedGeneration) verdict = previous.verdict;
                    const status = verdict === 'allow' ? 'allow' : verdict === 'unconfirmed' ? 'hold' : 'deny';
                    const expiresAt = Date.now() + PROOF_TTL_MS;
                    const grant = { v: 1, id, revision: context.expectedRevision + 1, actorUid, scope, branch: context.branch,
                        sourceId: input.sourceId, generation: input.expectedGeneration, token: input.token, targetId: input.targetId,
                        deletedAt: context.source.deletedAt, rowBirth: context.source.createdAt ?? 0, status, verdict,
                        issuedAt: Date.now(), expiresAt, policyEpoch: context.policy.epoch, snapshot: clone(context.source),
                        codes: Object.fromEntries(Object.values(context.source.barcodes || {}).map((row: any) => [row.code, true])),
                        allowedTargetSlots: allowedTargetSlots(context.source, get(`zoew_scan_history_cod_dod/${input.targetId}`)) };
                    set(`${PROOFS}/${input.sourceId}`, grant);
                    if (input.action === 'release') {
                        if (get(`zoew_scan_history_cod_dod/${input.targetId}`)?.restoreClaimId === input.sourceId) throw new Error('fixture prepared target holds claim');
                        const source = clone(context.source);
                        delete source.restoreClaim; delete source.restoreAttestationId;
                        set(`${SOURCE}/${input.sourceId}`, source); version++;
                        return { v: 1, success: true, kind: 'released', source };
                    }
                    const source = { ...context.source, restoreAttestationId: id,
                        restoreClaim: { token: input.token, targetId: input.targetId, claimedAt: Date.now() } };
                    if (status === 'deny' && verdict === 'signed') source.restoreBlocked = true;
                    set(`${SOURCE}/${input.sourceId}`, source); version++;
                    return { v: 1, success: true, kind: status === 'allow' ? 'allow' : 'deny', attestationId: id, expiresAt, source };
                }
            };
        }
    });
    return {
        requests, answers, lookups, providerReplies, get, set,
        setLookup(next: Lookup) { lookup = next; },
        source(item: any, id = item.id || 'restore_source') {
            const value = { createdAt: Date.now() - 10000, deletedAt: Date.now() - 1000, ...clone(item), id };
            if (!get(`${SOURCE}/${id}`)) set(`${SOURCE}/${id}`, value);
            return { ...value, ...(get(`${SOURCE}/${id}`) || {}) };
        },
        operation(targetId = 'restore_target') {
            const generation = firebaseState.authGeneration, db = firebaseState.db, api = firebaseState.fb;
            return { token: 'fixture_restore_attempt', targetId, current: () => generation === firebaseState.authGeneration
                && db === firebaseState.db && api === firebaseState.fb && firebaseState.auth?.currentUser?.uid === actorUid && liveShopScope() === scope };
        },
        async route(input: any, init: any = {}) {
            const url = new URL(String(input));
            if (!url.pathname.endsWith('/zto-restore-proof')) throw new Error('fixture unexpected issuer route');
            const body = JSON.parse(init.body || '{}'); requests.push(clone(body));
            const headers = new Headers(init.headers);
            // Only issuer routing/auth is the explicit unit seam. Actual lookup
            // retains the original caller headers; malformed provider proof is
            // never completed or converted into an ALLOW by this fixture.
            const original = headers.get('x-zoe-id-token');
            const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
            headers.set('x-zoe-id-token', `${encode({ alg: 'fixture' })}.${encode({ sub: actorUid, iss: 'fixture' })}.fixture`);
            const response = await issuerFor(original)(new Request(url, { ...init, headers }));
            answers.push({ status: response.status, body: await response.clone().json() });
            return response;
        }
    };
}
