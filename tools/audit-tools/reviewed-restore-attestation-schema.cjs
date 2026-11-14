'use strict';
const { isDeepStrictEqual } = require('node:util');
// Exact reviewed persistence introduced by the restore-attestation migration.
// These rows contain schema metadata only; no private keys, grants or user data.
const REVIEWED_ATTESTATION_RELATIONS = [
    {"schema":"private","name":"zoe_restore_attestation_events","kind":"r","rls":true,"forced_rls":false,"acl":"{postgres=arwdDxtm/postgres}","columns":[["tenant_id","uuid",true],["source_id","text",true],["revision","bigint",true],["attestation_id","text",true],["actor_uid","uuid",true],["session_id","uuid",true],["action","text",true],["verdict","text",true],["status","text",true],["source_hash","text",true],["code_set_hash","text",true],["correlation_hash","text",true],["recorded_at","timestamp with time zone",true]],"index_definition":null},
    {"schema":"private","name":"zoe_restore_attestation_events_pkey","kind":"i","rls":false,"forced_rls":false,"acl":null,"columns":[["tenant_id","uuid",false],["source_id","text",false],["revision","bigint",false]],"index_definition":"CREATE UNIQUE INDEX zoe_restore_attestation_events_pkey ON private.zoe_restore_attestation_events USING btree (tenant_id, source_id, revision)"},
    {"schema":"private","name":"zoe_restore_attestations","kind":"r","rls":true,"forced_rls":false,"acl":"{postgres=arwdDxtm/postgres}","columns":[["tenant_id","uuid",true],["source_id","text",true],["revision","bigint",true],["body","jsonb",true],["snapshot","jsonb",true],["payload_hash","text",true],["updated_at","timestamp with time zone",true]],"index_definition":null},
    {"schema":"private","name":"zoe_restore_attestations_pkey","kind":"i","rls":false,"forced_rls":false,"acl":null,"columns":[["tenant_id","uuid",false],["source_id","text",false]],"index_definition":"CREATE UNIQUE INDEX zoe_restore_attestations_pkey ON private.zoe_restore_attestations USING btree (tenant_id, source_id)"},
    {"schema":"private","name":"zoe_restore_attestor_keys","kind":"r","rls":true,"forced_rls":false,"acl":"{postgres=arwdDxtm/postgres}","columns":[["kid","text",true],["secret","bytea",true],["active","boolean",true],["created_at","timestamp with time zone",true]],"index_definition":null},
    {"schema":"private","name":"zoe_restore_attestor_keys_pkey","kind":"i","rls":false,"forced_rls":false,"acl":null,"columns":[["kid","text",false]],"index_definition":"CREATE UNIQUE INDEX zoe_restore_attestor_keys_pkey ON private.zoe_restore_attestor_keys USING btree (kid)"}
];

const attestationName = row => row.schema === 'private' && row.name.startsWith('zoe_restore_attest');
function reviewedAttestationRelations(forceRlsKey = 'forced_rls') {
    return REVIEWED_ATTESTATION_RELATIONS.map(row => {
        const copy = structuredClone(row);
        if (forceRlsKey !== 'forced_rls') { copy[forceRlsKey] = copy.forced_rls; delete copy.forced_rls; }
        return copy;
    });
}
const ENGINE_CACHE = "        ctx := private.zoe_restore_rules_cache_v1(ctx) || jsonb_build_object('now',private.zoe_now_ms());\n";
function projectAttestationEngine(definition) {
    if (definition.split(ENGINE_CACHE).length !== 2) throw new Error('Reviewed attestation engine cache changed');
    return definition.replace(ENGINE_CACHE, '');
}
function projectReviewedAttestation(catalog, forceRlsKey = 'forced_rls', engine = false) {
    if (!isDeepStrictEqual(catalog.relations.filter(attestationName), reviewedAttestationRelations(forceRlsKey)))
        throw new Error('Reviewed attestation table/index shape or ACL changed');
    return { ...catalog, relations: catalog.relations.filter(row => !attestationName(row)),
        ...(engine ? { engine: { ...catalog.engine, core: projectAttestationEngine(catalog.engine.core) } } : {}) };
}
module.exports = { reviewedAttestationRelations, projectAttestationEngine, projectReviewedAttestation };
