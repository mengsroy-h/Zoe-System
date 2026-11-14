'use strict';
const { isDeepStrictEqual } = require('node:util');
const REVIEWED_AUDIT_RELATIONS = [
    {"schema":"public","name":"zoe_business_audit","kind":"r","rls":true,"forced_rls":false,"acl":"{postgres=arwdDxtm/postgres,authenticated=r/postgres}","columns":[["event_id","uuid",true],["archive_seq","bigint",true],["archive_imported_at","timestamp with time zone",false],["schema_version","smallint",true],["tenant_id","uuid",true],["origin_tenant_id","uuid",true],["operation_id","text",true],["seq","bigint",true],["actor_uid","uuid",false],["actor_kind","text",true],["origin","text",true],["root","text",true],["record_key","text",true],["action","text",true],["reason","text",true],["status_source","text",true],["previous_status","jsonb",true],["new_status","jsonb",true],["before_value","jsonb",true],["after_value","jsonb",true],["changed_fields","text[]",true],["changed_fields_truncated","boolean",true],["summary_unchanged","boolean",true],["projection_scope","text",true],["committed_at","timestamp with time zone",true]],"index_definition":null},
    {"schema":"public","name":"zoe_business_audit_archive_order","kind":"i","rls":false,"forced_rls":false,"acl":null,"columns":[["tenant_id","uuid",false],["archive_seq","bigint",false]],"index_definition":"CREATE UNIQUE INDEX zoe_business_audit_archive_order ON public.zoe_business_audit USING btree (tenant_id, archive_seq)"},
    {"schema":"public","name":"zoe_business_audit_archive_seq_seq","kind":"S","rls":false,"forced_rls":false,"acl":"{postgres=rwU/postgres}","columns":[["last_value","bigint",true],["log_cnt","bigint",true],["is_called","boolean",true]],"index_definition":null},
    {"schema":"public","name":"zoe_business_audit_operation","kind":"i","rls":false,"forced_rls":false,"acl":null,"columns":[["tenant_id","uuid",false],["operation_id","text",false],["event_id","uuid",false]],"index_definition":"CREATE INDEX zoe_business_audit_operation ON public.zoe_business_audit USING btree (tenant_id, operation_id, event_id)"},
    {"schema":"public","name":"zoe_business_audit_pkey","kind":"i","rls":false,"forced_rls":false,"acl":null,"columns":[["tenant_id","uuid",false],["event_id","uuid",false]],"index_definition":"CREATE UNIQUE INDEX zoe_business_audit_pkey ON public.zoe_business_audit USING btree (tenant_id, event_id)"},
    {"schema":"public","name":"zoe_business_audit_record","kind":"i","rls":false,"forced_rls":false,"acl":null,"columns":[["tenant_id","uuid",false],["root","text",false],["record_key","text",false],["committed_at","timestamp with time zone",false],["event_id","uuid",false]],"index_definition":"CREATE INDEX zoe_business_audit_record ON public.zoe_business_audit USING btree (tenant_id, root, record_key, committed_at DESC, event_id)"},
    {"schema":"public","name":"zoe_business_audit_tenant_time","kind":"i","rls":false,"forced_rls":false,"acl":null,"columns":[["tenant_id","uuid",false],["committed_at","timestamp with time zone",false],["event_id","uuid",false]],"index_definition":"CREATE INDEX zoe_business_audit_tenant_time ON public.zoe_business_audit USING btree (tenant_id, committed_at DESC, event_id)"}
];
const auditName = row => row.schema === 'public' && row.name.startsWith('zoe_business_audit');
const reviewedAuditRelations = (forceRlsKey = 'forced_rls') => REVIEWED_AUDIT_RELATIONS.map(row => {
    const copy = structuredClone(row);
    if (forceRlsKey !== 'forced_rls') { copy[forceRlsKey] = copy.forced_rls; delete copy.forced_rls; }
    return copy;
});
function projectAuditEngine(definition) {
    const additions = [
        ["    prior_audit_context text := current_setting('zoe.audit_context', true);\n", 1],
        ["    perform set_config('zoe.audit_context', jsonb_build_object('tenant',tenant,'operation',p_op_id,'origin',case when p_enforce then 'app_engine' else 'admin_engine' end)::text, true);\n", 1],
        ["    perform set_config('zoe.audit_context', coalesce(prior_audit_context, ''), true);\n", 4]
    ];
    let projected = definition;
    for (const [fragment, count] of additions) {
        if (projected.split(fragment).length - 1 !== count) throw new Error('Reviewed audit engine context changed');
        projected = projected.split(fragment).join('');
    }
    return projected;
}
function projectReviewedBusinessAudit(catalog, forceRlsKey = 'forced_rls', engine = false) {
    if (!isDeepStrictEqual(catalog.relations.filter(auditName), reviewedAuditRelations(forceRlsKey)))
        throw new Error('Reviewed audit table/index/sequence shape or ACL changed');
    return { ...catalog, relations: catalog.relations.filter(row => !auditName(row)),
        ...(engine ? { engine: { ...catalog.engine, core: projectAuditEngine(catalog.engine.core) } } : {}) };
}
const definesRulesFunction = source => /\bcreate\s+(?:or\s+replace\s+)?function\s+(?:(?:"(?:[^"]|"")+"|[a-z_][a-z_0-9]*)\s*\.\s*)?(?:"zoe_rules"|zoe_rules)\s*\(/i.test(source);
module.exports = { reviewedAuditRelations, projectAuditEngine, projectReviewedBusinessAudit, definesRulesFunction };
