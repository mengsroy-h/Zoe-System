create or replace function private.zoe_restore_first_commit_v1() returns trigger
language plpgsql volatile security definer set search_path=''
as $$
<<restore_commit>>
declare source_id text;body jsonb;source jsonb;policy jsonb;current_value jsonb;required boolean;now_ms bigint;
begin
    if current_setting('zoe.internal_write',true)='admin_engine' then return null;end if;
    if new.root not in ('zoew_recently_deleted_cod_dod','zoew_scan_history_cod_dod','zoew_trash_consumptions') or new.value is null then return null;end if;
    if tg_op='UPDATE' and new.value is not distinct from old.value then return null;end if;
    select d.value into current_value from public.zoe_docs d where d.tenant_id=new.tenant_id and d.root=new.root and d.key=new.key;
    if current_value is distinct from new.value then return null;end if;
    if new.root='zoew_recently_deleted_cod_dod' then
        if not(new.value ? 'restoreAttestationId') then return null;end if;
        if tg_op='UPDATE' and old.value is not null
            and (new.value -> 'restoreAttestationId') is not distinct from (old.value -> 'restoreAttestationId')
            and (new.value -> 'restoreClaim') is not distinct from (old.value -> 'restoreClaim') then return null;end if;
        source_id:=new.key;
    elsif new.root='zoew_scan_history_cod_dod' then
        if not(new.value ? 'restoreClaimId') then return null;end if;
        source_id:=new.value->>'restoreClaimId';
    else
        if new.value->>'kind'<>'restore' then return null;end if;
        source_id:=new.key;
    end if;
    select d.value into policy from public.zoe_docs d where d.tenant_id=new.tenant_id and d.root='zoew_restore_policy' and d.key='shop';
    select a.body into body from private.zoe_restore_attestations a where a.tenant_id=new.tenant_id and a.source_id=restore_commit.source_id;
    select d.value into source from public.zoe_docs d where d.tenant_id=new.tenant_id and d.root='zoew_recently_deleted_cod_dod' and d.key=source_id;
    required:=policy->>'mode' in ('palm','cookie') or source->>'trashMode' in ('palm','cookie')
        or body is not null and (body->'generation'=coalesce(source->'trashGeneration','0'::jsonb) and source is not null
            or new.root='zoew_trash_consumptions' and body->'generation'=new.value->'generation');
    if not coalesce(required,false) or body is null then return null;end if;
    if new.root='zoew_recently_deleted_cod_dod' and body->>'status' in ('hold','deny') then return null;end if;
    now_ms:=private.zoe_now_ms();
    if private.current_tenant_id() is distinct from new.tenant_id then raise exception 'restore-session-unowned' using errcode='42501';end if;
    if not private.zoe_restore_policy_ok_v1(policy) or body is null or body->>'status'<>'allow'
        or body->>'actorUid' is distinct from auth.uid()::text or body->>'sessionId' is distinct from auth.jwt()->>'session_id'
        or body->'policyEpoch' is distinct from policy->'epoch' or body->>'scope' is distinct from policy->>'scope'
        or (body->>'expiresAt')::bigint<=now_ms or (body->>'issuedAt')::bigint>now_ms+10000 then
        raise exception 'restore-attestation-expired-or-unowned' using errcode='42501';
    end if;
    if new.root='zoew_trash_consumptions' then
        if new.value->>'token' is distinct from body->>'token' or new.value->>'targetId' is distinct from body->>'targetId'
            or new.value->'generation' is distinct from body->'generation' or new.value->'deletedAt' is distinct from body->'deletedAt'
            or new.value->'rowBirth' is distinct from body->'rowBirth' then raise exception 'restore-attestation-source-conflict' using errcode='42501';end if;
    elsif source->>'restoreAttestationId' is distinct from body->>'id' or source#>>'{restoreClaim,token}' is distinct from body->>'token'
        or source#>>'{restoreClaim,targetId}' is distinct from body->>'targetId' then raise exception 'restore-attestation-source-conflict' using errcode='42501';end if;
    return null;
end $$;
revoke all on function private.zoe_restore_first_commit_v1() from public,anon,authenticated,service_role;

create or replace function private.zoe_restore_attest_v1(p_envelope text,p_signature text) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
<<restore_apply>>
declare
    fields text[]:=array['v','kid','action','tenantId','actorUid','sessionId','scope','branch','sourceId','token','targetId','attestationId','mode','policyEpoch','expectedRevision','expectedSource','verdict','issuedAt','expiresAt'];
    tenant uuid:=private.current_tenant_id();actor uuid:=auth.uid();sid text:=auth.jwt()->>'session_id';envelope jsonb;ctx jsonb;source jsonb;target jsonb;policy jsonb;
    prior private.zoe_restore_attestations;body jsonb;new_source jsonb;maps jsonb;now_ms bigint;issued bigint;expires bigint;generation bigint;revision bigint;payload_hash text;
    source_id text;token text;target_id text;attestation_id text;action text;verdict text;mode text;status text;old_target jsonb;old_generation bigint;
    rebased_terminal boolean:=false;grant_actor uuid:=actor;grant_sid text:=sid;source_decision text;
    prior_context text:=current_setting('zoe.audit_context',true);prior_origin text:=current_setting('zoe.internal_write',true);operation text;changed boolean;
begin
    if tenant is null then raise exception 'forbidden' using errcode='42501';end if;
    if p_envelope is null or octet_length(p_envelope)>4194304 then raise exception 'restore-envelope-invalid' using errcode='22023';end if;
    begin envelope:=p_envelope::jsonb;exception when invalid_text_representation then raise exception 'restore-envelope-invalid' using errcode='22023';end;
    if jsonb_typeof(envelope)<>'object' or not(envelope ?& fields) or (select count(*) from jsonb_object_keys(envelope))<>cardinality(fields)
        or envelope->'v' is distinct from '1'::jsonb or envelope->>'tenantId' is distinct from tenant::text or envelope->>'actorUid' is distinct from actor::text
        or envelope->>'sessionId' is distinct from sid or envelope->>'kid' !~ '^[A-Za-z0-9_-]{1,32}$'
        or (envelope->>'action' in ('authorize','refresh','rebind','release')) is not true or (envelope->>'verdict' in ('allow','signed','returned','unconfirmed')) is not true
        or jsonb_typeof(envelope->'issuedAt') is distinct from 'number' or jsonb_typeof(envelope->'expiresAt') is distinct from 'number'
        or jsonb_typeof(envelope->'expectedRevision') is distinct from 'number' or jsonb_typeof(envelope->'expectedSource') is distinct from 'object'
        or envelope->>'attestationId' !~ '^[A-Za-z0-9_-]{16,128}$' then raise exception 'restore-envelope-invalid' using errcode='22023';end if;
    if not exists(select 1 from private.zoe_restore_attestor_keys where kid=envelope->>'kid' and active) then raise exception 'restore-attestor-unavailable' using errcode='PT503';end if;
    if not private.zoe_restore_signature_v1(p_envelope,p_signature,envelope->>'kid') then raise exception 'restore-signature-invalid' using errcode='42501';end if;
    source_id:=envelope->>'sourceId';token:=envelope->>'token';target_id:=envelope->>'targetId';attestation_id:=envelope->>'attestationId';action:=envelope->>'action';verdict:=envelope->>'verdict';
    if (envelope->>'expectedRevision')::numeric not between 0 and 9007199254740989 or (envelope->>'expectedRevision')::numeric<>trunc((envelope->>'expectedRevision')::numeric)
        or (envelope->>'issuedAt')::numeric not between 1 and 9007199254740990 or (envelope->>'issuedAt')::numeric<>trunc((envelope->>'issuedAt')::numeric)
        or (envelope->>'expiresAt')::numeric not between 1 and 9007199254740990 or (envelope->>'expiresAt')::numeric<>trunc((envelope->>'expiresAt')::numeric) then raise exception 'restore-envelope-invalid' using errcode='22023';end if;
    issued:=(envelope->>'issuedAt')::bigint;expires:=(envelope->>'expiresAt')::bigint;payload_hash:=encode(sha256(convert_to(p_envelope,'UTF8')),'hex');
    insert into public.zoe_tenant_state(tenant_id) values(tenant) on conflict do nothing;
    perform 1 from public.zoe_tenant_state where tenant_id=tenant for update;
    now_ms:=private.zoe_now_ms();
    ctx:=private.zoe_restore_context_v1(source_id,token,target_id,private.zoe_restore_generation_v1(envelope->'expectedSource'));
    if ctx->>'kind'='already_applied' then return ctx;end if;
    source:=ctx->'source';policy:=ctx->'policy';target:=ctx->'target';
    source_decision:=source->>'ztoTerminalDecision';
    if source ? 'ztoTerminalDecision' and (jsonb_typeof(source->'ztoTerminalDecision') is distinct from 'string' or (source_decision in ('signed','returned')) is not true) then raise exception 'restore-source-conflict' using errcode='PT409';end if;
    select * into prior from private.zoe_restore_attestations a where a.tenant_id=tenant and a.source_id=restore_apply.source_id for update;
    if prior.payload_hash=payload_hash and (prior.body->>'status'<>'deny' and source_decision is null
        or prior.body->>'status'='deny' and (prior.body->>'verdict'=source_decision or prior.body->>'verdict'='signed' and source_decision='returned')) then
        if action='release' and not(source ? 'restoreAttestationId') then return private.zoe_restore_reply_v1(prior.body,source,'released');end if;
        if prior.body->>'status'='deny' and prior.body->'generation'=to_jsonb(private.zoe_restore_generation_v1(source))
            and prior.body->'deletedAt'=source->'deletedAt' and prior.body->'rowBirth'=coalesce(source->'createdAt','0'::jsonb) then return private.zoe_restore_reply_v1(prior.body,source);end if;
        if source->>'restoreAttestationId'=prior.body->>'id' and source#>>'{restoreClaim,token}'=token and source#>>'{restoreClaim,targetId}'=target_id then
            return private.zoe_restore_reply_v1(prior.body,source);
        end if;
    end if;
    generation:=private.zoe_restore_generation_v1(source);
    old_generation:=case when prior.body is null then null else (prior.body->>'generation')::bigint end;
    if source is distinct from envelope->'expectedSource' then
        if verdict in ('signed','returned') and old_generation=generation
            and private.zoe_restore_generation_v1(envelope->'expectedSource')=generation
            and (source ? 'restoreAttestationId' and prior.body->>'id'=source->>'restoreAttestationId'
                and prior.body->>'token'=source#>>'{restoreClaim,token}' and prior.body->>'targetId'=source#>>'{restoreClaim,targetId}'
                or not(source ? 'restoreAttestationId') and not(source ? 'restoreClaim') and prior.body->>'status'='deny')
            and prior.body->'deletedAt'=source->'deletedAt' and prior.body->'rowBirth'=coalesce(source->'createdAt','0'::jsonb)
            and private.zoe_restore_terminal_business_v1(envelope->'expectedSource',source,source_id) then
            rebased_terminal:=true;token:=prior.body->>'token';target_id:=prior.body->>'targetId';attestation_id:=prior.body->>'id';
            grant_actor:=(prior.body->>'actorUid')::uuid;grant_sid:=prior.body->>'sessionId';
        else raise exception 'restore-source-conflict' using errcode='PT409';end if;
    end if;
    if source_decision='signed' or source_decision='returned' and verdict in ('allow','unconfirmed') then verdict:=source_decision;end if;
    mode:=case when source->>'trashMode' in ('palm','cookie') then source->>'trashMode' else policy->>'mode' end;
    if mode='local' then raise exception 'restore-local-client-flow' using errcode='PT409';end if;
    if envelope->>'mode' is distinct from mode or envelope->'policyEpoch' is distinct from policy->'epoch'
        or envelope->>'scope' is distinct from policy->>'scope' or envelope->>'branch' is distinct from ctx->>'branch'
        or policy->>'branch' is distinct from ctx->>'branch' or envelope->>'scope' not like '%#'||tenant::text then raise exception 'restore-policy-conflict' using errcode='PT409';end if;
    if issued>now_ms+10000 or issued<now_ms-120000 or expires<=issued or expires-issued>120000
        or (action<>'release' and verdict='allow' and expires<=now_ms) then raise exception 'restore-attestation-expired' using errcode='PT409';end if;
    if prior.revision is distinct from (envelope->>'expectedRevision')::bigint and not(prior.revision is null and (envelope->>'expectedRevision')::bigint=0)
        and not(verdict in ('signed','returned') and old_generation=generation) then raise exception 'restore-attestation-conflict' using errcode='PT409';end if;
    if source ? 'restoreAttestationId' then
        if prior.body is null or source->>'restoreAttestationId' is distinct from prior.body->>'id'
            or old_generation is distinct from generation then raise exception 'restore-attestation-source-unbound' using errcode='PT409';end if;
        if prior.body->>'actorUid' is distinct from actor::text and not rebased_terminal then
            if coalesce((source#>>'{restoreClaim,claimedAt}')::numeric,now_ms)>now_ms-120000 then raise exception 'restore-claim-owned' using errcode='PT409';end if;
        end if;
    end if;
    if source ? 'restoreClaim' then
        if source#>>'{restoreClaim,token}' is distinct from token then
            if coalesce((source#>>'{restoreClaim,claimedAt}')::numeric,now_ms)>now_ms-120000 then raise exception 'restore-claim-owned' using errcode='PT409';end if;
        end if;
        if source#>>'{restoreClaim,targetId}' is distinct from target_id or action='release' or source#>>'{restoreClaim,token}' is distinct from token then
            select d.value into old_target from public.zoe_docs d where d.tenant_id=tenant and d.root='zoew_scan_history_cod_dod' and d.key=source#>>'{restoreClaim,targetId}';
            if old_target->>'restoreClaimId'=source_id then raise exception 'restore-target-prepared' using errcode='PT409';end if;
        end if;
    elsif action in ('refresh','rebind','release') then raise exception 'restore-claim-missing' using errcode='PT409';end if;
    if action='release' then
        if not(source ? 'restoreAttestationId') or prior.body is null then raise exception 'restore-attestation-source-unbound' using errcode='PT409';end if;
        if source#>>'{restoreClaim,token}' is distinct from token or source#>>'{restoreClaim,targetId}' is distinct from target_id then raise exception 'restore-claim-conflict' using errcode='PT409';end if;
        body:=prior.body;status:=case when body->>'status'='deny' then 'deny' else 'hold' end;verdict:=coalesce(body->>'verdict','unconfirmed');new_source:=source-'restoreAttestationId'-'restoreClaim';
    else
        if old_generation=generation and prior.body->>'status'='deny' and (prior.body->>'verdict'='signed' or verdict<>'signed') then
            if source_decision=prior.body->>'verdict' then return private.zoe_restore_reply_v1(prior.body,source);end if;
            body:=prior.body;status:='deny';verdict:=body->>'verdict';new_source:=source;
        else
        if verdict in ('allow','unconfirmed') and (source->'restoreBlocked'='true'::jsonb or source->>'trashMode'='palm' and source->>'trashReason'='pickup') then raise exception 'restore-source-blocked' using errcode='PT409';end if;
        if old_generation=generation and prior.body is not null and source ? 'restoreAttestationId' and attestation_id<>source->>'restoreAttestationId' then raise exception 'restore-attestation-conflict' using errcode='PT409';end if;
        status:=case verdict when 'allow' then 'allow' when 'unconfirmed' then 'hold' else 'deny' end;
        maps:=case when status='allow' then private.zoe_restore_code_maps_v1(source||jsonb_build_object('id',source_id),target) else jsonb_build_object('codes','{}'::jsonb,'allowedTargetSlots','{}'::jsonb) end;
        body:=jsonb_build_object('v',1,'id',attestation_id,'sourceId',source_id,'generation',generation,'deletedAt',source->'deletedAt','rowBirth',case when jsonb_typeof(source->'createdAt')='number' then source->'createdAt' else '0'::jsonb end,
            'token',token,'targetId',target_id,'actorUid',grant_actor,'sessionId',grant_sid,'authTime',null,'scope',policy->'scope','branch',ctx->'branch','mode',mode,'policyEpoch',policy->'epoch',
            'issuedAt',issued,'expiresAt',expires,'status',status,'verdict',verdict,'sourceHash',encode(sha256(convert_to(source::text,'UTF8')),'hex'),
            'codeSetHash',encode(sha256(convert_to((maps->'codes')::text,'UTF8')),'hex'))||maps;
        new_source:=source;
        if status='allow' or source ? 'restoreAttestationId' then
            new_source:=source||jsonb_build_object('id',source_id,'restoreAttestationId',attestation_id,'restoreClaim',jsonb_build_object('token',token,'targetId',target_id,
                'claimedAt',case when source#>>'{restoreClaim,token}'=token and source#>>'{restoreClaim,targetId}'=target_id then source#>'{restoreClaim,claimedAt}' else to_jsonb(now_ms) end));
        end if;
        if verdict='signed' then new_source:=new_source||jsonb_build_object('restoreBlocked',true);end if;
        end if;
    end if;
    if source_decision='signed' or verdict='signed' then verdict:='signed';
    elsif source_decision='returned' or verdict='returned' then verdict:='returned';end if;
    if verdict in ('signed','returned') then
        status:='deny';body:=body||jsonb_build_object('verdict',verdict);new_source:=new_source||jsonb_build_object('ztoTerminalDecision',verdict);
        if verdict='signed' then new_source:=new_source||jsonb_build_object('restoreBlocked',true);end if;
    end if;
    revision:=coalesce(prior.revision,0)+1;body:=body||jsonb_build_object('revision',revision,'status',status);
    insert into private.zoe_restore_attestations as a(tenant_id,source_id,revision,body,snapshot,payload_hash)
        values(tenant,source_id,revision,body,source,payload_hash)
        on conflict on constraint zoe_restore_attestations_pkey do update set revision=excluded.revision,body=excluded.body,snapshot=excluded.snapshot,payload_hash=excluded.payload_hash,updated_at=clock_timestamp();
    insert into private.zoe_restore_attestation_events(tenant_id,source_id,revision,attestation_id,actor_uid,session_id,action,verdict,status,source_hash,code_set_hash,correlation_hash)
        values(tenant,source_id,revision,body->>'id',actor,sid::uuid,action,verdict,status,body->>'sourceHash',body->>'codeSetHash',encode(sha256(convert_to(token,'UTF8')),'hex'));
    if new_source is distinct from source then
        operation:='attest_'||substr(payload_hash,1,48);
        perform set_config('zoe.internal_write','',true);
        perform set_config('zoe.audit_context',jsonb_build_object('tenant',tenant,'operation',operation,'origin','app_engine')::text,true);
        update public.zoe_docs set value=new_source where tenant_id=tenant and root='zoew_recently_deleted_cod_dod' and key=source_id;
        perform set_config('zoe.internal_write',coalesce(prior_origin,''),true);
        perform set_config('zoe.audit_context',coalesce(prior_context,''),true);
    end if;
    return private.zoe_restore_reply_v1(body,new_source,case when action='release' then 'released' else null end);
exception when others then
    perform set_config('zoe.internal_write',coalesce(prior_origin,''),true);
    perform set_config('zoe.audit_context',coalesce(prior_context,''),true);
    raise;
end $$;
revoke all on function private.zoe_restore_attest_v1(text,text) from public,anon,authenticated,service_role;
grant execute on function private.zoe_restore_attest_v1(text,text) to authenticated;

create or replace function public.zoe_pull_delta(p_since bigint, p_limit integer default 2000, p_full_head bigint default null)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
    result jsonb := public.zoe_pull(p_since, p_limit, p_full_head);
    tenant uuid := private.current_tenant_id();
    rows_out jsonb;
begin
    if p_since <= 0 or p_full_head is not null or (result ->> 'reset')::boolean then return result; end if;
    select coalesce(jsonb_agg(
        case when jsonb_typeof(r.row_value -> 'v') = 'object' and exists (
            select 1 from private.zoe_daily_delta_heads h where h.tenant_id = tenant
                and h.root = r.row_value ->> 'r' and h.key = r.row_value ->> 'k' and h.base_seq <= p_since
        ) then
            (r.row_value - 'v') || jsonb_build_object('d', coalesce((
                select jsonb_agg(jsonb_build_object('p', d.path, 'v', d.value) order by d.seq, d.path)
                from private.zoe_daily_deltas d where d.tenant_id = tenant
                    and d.root = r.row_value ->> 'r' and d.key = r.row_value ->> 'k'
                    and d.seq > p_since and d.seq <= (r.row_value ->> 's')::bigint
            ), '[]'::jsonb))
        else r.row_value end
        order by r.ord
    ), '[]'::jsonb)
    into rows_out
    from jsonb_array_elements(result -> 'rows') with ordinality as r(row_value, ord);
    return jsonb_set(result, '{rows}', rows_out);
end
$$;
revoke all on function public.zoe_pull_delta(bigint, integer, bigint) from public, anon, authenticated, service_role;
grant execute on function public.zoe_pull_delta(bigint, integer, bigint) to authenticated;

notify pgrst, 'reload schema';
