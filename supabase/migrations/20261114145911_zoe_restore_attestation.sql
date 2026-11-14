create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table private.zoe_restore_attestor_keys (
    kid text primary key check(kid ~ '^[A-Za-z0-9_-]{1,32}$'),
    secret bytea not null check(octet_length(secret)=32),
    active boolean not null default true,
    created_at timestamptz not null default clock_timestamp()
);
create table private.zoe_restore_attestations (
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    source_id text not null check(source_id ~ '^[A-Za-z0-9_-]{1,128}$'),
    revision bigint not null check(revision between 1 and 9007199254740990),
    body jsonb not null check(jsonb_typeof(body)='object'),
    snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
    payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
    updated_at timestamptz not null default clock_timestamp(),
    primary key(tenant_id,source_id)
);
create table private.zoe_restore_attestation_events (
    tenant_id uuid not null,
    source_id text not null,
    revision bigint not null,
    attestation_id text not null,
    actor_uid uuid not null,
    session_id uuid not null,
    action text not null,
    verdict text not null,
    status text not null,
    source_hash text not null,
    code_set_hash text not null,
    correlation_hash text not null,
    recorded_at timestamptz not null default clock_timestamp(),
    primary key(tenant_id,source_id,revision)
);
alter table private.zoe_restore_attestor_keys enable row level security;
alter table private.zoe_restore_attestations enable row level security;
alter table private.zoe_restore_attestation_events enable row level security;
revoke all on private.zoe_restore_attestor_keys,private.zoe_restore_attestations,private.zoe_restore_attestation_events from public,anon,authenticated,service_role;

create function private.zoe_restore_policy_ok_v1(p_policy jsonb) returns boolean
language sql immutable set search_path=''
as $$ select coalesce(jsonb_typeof(p_policy)='object' and (select count(*) from jsonb_object_keys(p_policy))=5 and p_policy->'v'='1'::jsonb
    and p_policy->>'mode' in ('local','palm','cookie')
    and jsonb_typeof(p_policy->'scope')='string' and length(p_policy->>'scope') between 1 and 2048
    and jsonb_typeof(p_policy->'branch')='string' and length(p_policy->>'branch')<=32
    and (p_policy->>'mode'='local' and p_policy->>'branch'='' or p_policy->>'branch' ~ '^[A-Za-z0-9_-]{1,32}$')
    and jsonb_typeof(p_policy->'epoch')='number' and (p_policy->>'epoch')::numeric between 1 and 9007199254740990
    and (p_policy->>'epoch')::numeric=trunc((p_policy->>'epoch')::numeric),false) $$;

create function private.zoe_restore_entries_v1(p_barcodes jsonb) returns table(slot text,value jsonb)
language sql immutable set search_path=''
as $$ select e.key,e.value from jsonb_each(case when jsonb_typeof(p_barcodes)='object' then p_barcodes else '{}'::jsonb end)e where e.key ~ '^(0|[1-9][0-9]*)$' and e.value<>'null'::jsonb
    union all select (e.ordinality-1)::text,e.value from jsonb_array_elements(case when jsonb_typeof(p_barcodes)='array' then p_barcodes else '[]'::jsonb end) with ordinality e where e.value<>'null'::jsonb $$;

create function private.zoe_restore_code_maps_v1(p_source jsonb,p_target jsonb) returns jsonb
language plpgsql immutable set search_path=''
as $$
declare item record;code text;codes jsonb:='{}'::jsonb;slots jsonb:='{}'::jsonb;seen jsonb:='{}'::jsonb;position integer:=0;source_count integer:=0;
begin
    if jsonb_typeof(p_source->'barcodes') not in ('object','array') or jsonb_typeof(p_source->'barcodes')='object' and exists(select 1 from jsonb_object_keys(p_source->'barcodes')k where k !~ '^(0|[1-9][0-9]*)$') then raise exception 'restore-source-code-unverified' using errcode='22023';end if;
    for item in select * from private.zoe_restore_entries_v1(p_source->'barcodes') order by slot::numeric loop
        if jsonb_typeof(item.value)<>'object' or jsonb_typeof(item.value->'code')<>'string' or (item.value->>'code') !~ '^[A-Za-z0-9_-]{6,64}$' then raise exception 'restore-source-code-unverified' using errcode='22023';end if;
        code:=item.value->>'code';codes:=codes||jsonb_build_object(code,true);source_count:=source_count+1;
    end loop;
    if source_count=0 then raise exception 'restore-source-code-unverified' using errcode='22023';end if;
    for item in select * from private.zoe_restore_entries_v1(p_target->'barcodes') where jsonb_typeof(value)='object' order by slot::numeric loop
        if jsonb_typeof(item.value->'code')='string' then
            code:=item.value->>'code';slots:=slots||jsonb_build_object(position::text,code);seen:=seen||jsonb_build_object(code,true);
        end if;
        position:=position+1;
    end loop;
    if p_target->>'restoreClaimId' is distinct from p_source->>'id' then
        for item in select * from private.zoe_restore_entries_v1(p_source->'barcodes') order by slot::numeric loop
            code:=item.value->>'code';
            if not(seen ? code) then slots:=slots||jsonb_build_object(position::text,code);seen:=seen||jsonb_build_object(code,true);position:=position+1;end if;
        end loop;
    end if;
    return jsonb_build_object('codes',codes,'allowedTargetSlots',slots);
end $$;

create function private.zoe_restore_generation_v1(p_source jsonb) returns bigint
language plpgsql immutable set search_path=''
as $$
begin
    if not(p_source ? 'trashGeneration') then return 0;end if;
    if jsonb_typeof(p_source->'trashGeneration')<>'number' or (p_source->>'trashGeneration')::numeric not between 0 and 9007199254740990
        or (p_source->>'trashGeneration')::numeric<>trunc((p_source->>'trashGeneration')::numeric) then raise exception 'restore-source-generation-invalid' using errcode='22023';end if;
    return (p_source->>'trashGeneration')::bigint;
end $$;

create function private.zoe_restore_context_v1(p_source_id text,p_token text,p_target_id text,p_expected_generation bigint) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare tenant uuid:=private.current_tenant_id();actor uuid:=auth.uid();sid text:=auth.jwt()->>'session_id';policy jsonb;source jsonb;consumption jsonb;target jsonb;proof jsonb;finalization jsonb;
    branch text;created_ms bigint;expires_ms bigint;now_ms bigint:=private.zoe_now_ms();revision bigint:=0;reply jsonb;
begin
    if tenant is null then raise exception 'forbidden' using errcode='42501';end if;
    if p_source_id is null or p_source_id !~ '^[A-Za-z0-9_-]{1,128}$' or p_target_id is null or p_target_id !~ '^[A-Za-z0-9_-]{1,128}$'
        or p_expected_generation is null or p_expected_generation not between 0 and 9007199254740990
        or p_token is null or length(p_token) not between 1 and 2048 or p_token ~ '[[:cntrl:]]' then raise exception 'restore-request-invalid' using errcode='22023';end if;
    select t.branch_code into branch from public.tenants t where t.id=tenant;
    select coalesce(floor(extract(epoch from s.created_at)*1000)::bigint,now_ms),case when to_jsonb(s)->>'not_after' is null then null else floor(extract(epoch from (to_jsonb(s)->>'not_after')::timestamptz)*1000)::bigint end
        into created_ms,expires_ms from auth.sessions s where s.id=sid::uuid and s.user_id=actor;
    if auth.jwt()->>'exp' ~ '^[0-9]+$' then expires_ms:=least(coalesce(expires_ms,(auth.jwt()->>'exp')::bigint*1000),(auth.jwt()->>'exp')::bigint*1000);end if;
    select d.value into policy from public.zoe_docs d where d.tenant_id=tenant and d.root='zoew_restore_policy' and d.key='shop';
    select d.value into source from public.zoe_docs d where d.tenant_id=tenant and d.root='zoew_recently_deleted_cod_dod' and d.key=p_source_id;
    select d.value into consumption from public.zoe_docs d where d.tenant_id=tenant and d.root='zoew_trash_consumptions' and d.key=p_source_id;
    select d.value into finalization from public.zoe_docs d where d.tenant_id=tenant and d.root='zoew_restore_finalizations' and d.key=p_source_id;
    select d.value into target from public.zoe_docs d where d.tenant_id=tenant and d.root='zoew_scan_history_cod_dod' and d.key=p_target_id;
    select a.body,a.revision into proof,revision from private.zoe_restore_attestations a where a.tenant_id=tenant and a.source_id=p_source_id;
    reply:=jsonb_build_object('v',1,'now',now_ms,'tenantId',tenant,'actorUid',actor,'sessionId',sid,'sessionCreatedAt',created_ms,'sessionExpiresAt',expires_ms,
        'scope',coalesce(policy->>'scope',''),'branch',branch,'policy',policy,'source',source,'consumption',consumption,'finalization',finalization,'target',target,
        'attestation',proof-'codes'-'allowedTargetSlots','expectedRevision',coalesce(revision,0));
    if source is null and consumption->'v'='1'::jsonb and consumption->>'sourceId'=p_source_id and consumption->>'scope'=policy->>'scope'
        and (select count(*) from jsonb_object_keys(consumption))=10 and consumption->'generation'=to_jsonb(p_expected_generation)
        and jsonb_typeof(consumption->'deletedAt')='number' and (consumption->>'deletedAt')::numeric between 1 and 9007199254740990
        and (consumption->>'deletedAt')::numeric=trunc((consumption->>'deletedAt')::numeric)
        and jsonb_typeof(consumption->'rowBirth')='number' and (consumption->>'rowBirth')::numeric between 0 and 9007199254740990
        and (consumption->>'rowBirth')::numeric=trunc((consumption->>'rowBirth')::numeric) and consumption->>'kind'='restore' and consumption->>'token'=p_token
        and consumption->>'targetId'=p_target_id and consumption->>'actorUid'=actor::text
        and (finalization is null or (select count(*) from jsonb_object_keys(finalization))=3 and finalization->>'token'=p_token and finalization->>'targetId'=p_target_id and jsonb_typeof(finalization->'finalizedAt')='number') then
        return reply||jsonb_build_object('kind','already_applied','success',true);
    end if;
    if not private.zoe_restore_policy_ok_v1(policy) then raise exception 'restore-policy-unavailable' using errcode='PT409';end if;
    if (policy->>'mode'<>'local' or source->>'trashMode' in ('palm','cookie')) and policy->>'branch'<>branch then raise exception 'restore-policy-branch-mismatch' using errcode='PT409';end if;
    if source is null then raise exception 'restore-source-missing' using errcode='PT409';end if;
    if source ? 'id' and source->>'id' is distinct from p_source_id or private.zoe_restore_generation_v1(source)<>p_expected_generation
        or jsonb_typeof(source->'deletedAt') is distinct from 'number' or (source->>'deletedAt')::numeric not between 1 and 9007199254740990
        or (source->>'deletedAt')::numeric<>trunc((source->>'deletedAt')::numeric)
        or source ? 'createdAt' and (jsonb_typeof(source->'createdAt') is distinct from 'number' or (source->>'createdAt')::numeric not between 0 and 9007199254740990
            or (source->>'createdAt')::numeric<>trunc((source->>'createdAt')::numeric)) then raise exception 'restore-source-conflict' using errcode='PT409';end if;
    if consumption is null and p_expected_generation>1 or consumption is not null and (consumption->>'sourceId' is distinct from p_source_id
        or jsonb_typeof(consumption->'generation') is distinct from 'number' or (consumption->>'generation')::numeric+1<>p_expected_generation
        or jsonb_typeof(consumption->'deletedAt') is distinct from 'number' or (source->>'deletedAt')::numeric<=(consumption->>'deletedAt')::numeric) then raise exception 'restore-source-conflict' using errcode='PT409';end if;
    if target is not null then
        if jsonb_typeof(target)<>'object' or target ? 'id' and target->>'id' is distinct from p_target_id or target ? 'clearClaim'
            or jsonb_typeof(target->'barcodes') not in ('object','array')
            or target ? 'restoreClaimId' and (target->>'restoreClaimId' is distinct from p_source_id or target->>'restoreClaimToken' is distinct from p_token)
            or not(target ? 'restoreClaimId') and (target ? 'restoreClaimToken' or target ? 'restoreAddedCodes' or source->>'phone'='គ្មានលេខ'
                or target->'phone' is distinct from source->'phone' or target->'scanDate' is distinct from source->'scanDate' or target->'isClosed'='true'::jsonb)
            or target->>'restoreClaimId'=p_source_id and (source#>>'{restoreClaim,token}' is distinct from p_token or source#>>'{restoreClaim,targetId}' is distinct from p_target_id
                or proof is not null and proof->>'actorUid' is distinct from actor::text) then raise exception 'restore-target-conflict' using errcode='PT409';end if;
    end if;
    return reply||jsonb_build_object('kind',case when policy->>'mode'='local' and coalesce(source->>'trashMode','local') not in ('palm','cookie') then 'local' else 'ready' end);
end $$;
create function public.zoe_restore_context_v1(p_source_id text,p_token text,p_target_id text,p_expected_generation bigint) returns jsonb
language sql volatile security invoker set search_path=''
as $$ select private.zoe_restore_context_v1(p_source_id,p_token,p_target_id,p_expected_generation) $$;

create function private.zoe_restore_signature_v1(p_payload text,p_signature text,p_kid text) returns boolean
language plpgsql stable security definer set search_path=''
as $$
declare secret_value bytea;expected bytea;provided bytea;different integer:=0;position integer;crypto_schema text;
begin
    if p_signature is null or p_signature !~ '^[0-9a-f]{64}$' then return false;end if;
    select k.secret into secret_value from private.zoe_restore_attestor_keys k where k.kid=p_kid and k.active;
    if secret_value is null then return false;end if;
    select n.nspname into crypto_schema from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
    execute format('select %I.hmac($1,$2,$3)',crypto_schema) into expected using convert_to(p_payload,'UTF8'),secret_value,'sha256';provided:=decode(p_signature,'hex');
    for position in 0..31 loop different:=different | (get_byte(expected,position) # get_byte(provided,position));end loop;
    return different=0;
end $$;

create function private.zoe_restore_reply_v1(p_body jsonb,p_source jsonb,p_kind text default null) returns jsonb
language sql immutable set search_path=''
as $$ select jsonb_build_object('v',1,'success',true,'kind',coalesce(p_kind,case p_body->>'status' when 'allow' then 'allow' when 'deny' then 'deny' else 'hold' end),
    'attestationId',p_body->>'id','expiresAt',p_body->'expiresAt','source',p_source,
    'code',case p_body->>'verdict' when 'signed' then 'ZTO_RESTORE_TERMINAL_SIGNED' when 'returned' then 'ZTO_RESTORE_TERMINAL_RETURNED' else null end) $$;

create function private.zoe_restore_attest_v1(p_envelope text,p_signature text) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
<<restore_apply>>
declare
    fields text[]:=array['v','kid','action','tenantId','actorUid','sessionId','scope','branch','sourceId','token','targetId','attestationId','mode','policyEpoch','expectedRevision','expectedSource','verdict','issuedAt','expiresAt'];
    tenant uuid:=private.current_tenant_id();actor uuid:=auth.uid();sid text:=auth.jwt()->>'session_id';envelope jsonb;ctx jsonb;source jsonb;target jsonb;policy jsonb;
    prior private.zoe_restore_attestations;body jsonb;new_source jsonb;maps jsonb;now_ms bigint;issued bigint;expires bigint;generation bigint;revision bigint;payload_hash text;
    source_id text;token text;target_id text;attestation_id text;action text;verdict text;mode text;status text;old_target jsonb;old_generation bigint;
    rebased_terminal boolean:=false;grant_actor uuid:=actor;grant_sid text:=sid;
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
    select * into prior from private.zoe_restore_attestations a where a.tenant_id=tenant and a.source_id=restore_apply.source_id for update;
    if prior.payload_hash=payload_hash then
        if action='release' and not(source ? 'restoreAttestationId') then return private.zoe_restore_reply_v1(prior.body,source,'released');end if;
        if source->>'restoreAttestationId'=prior.body->>'id' and source#>>'{restoreClaim,token}'=token and source#>>'{restoreClaim,targetId}'=target_id then
            return private.zoe_restore_reply_v1(prior.body,source);
        end if;
    end if;
    generation:=private.zoe_restore_generation_v1(source);
    old_generation:=case when prior.body is null then null else (prior.body->>'generation')::bigint end;
    if source is distinct from envelope->'expectedSource' then
        if verdict in ('signed','returned') and source ? 'restoreAttestationId' and old_generation=generation
            and private.zoe_restore_generation_v1(envelope->'expectedSource')=generation
            and prior.body->>'id'=source->>'restoreAttestationId' and prior.body->>'token'=source#>>'{restoreClaim,token}'
            and prior.body->>'targetId'=source#>>'{restoreClaim,targetId}'
            and (source->'id' is not distinct from envelope#>'{expectedSource,id}' or not((envelope->'expectedSource') ? 'id') and source->>'id'=source_id)
            and (source->'restoreBlocked' is not distinct from envelope#>'{expectedSource,restoreBlocked}' or source->'restoreBlocked'='true'::jsonb)
            and (source-array['restoreAttestationId','restoreClaim','restoreBlocked','id']) is not distinct from
                ((envelope->'expectedSource')-array['restoreAttestationId','restoreClaim','restoreBlocked','id']) then
            rebased_terminal:=true;token:=prior.body->>'token';target_id:=prior.body->>'targetId';attestation_id:=prior.body->>'id';
            grant_actor:=(prior.body->>'actorUid')::uuid;grant_sid:=prior.body->>'sessionId';
        else raise exception 'restore-source-conflict' using errcode='PT409';end if;
    end if;
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
            return private.zoe_restore_reply_v1(prior.body,source);
        end if;
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
    revision:=coalesce(prior.revision,0)+1;body:=body||jsonb_build_object('revision',revision,'status',status);
    insert into private.zoe_restore_attestations as a(tenant_id,source_id,revision,body,snapshot,payload_hash)
        values(tenant,source_id,revision,body,source,payload_hash)
        on conflict on constraint zoe_restore_attestations_pkey do update set revision=excluded.revision,body=excluded.body,snapshot=excluded.snapshot,payload_hash=excluded.payload_hash,updated_at=clock_timestamp();
    insert into private.zoe_restore_attestation_events(tenant_id,source_id,revision,attestation_id,actor_uid,session_id,action,verdict,status,source_hash,code_set_hash,correlation_hash)
        values(tenant,source_id,revision,body->>'id',actor,sid::uuid,action,verdict,status,body->>'sourceHash',body->>'codeSetHash',encode(sha256(convert_to(token,'UTF8')),'hex'));
    if new_source is distinct from source then
        operation:='attest_'||substr(payload_hash,1,48);
        perform set_config('zoe.internal_write','',true);
        perform set_config('zoe.audit_context',jsonb_build_object('tenant',tenant,'operation',operation,'origin','admin_engine')::text,true);
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
create function public.zoe_restore_attest_v1(p_envelope text,p_signature text) returns jsonb
language sql volatile security invoker set search_path=''
as $$ select private.zoe_restore_attest_v1(p_envelope,p_signature) $$;

revoke all on function private.zoe_restore_policy_ok_v1(jsonb),private.zoe_restore_entries_v1(jsonb),private.zoe_restore_code_maps_v1(jsonb,jsonb),private.zoe_restore_generation_v1(jsonb),private.zoe_restore_signature_v1(text,text,text),private.zoe_restore_reply_v1(jsonb,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function private.zoe_restore_context_v1(text,text,text,bigint),public.zoe_restore_context_v1(text,text,text,bigint),private.zoe_restore_attest_v1(text,text),public.zoe_restore_attest_v1(text,text) from public,anon,authenticated,service_role;
grant execute on function private.zoe_restore_context_v1(text,text,text,bigint),public.zoe_restore_context_v1(text,text,text,bigint),private.zoe_restore_attest_v1(text,text),public.zoe_restore_attest_v1(text,text) to authenticated;

create function private.zoe_restore_rules_cache_v1(p_ctx jsonb) returns jsonb
language plpgsql stable set search_path=''
as $$
declare tenant uuid:=(p_ctx->>'t')::uuid;ids text[];proofs jsonb;policy jsonb;
begin
    with docs as (select * from jsonb_each(p_ctx->'pre') union all select * from jsonb_each(p_ctx->'post')),
    wanted as (
        select case when split_part(d.key,'/',1)='zoew_scan_history_cod_dod' then d.value->>'restoreClaimId' else split_part(d.key,'/',2) end id
        from docs d where split_part(d.key,'/',1) in ('zoew_recently_deleted_cod_dod','zoew_scan_history_cod_dod','zoew_trash_consumptions','zoew_restore_finalizations')
    ) select array_agg(distinct id) filter(where id is not null and id<>'') into ids from wanted;
    select coalesce(jsonb_object_agg(a.source_id,a.body),'{}'::jsonb) into proofs from private.zoe_restore_attestations a where a.tenant_id=tenant and a.source_id=any(ids);
    select d.value into policy from public.zoe_docs d where d.tenant_id=tenant and d.root='zoew_restore_policy' and d.key='shop';
    return p_ctx||jsonb_build_object('restoreAuthorities',proofs,'restorePolicy',policy);
end $$;

create function private.zoe_restore_first_commit_v1() returns trigger
language plpgsql volatile security definer set search_path=''
as $$
<<restore_commit>>
declare source_id text;body jsonb;source jsonb;policy jsonb;current_value jsonb;required boolean;now_ms bigint;
begin
    if new.root not in ('zoew_recently_deleted_cod_dod','zoew_scan_history_cod_dod','zoew_trash_consumptions') or new.value is null then return null;end if;
    if tg_op='UPDATE' and new.value is not distinct from old.value then return null;end if;
    select d.value into current_value from public.zoe_docs d where d.tenant_id=new.tenant_id and d.root=new.root and d.key=new.key;
    if current_value is distinct from new.value then return null;end if;
    if new.root='zoew_recently_deleted_cod_dod' then
        if not(new.value ? 'restoreAttestationId') then return null;end if;
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
create constraint trigger zoe_restore_first_commit after insert or update on public.zoe_docs
    deferrable initially deferred for each row execute function private.zoe_restore_first_commit_v1();
revoke all on function private.zoe_restore_rules_cache_v1(jsonb),private.zoe_restore_first_commit_v1() from public,anon,authenticated,service_role;


create or replace function private.zoe_snap_val(p_snap jsonb, p_ctx jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
    snap_path text[] := translate((p_snap -> 'p')::text, '[]', '{}')::text[];
    depth integer := cardinality(snap_path);
    side text := case when (p_snap ->> '$s') = '1' then 'post' else 'pre' end;
    tenant uuid := (p_ctx ->> 't')::uuid;
    doc jsonb;
    doc_key text;
begin
    if snap_path[1]='zoew_restore_attestations' then
        doc:=coalesce(p_ctx->'restoreAuthorities','{}'::jsonb);
        if depth=1 then return doc;end if;
        return coalesce(doc#>snap_path[2:depth],'null'::jsonb);
    end if;
    if depth = 0 then
        with x as materialized (
            select r.root, private.zoe_snap_val(jsonb_build_object('$s', p_snap -> '$s', 'p', jsonb_build_array(r.root)), p_ctx) as v
            from (select distinct z.root from public.zoe_docs z where z.tenant_id = tenant) r
        )
        select coalesce(('{' || string_agg(to_json(x.root)::text || ':' || x.v::text, ',') || '}')::jsonb, 'null'::jsonb) into doc
        from x where x.v <> 'null'::jsonb;
        return doc;
    end if;
    if depth = 1 then
        with d as materialized (
            select z.key,
                case when (p_ctx #> array['touched', z.root || '/' || z.key]) is not null then p_ctx #> array[side, z.root || '/' || z.key]
                     else coalesce(z.value, 'null'::jsonb) end as v
            from public.zoe_docs z
            where z.tenant_id = tenant and z.root = snap_path[1]
        )
        select coalesce(('{' || string_agg(to_json(d.key)::text || ':' || d.v::text, ',') || '}')::jsonb, 'null'::jsonb) into doc
        from d where d.v <> 'null'::jsonb;
        return doc;
    end if;
    doc_key := snap_path[1] || '/' || snap_path[2];
    if (p_ctx #> array['touched', doc_key]) is not null then
        return coalesce(p_ctx #> (array[side, doc_key] || snap_path[3:depth]), 'null'::jsonb);
    end if;
    select z.value #> snap_path[3:depth] into doc
    from public.zoe_docs z
    where z.tenant_id = tenant and z.root = snap_path[1] and z.key = snap_path[2];
    return coalesce(doc, 'null'::jsonb);
end
$$;

create or replace function private.zoe_eval(p_expr jsonb, p_ctx jsonb, p_scope jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
    kind text := p_expr ->> 't';
    op text;
    left_value jsonb;
    right_value jsonb;
    target jsonb;
    arg jsonb;
    value jsonb;
    item jsonb;
    seg text;
    snap_path jsonb;
    left_type text;
    right_type text;
    same boolean;
    left_num numeric;
    right_num numeric;
    hint jsonb;
    depth integer;
    i integer;
begin
    case kind
    when 'f03_registry_key' then
        if p_expr <> '{"t":"f03_registry_key"}'::jsonb
            or jsonb_typeof(p_scope -> 'loc') is distinct from 'array' then
            return null;
        end if;
        if jsonb_array_length(p_scope -> 'loc') <> 2
            or p_scope -> 'loc' ->> 0 is distinct from 'zoew_registry_releases' then
            return null;
        end if;
        left_value := private.zoe_eval('{"t":"m","n":"val","o":{"t":"m","n":"child","o":{"t":"newData"},"a":[{"t":"l","v":"code"}]},"a":[]}'::jsonb, p_ctx, p_scope);
        right_value := private.zoe_eval('{"t":"m","n":"val","o":{"t":"m","n":"child","o":{"t":"newData"},"a":[{"t":"l","v":"registryKey"}]},"a":[]}'::jsonb, p_ctx, p_scope);
        if jsonb_typeof(left_value) is distinct from 'string' or jsonb_typeof(right_value) is distinct from 'string' then
            return 'false'::jsonb;
        end if;
        return to_jsonb(length(right_value #>> '{}') > 0
            and (right_value #>> '{}') collate "C" = private.zoe_purge_registry_key_v1(left_value #>> '{}') collate "C");
    when 'l' then
        return p_expr -> 'v';
    when 'v' then
        return p_scope -> 'vars' -> (p_expr ->> 'n');
    when 'now' then
        return to_jsonb((p_ctx ->> 'now')::numeric);
    when 'auth_uid' then
        return coalesce(to_jsonb(auth.uid()::text), 'null'::jsonb);
    when 'auth_claim' then
        if p_expr->>'n' not in ('session_id','auth_time') then return 'null'::jsonb;end if;
        return coalesce(auth.jwt()->(p_expr->>'n'),'null'::jsonb);
    when 'auth' then
        return '{}'::jsonb;
    when 'root' then
        return jsonb_build_object('$s', 0, 'p', '[]'::jsonb);
    when 'data' then
        return jsonb_build_object('$s', 0, 'p', p_scope -> 'loc');
    when 'newData' then
        return jsonb_build_object('$s', 1, 'p', p_scope -> 'loc');
    when 'arr' then
        value := '[]'::jsonb;
        for item in select e.value from jsonb_array_elements(p_expr -> 'items') e loop
            arg := private.zoe_eval(item, p_ctx, p_scope);
            if arg is null then
                return null;
            end if;
            value := value || jsonb_build_array(arg);
        end loop;
        return value;
    when '&&', '||' then
        left_value := private.zoe_eval(p_expr -> 'l', p_ctx, p_scope);
        if left_value is null or jsonb_typeof(left_value) <> 'boolean' then
            return null;
        end if;
        if (kind = '&&' and left_value = 'false'::jsonb) or (kind = '||' and left_value = 'true'::jsonb) then
            return left_value;
        end if;
        right_value := private.zoe_eval(p_expr -> 'r', p_ctx, p_scope);
        if right_value is null or jsonb_typeof(right_value) <> 'boolean' then
            return null;
        end if;
        return right_value;
    when 'u' then
        op := p_expr ->> 'o';
        value := private.zoe_eval(p_expr -> 'e', p_ctx, p_scope);
        if value is null or (jsonb_typeof(value) = 'object' and value ? '$s') then
            return null;
        end if;
        if op = '!' then
            if jsonb_typeof(value) <> 'boolean' then
                return null;
            end if;
            return to_jsonb(not (value = 'true'::jsonb));
        end if;
        if op = '-' and jsonb_typeof(value) = 'number' then
            return to_jsonb(-((value #>> '{}')::numeric));
        end if;
        return null;
    when 'b' then
        op := p_expr ->> 'o';
        case p_expr -> 'l' ->> 't'
        when 'l' then
            left_value := p_expr -> 'l' -> 'v';
        when 'v' then
            left_value := p_scope -> 'vars' -> (p_expr -> 'l' ->> 'n');
        else
            left_value := private.zoe_eval(p_expr -> 'l', p_ctx, p_scope);
        end case;
        if left_value is null then
            return null;
        end if;
        if p_expr -> 'r' ->> 't' = 'l' then
            right_value := p_expr -> 'r' -> 'v';
        elsif p_expr -> 'r' ->> 't' = 'v' then
            right_value := p_scope -> 'vars' -> (p_expr -> 'r' ->> 'n');
        else
            right_value := private.zoe_eval(p_expr -> 'r', p_ctx, p_scope);
        end if;
        if right_value is null or (jsonb_typeof(left_value) = 'object' and left_value ? '$s')
                or (jsonb_typeof(right_value) = 'object' and right_value ? '$s') then
            return null;
        end if;
        left_type := jsonb_typeof(left_value);
        right_type := jsonb_typeof(right_value);
        if op in ('===', '==', '!==', '!=') then
            if left_type <> right_type then
                same := false;
            elsif left_type in ('object', 'array') then
                return null;
            elsif left_type = 'number' then
                same := (left_value #>> '{}')::numeric = (right_value #>> '{}')::numeric;
            else
                same := left_value = right_value;
            end if;
            return to_jsonb(case when op in ('===', '==') then same else not same end);
        end if;
        if op in ('<', '<=', '>', '>=') then
            if left_type = 'number' and right_type = 'number' then
                left_num := (left_value #>> '{}')::numeric;
                right_num := (right_value #>> '{}')::numeric;
                return to_jsonb(case op when '<' then left_num < right_num when '<=' then left_num <= right_num
                    when '>' then left_num > right_num else left_num >= right_num end);
            end if;
            if left_type = 'string' and right_type = 'string' then
                return to_jsonb(case op
                    when '<' then (left_value #>> '{}') collate "C" < (right_value #>> '{}') collate "C"
                    when '<=' then (left_value #>> '{}') collate "C" <= (right_value #>> '{}') collate "C"
                    when '>' then (left_value #>> '{}') collate "C" > (right_value #>> '{}') collate "C"
                    else (left_value #>> '{}') collate "C" >= (right_value #>> '{}') collate "C" end);
            end if;
            return 'false'::jsonb;
        end if;
        if op = '+' and left_type = 'string' and right_type = 'string' then
            return to_jsonb((left_value #>> '{}') || (right_value #>> '{}'));
        end if;
        if left_type <> 'number' or right_type <> 'number' then
            return null;
        end if;
        left_num := (left_value #>> '{}')::numeric;
        right_num := (right_value #>> '{}')::numeric;
        if op = '+' then
            return to_jsonb(left_num::float8 + right_num::float8);
        elsif op = '-' then
            return to_jsonb(left_num - right_num);
        elsif op = '*' then
            return to_jsonb(left_num * right_num);
        elsif op in ('/', '%') then
            if right_num = 0 then
                return null;
            end if;
            return to_jsonb(case when op = '/' then left_num / right_num else left_num % right_num end);
        end if;
        return null;
    when 'p' then
        value := private.zoe_eval(p_expr -> 'o', p_ctx, p_scope);
        if value is null or jsonb_typeof(value) <> 'string' or p_expr ->> 'n' <> 'length' then
            return null;
        end if;
        return to_jsonb(private.zoe_utf16_length(value #>> '{}'));
    when 'm' then
        hint := case when p_expr ? 'f' then p_expr -> 'f' when p_expr -> 'o' ? 'f' then p_expr -> 'o' -> 'f' end;
        if hint is not null and jsonb_typeof(p_scope -> 'loc') = 'array' then
            snap_path := case when hint ->> 'b' = 'r' then '[]'::jsonb else p_scope -> 'loc' end;
            depth := coalesce((hint ->> 'u')::integer, 0);
            if depth > jsonb_array_length(snap_path) then
                return null;
            end if;
            for i in 1 .. depth loop
                snap_path := snap_path - (jsonb_array_length(snap_path) - 1);
            end loop;
            if hint ? 'l' then
                snap_path := snap_path || (hint -> 'l');
            elsif hint ? 's' then
                for i in 0 .. jsonb_array_length(hint -> 's') - 1 loop
                    item := hint -> 's' -> i;
                    if jsonb_typeof(item) = 'string' then
                        snap_path := snap_path || item;
                        continue;
                    end if;
                    arg := p_scope -> 'vars' -> (item ->> 'v');
                    if arg is null or jsonb_typeof(arg) <> 'string' then
                        return null;
                    end if;
                    seg := arg #>> '{}';
                    if strpos(seg, '/') = 0 then
                        if seg = '' or octet_length(seg) > 768 or seg ~ '[\]\[.#$/\x01-\x1f\x7f]' then
                            return null;
                        end if;
                        snap_path := snap_path || to_jsonb(seg);
                        continue;
                    end if;
                    value := snap_path;
                    for seg in select x from unnest(string_to_array(arg #>> '{}', '/')) x loop
                        if seg <> '' then
                            if not private.zoe_key_ok(seg) then
                                return null;
                            end if;
                            snap_path := snap_path || to_jsonb(seg);
                        end if;
                    end loop;
                    if snap_path = value then
                        return null;
                    end if;
                end loop;
            end if;
            target := jsonb_build_object('$s', case when hint ->> 'b' = 'n' then 1 else 0 end, 'p', snap_path);
            if p_expr ? 'f' then
                return target;
            end if;
        else
            case p_expr -> 'o' ->> 't'
            when 'newData' then
                target := jsonb_build_object('$s', 1, 'p', p_scope -> 'loc');
            when 'data' then
                target := jsonb_build_object('$s', 0, 'p', p_scope -> 'loc');
            when 'root' then
                target := '{"$s":0,"p":[]}'::jsonb;
            else
                target := private.zoe_eval(p_expr -> 'o', p_ctx, p_scope);
            end case;
        end if;
        if target is null or not (jsonb_typeof(target) = 'object' and target ? '$s') then
            return null;
        end if;
        if (target ->> '$s') = '1' and p_scope ? 'nv' and target -> 'p' = p_scope -> 'loc' and p_expr ->> 'n' not in ('child', 'parent') then
            value := p_scope -> 'nv';
            case p_expr ->> 'n'
            when 'val' then
                return value;
            when 'exists' then
                return to_jsonb(value <> 'null'::jsonb);
            when 'isString' then
                return to_jsonb(jsonb_typeof(value) = 'string');
            when 'isNumber' then
                return to_jsonb(jsonb_typeof(value) = 'number');
            when 'isBoolean' then
                return to_jsonb(jsonb_typeof(value) = 'boolean');
            when 'hasChildren' then
                if jsonb_array_length(p_expr -> 'a') = 0 then
                    return to_jsonb(jsonb_typeof(value) = 'object');
                end if;
                arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
                if arg is null or jsonb_typeof(arg) <> 'array' then
                    return null;
                end if;
                for item in select e.value from jsonb_array_elements(arg) e loop
                    if jsonb_typeof(item) <> 'string' then
                        return null;
                    end if;
                end loop;
                if jsonb_typeof(value) <> 'object' then
                    return 'false'::jsonb;
                end if;
                for item in select e.value from jsonb_array_elements(arg) e loop
                    if not value ? (item #>> '{}') then
                        return 'false'::jsonb;
                    end if;
                end loop;
                return 'true'::jsonb;
            when 'hasChild' then
                arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
                if arg is null or jsonb_typeof(arg) <> 'string' then
                    return null;
                end if;
                return to_jsonb(jsonb_typeof(value) = 'object' and value ? (arg #>> '{}'));
            else
                return null;
            end case;
        end if;
        case p_expr ->> 'n'
        when 'child' then
            case p_expr -> 'a' -> 0 ->> 't'
            when 'l' then
                arg := p_expr -> 'a' -> 0 -> 'v';
            when 'v' then
                arg := p_scope -> 'vars' -> (p_expr -> 'a' -> 0 ->> 'n');
            else
                arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
            end case;
            if arg is null or jsonb_typeof(arg) <> 'string' then
                return null;
            end if;
            seg := arg #>> '{}';
            if strpos(seg, '/') = 0 then
                if seg = '' or octet_length(seg) > 768 or seg ~ '[\]\[.#$/\x01-\x1f\x7f]' then
                    return null;
                end if;
                return jsonb_build_object('$s', target -> '$s', 'p', (target -> 'p') || to_jsonb(seg));
            end if;
            snap_path := target -> 'p';
            for seg in select s from unnest(string_to_array(arg #>> '{}', '/')) s loop
                if seg <> '' then
                    if not private.zoe_key_ok(seg) then
                        return null;
                    end if;
                    snap_path := snap_path || to_jsonb(seg);
                end if;
            end loop;
            if snap_path = target -> 'p' then
                return null;
            end if;
            return jsonb_build_object('$s', target -> '$s', 'p', snap_path);
        when 'parent' then
            if jsonb_array_length(target -> 'p') = 0 then
                return null;
            end if;
            return jsonb_build_object('$s', target -> '$s', 'p', (target -> 'p') - (jsonb_array_length(target -> 'p') - 1));
        when 'val' then
            return private.zoe_snap_val(target, p_ctx);
        when 'exists' then
            return to_jsonb(private.zoe_snap_exists(target, p_ctx));
        when 'isString' then
            if jsonb_array_length(target -> 'p') <= 1 then
                return 'false'::jsonb;
            end if;
            return to_jsonb(jsonb_typeof(private.zoe_snap_val(target, p_ctx)) = 'string');
        when 'isNumber' then
            if jsonb_array_length(target -> 'p') <= 1 then
                return 'false'::jsonb;
            end if;
            return to_jsonb(jsonb_typeof(private.zoe_snap_val(target, p_ctx)) = 'number');
        when 'isBoolean' then
            if jsonb_array_length(target -> 'p') <= 1 then
                return 'false'::jsonb;
            end if;
            return to_jsonb(jsonb_typeof(private.zoe_snap_val(target, p_ctx)) = 'boolean');
        when 'hasChildren' then
            if jsonb_array_length(target -> 'p') <= 1 then
                if jsonb_array_length(p_expr -> 'a') = 0 then
                    return to_jsonb(private.zoe_snap_exists(target, p_ctx));
                end if;
                arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
                if arg is null or jsonb_typeof(arg) <> 'array' then
                    return null;
                end if;
                for item in select e.value from jsonb_array_elements(arg) e loop
                    if jsonb_typeof(item) <> 'string' then
                        return null;
                    end if;
                end loop;
                if not private.zoe_snap_exists(target, p_ctx) then
                    return 'false'::jsonb;
                end if;
                for item in select e.value from jsonb_array_elements(arg) e loop
                    if not private.zoe_key_ok(item #>> '{}')
                            or not private.zoe_snap_exists(jsonb_build_object('$s', target -> '$s', 'p', (target -> 'p') || item), p_ctx) then
                        return 'false'::jsonb;
                    end if;
                end loop;
                return 'true'::jsonb;
            end if;
            value := private.zoe_snap_val(target, p_ctx);
            if jsonb_array_length(p_expr -> 'a') = 0 then
                return to_jsonb(jsonb_typeof(value) = 'object');
            end if;
            arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
            if arg is null or jsonb_typeof(arg) <> 'array' then
                return null;
            end if;
            for item in select e.value from jsonb_array_elements(arg) e loop
                if jsonb_typeof(item) <> 'string' then
                    return null;
                end if;
            end loop;
            if jsonb_typeof(value) <> 'object' then
                return 'false'::jsonb;
            end if;
            for item in select e.value from jsonb_array_elements(arg) e loop
                if not value ? (item #>> '{}') then
                    return 'false'::jsonb;
                end if;
            end loop;
            return 'true'::jsonb;
        when 'hasChild' then
            arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
            if arg is null or jsonb_typeof(arg) <> 'string' then
                return null;
            end if;
            if jsonb_array_length(target -> 'p') <= 1 then
                return to_jsonb(private.zoe_key_ok(arg #>> '{}')
                    and private.zoe_snap_exists(jsonb_build_object('$s', target -> '$s', 'p', (target -> 'p') || arg), p_ctx));
            end if;
            value := private.zoe_snap_val(target, p_ctx);
            return to_jsonb(jsonb_typeof(value) = 'object' and value ? (arg #>> '{}'));
        else
            return null;
        end case;
    else
        return null;
    end case;
end
$$;

create or replace function private.zoe_apply_engine_v1(p_tenant uuid, p_op_id text, p_ops jsonb, p_enforce boolean, p_replace boolean, p_purge jsonb) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
    prior_origin text := current_setting('zoe.internal_write', true);
    prior_audit_context text := current_setting('zoe.audit_context', true);
    tenant uuid := p_tenant;
    now_ms bigint := private.zoe_now_ms();
    head bigint;
    used bigint;
    quota bigint;
    next_seq bigint;
    prior jsonb;
    op jsonb;
    kind text;
    op_path text[];
    doc_key text;
    want_keys text[] := '{}'::text[];
    root_names text[] := '{}'::text[];
    root_vals jsonb[] := '{}'::jsonb[];
    leaf_ops jsonb[] := '{}'::jsonb[];
    locs jsonb[] := '{}'::jsonb[];
    pre jsonb;
    pre_text text;
    pre_seq jsonb;
    pre_rows jsonb;
    work jsonb;
    rules jsonb;
    ctx jsonb;
    loc jsonb;
    loc_path text[];
    current_value jsonb;
    delta float8;
    new_value jsonb;
    changed boolean := false;
    cleanup_only boolean := not p_replace;
    grow bigint := 0;
    freed bigint;
    out_list jsonb[] := '{}'::jsonb[];
    stored_list jsonb[] := '{}'::jsonb[];
    result jsonb;
    ops_count integer;
    overlap boolean;
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_op_id is null or p_op_id !~ '^[A-Za-z0-9_-]{16,64}$' then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    if jsonb_typeof(p_ops) <> 'array' then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    ops_count := jsonb_array_length(p_ops);
    if ops_count < 1 or (ops_count > 500 and p_purge is null) or (p_purge is not null and (not p_enforce or p_replace)) then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    if octet_length(p_ops::text) > 4194304 then
        raise exception 'invalid_data' using errcode = '22023', detail = 'size';
    end if;

    insert into public.zoe_tenant_state (tenant_id) values (tenant) on conflict (tenant_id) do nothing;
    select s.seq, s.bytes, s.quota_bytes into head, used, quota from public.zoe_tenant_state s where s.tenant_id = tenant for update;
    select o.result into prior from public.zoe_ops o where o.tenant_id = tenant and o.op_id = p_op_id;
    if found then
        return prior || jsonb_build_object('replayed', true, 'now', now_ms);
    end if;
    perform set_config('zoe.internal_write', 'on', true);
    perform set_config('zoe.audit_context', jsonb_build_object('tenant',tenant,'operation',p_op_id,'origin',case when p_enforce then 'app_engine' else 'admin_engine' end)::text, true);
    next_seq := head + 1;
    if p_replace then
        select coalesce(sum(octet_length(z.value::text)), 0) into freed from public.zoe_docs z where z.tenant_id = tenant and z.value is not null;
        grow := grow - freed;
        update public.zoe_docs z set value = null, seq = next_seq, updated_at = now()
        where z.tenant_id = tenant and z.value is not null;
        changed := found;
    end if;

    for op in select e.value from jsonb_array_elements(p_ops) e loop
        kind := op ->> 'k';
        if kind is null or kind not in ('set', 'inc', 'cas') then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        if kind = 'cas' and ops_count <> 1 then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        if kind <> 'inc' and not op ? 'v' then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        op_path := private.zoe_path_of(op -> 'p');
        if cardinality(op_path) = 1 and kind = 'inc' then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        locs := array_append(locs, to_jsonb(op_path));
        if cardinality(op_path) = 1 then
            new_value := private.zoe_canon(op -> 'v');
            if not op_path[1] = any(root_names) then
                root_names := array_append(root_names, op_path[1]);
                root_vals := array_append(root_vals, new_value);
            end if;
            if jsonb_typeof(new_value) = 'object' then
                want_keys := want_keys || array(select op_path[1] || '/' || k from jsonb_object_keys(new_value) k);
            end if;
            continue;
        end if;
        want_keys := array_append(want_keys, op_path[1] || '/' || op_path[2]);
    end loop;

    with wanted as (
        select distinct split_part(w, '/', 1) as r, split_part(w, '/', 2) as k from unnest(want_keys) w
    ), by_root as (
        select z.root as r, z.key as k, z.value as v, z.seq as s from public.zoe_docs z
        where z.tenant_id = tenant and z.root = any(root_names)
        for update
    ), by_key as (
        select z.root as r, z.key as k, z.value as v, z.seq as s from public.zoe_docs z
        join wanted w on z.tenant_id = tenant and z.root = w.r and z.key = w.k
        where not (z.root = any(root_names))
        for update of z
    ), found_rows as (
        select * from by_root
        union all
        select * from by_key
    ), merged as (
        select f.r, f.k, f.v, f.s, true as row_exists from found_rows f
        union all
        select w.r, w.k, null::jsonb, 0::bigint, false from wanted w
        where not exists (select 1 from found_rows f where f.r = w.r and f.k = w.k)
    )
    select string_agg(to_json(m.r || '/' || m.k)::text || ':' || coalesce(m.v, 'null'::jsonb)::text, ','),
           coalesce(jsonb_object_agg(m.r || '/' || m.k, case when m.v is null then 0 else m.s end), '{}'::jsonb),
           coalesce(jsonb_object_agg(m.r || '/' || m.k, m.row_exists), '{}'::jsonb)
        into pre_text, pre_seq, pre_rows
    from merged m;
    if octet_length(pre_text) > 8388608 then
        raise exception 'invalid_data' using errcode = '22023', detail = 'size';
    end if;
    pre := coalesce(('{' || pre_text || '}')::jsonb, '{}'::jsonb);

    select exists (
        select 1 from (
            select t.a, lag(t.a) over (order by t.a) as b
            from (select array(select jsonb_array_elements_text(l)) as a from unnest(locs) l) t
        ) x
        where x.b is not null and cardinality(x.b) <= cardinality(x.a) and x.a[1:cardinality(x.b)] = x.b
    ) into overlap;
    if overlap then
        raise exception 'invalid_op' using errcode = '22023', detail = 'overlap';
    end if;

    for op in select e.value from jsonb_array_elements(p_ops) e loop
        kind := op ->> 'k';
        op_path := private.zoe_path_of(op -> 'p');
        if cardinality(op_path) = 1 then
            if kind = 'cas' then
                current_value := private.zoe_root_value(pre, op_path[1]);
                if current_value <> private.zoe_canon(op -> 'x') then
                    perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);
    perform set_config('zoe.audit_context', coalesce(prior_audit_context, ''), true);
                    return jsonb_build_object('ok', false, 'conflict', true, 'now', now_ms, 'value', current_value);
                end if;
            end if;
            new_value := root_vals[array_position(root_names, op_path[1])];
            if new_value <> 'null'::jsonb and jsonb_typeof(new_value) <> 'object' then
                raise exception 'invalid_data' using errcode = '22023', detail = 'root';
            end if;
            continue;
        end if;
        doc_key := op_path[1] || '/' || op_path[2];
        if kind = 'set' then
            new_value := private.zoe_canon(op -> 'v');
        elsif kind = 'inc' then
            if jsonb_typeof(op -> 'd') <> 'number' then
                raise exception 'invalid_op' using errcode = '22023';
            end if;
            delta := (op ->> 'd')::float8;
            current_value := coalesce(pre #> (array[doc_key] || op_path[3:]), 'null'::jsonb);
            new_value := private.zoe_canon(to_jsonb(case when jsonb_typeof(current_value) = 'number' then (current_value #>> '{}')::float8 else 0::float8 end + delta));
        else
            current_value := coalesce(pre #> (array[doc_key] || op_path[3:]), 'null'::jsonb);
            if current_value <> private.zoe_canon(op -> 'x') then
                perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);
    perform set_config('zoe.audit_context', coalesce(prior_audit_context, ''), true);
                return jsonb_build_object('ok', false, 'conflict', true, 'now', now_ms, 'value', current_value);
            end if;
            new_value := private.zoe_canon(op -> 'v');
        end if;
        leaf_ops := array_append(leaf_ops, jsonb_build_object('d', doc_key, 's', to_jsonb(op_path[3:]), 'v', new_value));
    end loop;

    with leafs as (
        select l ->> 'd' as d, array_agg(l) as subs from unnest(leaf_ops) l group by 1
    ), roots as (
        select u.r, u.v from unnest(root_names, root_vals) as u(r, v)
    )
    select coalesce(('{' || string_agg(to_json(e.key)::text || ':' || (
        case when rt.r is not null then coalesce(rt.v -> split_part(e.key, '/', 2), 'null'::jsonb)
             when lf.d is not null then private.zoe_merge(e.value, lf.subs, 0)
             else e.value end)::text, ',') || '}')::jsonb, '{}'::jsonb)
        into work
    from jsonb_each(pre) e
    left join roots rt on rt.r = split_part(e.key, '/', 1)
    left join leafs lf on lf.d = e.key;

    for doc_key, new_value in select e.key, e.value from jsonb_each(work) e loop
        if octet_length(new_value::text) > 1048576 then
            raise exception 'invalid_data' using errcode = '22023', detail = 'size';
        end if;
        current_value := pre -> doc_key;
        if new_value = current_value then
            out_list := array_append(out_list, jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2),
                'v', new_value, 's', (pre_seq ->> doc_key)::bigint));
            continue;
        end if;
        changed := true;
        cleanup_only := cleanup_only and current_value <> 'null'::jsonb and new_value = 'null'::jsonb;
        grow := grow + case when new_value = 'null'::jsonb then 0 else octet_length(new_value::text) end
            - case when current_value = 'null'::jsonb then 0 else octet_length(current_value::text) end
            + case when (pre_rows ->> doc_key)::boolean then 0 else private.zoe_doc_bytes(split_part(doc_key, '/', 1), split_part(doc_key, '/', 2), null) end;
        insert into public.zoe_docs as z (tenant_id, root, key, value, seq, updated_at)
        values (tenant, split_part(doc_key, '/', 1), split_part(doc_key, '/', 2), nullif(new_value, 'null'::jsonb), next_seq, now())
        on conflict (tenant_id, root, key) do update
            set value = excluded.value, seq = excluded.seq, updated_at = excluded.updated_at;
        out_list := array_append(out_list, jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2),
            'v', new_value, 's', next_seq));
        stored_list := array_append(stored_list, jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2), 's', next_seq));
    end loop;

    if p_enforce then
        rules := private.zoe_rules();
        ctx := jsonb_build_object('t', tenant, 'now', now_ms, 'pre', pre, 'post', work,
            'touched', (select coalesce(jsonb_object_agg(k, true), '{}'::jsonb) from jsonb_object_keys(pre) k));
        ctx := private.zoe_restore_rules_cache_v1(ctx) || jsonb_build_object('now',private.zoe_now_ms());
        foreach loc in array locs loop
            loc_path := array(select jsonb_array_elements_text(loc));
            if not private.zoe_check_location(rules, loc_path, ctx) then
                raise exception 'permission_denied' using errcode = '42501', detail = array_to_string(loc_path, '/');
            end if;
        end loop;
    end if;

    if not changed then
        next_seq := head;
    end if;
    result := jsonb_build_object('ok', true, 'seq', next_seq, 'docs', private.zoe_json_array(stored_list));
    if p_purge is not null then
        result := result || jsonb_build_object('purge', p_purge);
    end if;
    grow := grow + private.zoe_op_bytes(p_op_id, result);
    if p_enforce and grow > 0 and used::numeric + grow > quota then
        perform private.zoe_housekeeping(tenant);
        select s.bytes into used from public.zoe_tenant_state s where s.tenant_id = tenant;
        if used::numeric + grow > quota and not (changed and cleanup_only and used::numeric + grow - quota <= 1048576) then
            raise exception 'quota_exceeded' using errcode = '22023', detail = 'bytes';
        end if;
    end if;
    update public.zoe_tenant_state s set seq = next_seq, bytes = greatest(s.bytes + grow, 0) where s.tenant_id = tenant;
    insert into public.zoe_ops (tenant_id, op_id, result) values (tenant, p_op_id, result);
    if changed and next_seq % 64 = 0 then
        perform private.zoe_housekeeping(tenant);
    end if;
    perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);
    perform set_config('zoe.audit_context', coalesce(prior_audit_context, ''), true);
    return jsonb_build_object('ok', true, 'seq', next_seq, 'now', now_ms, 'docs', private.zoe_json_array(out_list))
        || case when p_purge is null then '{}'::jsonb else jsonb_build_object('purge', p_purge) end;
exception when others then
    perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);
    perform set_config('zoe.audit_context', coalesce(prior_audit_context, ''), true);
    raise;
end
$$;

create or replace function public.zoe_admin_export(
    p_tenant uuid,
    p_after_seq bigint default 0,
    p_after_root text default '',
    p_after_key text default '',
    p_tombstones_after bigint default null,
    p_limit integer default 500,
    p_max_bytes integer default 2097152
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
    lim integer := least(greatest(coalesce(p_limit, 500), 1), 2000);
    max_bytes bigint := least(greatest(coalesce(p_max_bytes, 2097152), 65536), 4194304);
    after_seq bigint := greatest(coalesce(p_after_seq, 0), 0);
    after_root text := coalesce(p_after_root, '');
    after_key text := coalesce(p_after_key, '');
    head bigint := 0;
    purged bigint := 0;
    threshold bigint;
    rows_out jsonb;
    taken integer;
    fetched integer;
    last_seq bigint;
    last_root text;
    last_key text;
    more boolean;
begin
    if p_tenant is null or not exists (select 1 from public.tenants t where t.id = p_tenant) then
        raise exception 'tenant-not-found' using errcode = 'P0002';
    end if;
    if exists (
        select 1 from public.zoe_docs d
        join private.zoe_restore_attestations a on a.tenant_id=d.tenant_id and a.source_id=d.key
        where d.tenant_id=p_tenant and d.root='zoew_recently_deleted_cod_dod' and d.value is not null
            and a.body->'generation'=coalesce(d.value->'trashGeneration','0'::jsonb)
    ) then raise exception 'private-restore-state-requires-database-backup' using errcode='55000';end if;
    select s.seq, s.purged_seq into head, purged from public.zoe_tenant_state s where s.tenant_id = p_tenant;
    head := coalesce(head, 0);
    purged := coalesce(purged, 0);
    threshold := greatest(coalesce(p_tombstones_after, head), 0);
    with page as (
        select z.root, z.key, z.value, z.seq,
            row_number() over w as rn,
            sum(coalesce(octet_length(z.value::text), 0) + octet_length(z.root) + octet_length(z.key) + 40) over w as running
        from (
            select z.root, z.key, z.value, z.seq
            from public.zoe_docs z
            where z.tenant_id = p_tenant and z.seq >= after_seq
                and (z.seq, z.root collate "C", z.key collate "C") > (after_seq, after_root collate "C", after_key collate "C")
                and (z.value is not null or z.seq > threshold)
            order by z.seq, z.root collate "C", z.key collate "C"
            limit lim + 1
        ) z
        window w as (order by z.seq, z.root collate "C", z.key collate "C" rows between unbounded preceding and current row)
    ), picked as (
        select p.* from page p
        where p.rn <= lim and (p.rn = 1 or p.running <= max_bytes)
    )
    select coalesce(('[' || string_agg(jsonb_build_object('r', p.root, 'k', p.key, 'v', coalesce(p.value, 'null'::jsonb), 's', p.seq)::text, ','
            order by p.rn) || ']')::jsonb, '[]'::jsonb),
        count(*)::integer,
        (select count(*)::integer from page),
        (array_agg(p.seq order by p.rn desc))[1],
        (array_agg(p.root order by p.rn desc))[1],
        (array_agg(p.key order by p.rn desc))[1]
        into rows_out, taken, fetched, last_seq, last_root, last_key
    from picked p;
    more := fetched > taken;
    return jsonb_build_object('tenant', p_tenant, 'head', head, 'purged', purged, 'tombstones_after', threshold,
        'now', private.zoe_now_ms(), 'rows', rows_out, 'more', more,
        'next', case when more then jsonb_build_object('seq', last_seq, 'root', last_root, 'key', last_key) else 'null'::jsonb end);
end
$$;

notify pgrst,'reload schema';
