create function private.zoe_restore_terminal_business_v1(p_before jsonb,p_current jsonb,p_source_id text) returns boolean
language plpgsql immutable security invoker set search_path=''
as $$
declare old_rank integer;new_rank integer;old_publication numeric:=0;new_publication numeric:=0;field text;slot text;old_row jsonb;new_row jsonb;old_value jsonb;new_value jsonb;
begin
    if jsonb_typeof(p_before) is distinct from 'object' or jsonb_typeof(p_current) is distinct from 'object' then return false;end if;
    if p_before ? 'id' then
        if p_before->>'id' is distinct from p_source_id or p_current->'id' is distinct from p_before->'id' then return false;end if;
    elsif p_current ? 'id' and p_current->>'id' is distinct from p_source_id then return false;end if;
    if p_before->'restoreBlocked' is distinct from p_current->'restoreBlocked' and p_current->'restoreBlocked' is distinct from 'true'::jsonb then return false;end if;
    foreach field in array array['restorePublication'] loop
        if p_before ? field then
            if jsonb_typeof(p_before->field) is distinct from 'number' then return false;end if;
            old_publication:=(p_before->>field)::numeric;
            if old_publication not between 1 and 9007199254740990 or old_publication<>trunc(old_publication) then return false;end if;
        end if;
        if p_current ? field then
            if jsonb_typeof(p_current->field) is distinct from 'number' then return false;end if;
            new_publication:=(p_current->>field)::numeric;
            if new_publication not between 1 and 9007199254740990 or new_publication<>trunc(new_publication) then return false;end if;
        end if;
    end loop;
    if new_publication<old_publication then return false;end if;
    old_rank:=case when not(p_before ? 'ztoTerminalDecision') then 0 when p_before->'ztoTerminalDecision'='"returned"'::jsonb then 1 when p_before->'ztoTerminalDecision'='"signed"'::jsonb then 2 else -1 end;
    new_rank:=case when not(p_current ? 'ztoTerminalDecision') then 0 when p_current->'ztoTerminalDecision'='"returned"'::jsonb then 1 when p_current->'ztoTerminalDecision'='"signed"'::jsonb then 2 else -1 end;
    if old_rank<0 or new_rank<old_rank then return false;end if;
    if (p_before-array['id','restoreBlocked','restoreClaim','restoreAttestationId','restorePublication','ztoTerminalDecision','barcodes']) is distinct from
        (p_current-array['id','restoreBlocked','restoreClaim','restoreAttestationId','restorePublication','ztoTerminalDecision','barcodes']) then return false;end if;
    if jsonb_typeof(p_before->'barcodes') is distinct from jsonb_typeof(p_current->'barcodes') then return false;end if;
    if jsonb_typeof(p_before->'barcodes') is null or jsonb_typeof(p_before->'barcodes') not in ('object','array') then return (p_before->'barcodes') is not distinct from (p_current->'barcodes');end if;
    if jsonb_typeof(p_before->'barcodes')='array' then
        if jsonb_array_length(p_before->'barcodes')<>jsonb_array_length(p_current->'barcodes') then return false;end if;
    elsif (select coalesce(jsonb_agg(key order by key),'[]'::jsonb) from jsonb_object_keys(p_before->'barcodes')key) is distinct from
        (select coalesce(jsonb_agg(key order by key),'[]'::jsonb) from jsonb_object_keys(p_current->'barcodes')key) then return false;end if;
    for slot,old_row in select e.key,e.value from jsonb_each(case when jsonb_typeof(p_before->'barcodes')='object' then p_before->'barcodes' else '{}'::jsonb end)e
        union all select (e.ordinality-1)::text,e.value from jsonb_array_elements(case when jsonb_typeof(p_before->'barcodes')='array' then p_before->'barcodes' else '[]'::jsonb end) with ordinality e loop
        new_row:=case when jsonb_typeof(p_current->'barcodes')='array' then (p_current->'barcodes')->slot::integer else (p_current->'barcodes')->slot end;
        if jsonb_typeof(new_row)='object' and new_row->'ztoSignedExact'='true'::jsonb then
            if jsonb_typeof(new_row->'ztoSignedAt') is distinct from 'number' then return false;end if;
            if (new_row->>'ztoSignedAt')::double precision<=0 then return false;end if;
        end if;
        if old_row is not distinct from new_row then continue;end if;
        if jsonb_typeof(old_row) is distinct from 'object' or jsonb_typeof(new_row) is distinct from 'object' then return false;end if;
        if (old_row-array['ztoSignedAt','ztoReturnedAt','ztoMisplacedAt','ztoSentOutAt','ztoSignedExact']) is distinct from
            (new_row-array['ztoSignedAt','ztoReturnedAt','ztoMisplacedAt','ztoSentOutAt','ztoSignedExact']) then return false;end if;
        foreach field in array array['ztoSignedAt','ztoReturnedAt','ztoMisplacedAt','ztoSentOutAt'] loop
            old_value:=old_row->field;new_value:=new_row->field;
            if old_value is not distinct from new_value then continue;end if;
            if jsonb_typeof(new_value) is distinct from 'number' then return false;end if;
            if (new_value#>>'{}')::numeric not between 1 and 9007199254740990
                or (new_value#>>'{}')::numeric<>trunc((new_value#>>'{}')::numeric) then return false;end if;
            if old_value is null or old_value='null'::jsonb or old_value='0'::jsonb then continue;end if;
            if field<>'ztoSignedAt' or jsonb_typeof(old_value) is distinct from 'number' or (old_value#>>'{}')::numeric<=0
                or (new_row->'ztoSignedExact'='true'::jsonb and (old_row->'ztoSignedExact' is null or old_row->'ztoSignedExact' in ('null'::jsonb,'false'::jsonb))) is not true then return false;end if;
        end loop;
        if old_row->'ztoSignedExact' is distinct from new_row->'ztoSignedExact' and (new_row->'ztoSignedExact'='true'::jsonb
            and (old_row->'ztoSignedExact' is null or old_row->'ztoSignedExact' in ('null'::jsonb,'false'::jsonb))
            and jsonb_typeof(new_row->'ztoSignedAt')='number' and (new_row->>'ztoSignedAt')::numeric between 1 and 9007199254740990
            and (new_row->>'ztoSignedAt')::numeric=trunc((new_row->>'ztoSignedAt')::numeric)) is not true then return false;end if;
    end loop;
    return true;
exception when numeric_value_out_of_range then return false;
end $$;
revoke all on function private.zoe_restore_terminal_business_v1(jsonb,jsonb,text) from public,anon,authenticated,service_role;

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

create or replace function private.zoe_audit_fields_v1(p_value jsonb, p_compact boolean default false) returns jsonb
language plpgsql immutable security invoker set search_path = ''
as $$
declare
    result jsonb := '{}'::jsonb;
    field text;
    value jsonb;
    text_value text;
    fields text[] := case when p_compact then array['code','barcode','cod','dod','c','d','createdAt','restoredAt','isClosed','isDeducted','ztoSignedAt','ztoSignedExact','ztoReturnedAt','ztoSentOutAt','ztoMisplacedAt','restoreBlocked']
        else array['id','sourceId','targetId','restoreClaimId','restoreSourceId','restorePendingClaimId','restoreSourceGeneration','code','barcode','cod','dod','price','count','codDollar','dodDollar','totalCount','packagesPickedUp','pickupRevision','pickupResetEpoch','trashGeneration','generation','birth','rowBirth','createdAt','deletedAt','claimedAt','finalizedAt','closedAt','restoredAt','ztoSignedAt','ztoSignedExact','ztoReturnedAt','ztoSentOutAt','ztoMisplacedAt','isClosed','isDeducted','restoreBlocked','isFromDeletion','isCalled','trashReason','trashMode','ztoTerminalDecision','phase','kind','c','d'] end;
begin
    if jsonb_typeof(p_value) <> 'object' then return result; end if;
    foreach field in array fields loop
        value := p_value -> field;
        if value is null or value = 'null'::jsonb then continue; end if;
        if field='ztoTerminalDecision' and (jsonb_typeof(value) is distinct from 'string' or (value#>>'{}' in ('signed','returned')) is not true) then continue;end if;
        if jsonb_typeof(value) in ('number','boolean') then
            if octet_length(value::text) <= 48 then result := result || jsonb_build_object(field,value);
            else result := result || jsonb_build_object(field,jsonb_build_object('truncated',true,'sha256',encode(sha256(convert_to(value::text,'UTF8')),'hex'))); end if;
        elsif jsonb_typeof(value) = 'string' then
            text_value := value #>> '{}';
            if field = 'trashReason' and text_value not in ('delete','remove','pickup','returned')
                or field = 'trashMode' and text_value not in ('local','cookie','palm')
                or field = 'phase' and text_value not in ('admitted','prepared','committed','cancelled')
                or field = 'kind' and text_value not in ('restore','purge') then continue; end if;
            if field in ('id','sourceId','targetId','restoreClaimId','restoreSourceId','restorePendingClaimId','restoreSourceGeneration','code','barcode','trashReason','trashMode','ztoTerminalDecision','phase','kind') then
                result := result || jsonb_build_object(field,left(text_value,128));
                if length(text_value) > 128 then result := result || jsonb_build_object(field || 'Bounds',jsonb_build_object('truncated',true,'length',length(text_value),'sha256',encode(sha256(convert_to(text_value,'UTF8')),'hex'))); end if;
            end if;
        end if;
    end loop;
    return result;
end
$$;

create or replace function private.zoe_audit_status_v1(p_summary jsonb) returns jsonb
language sql immutable security invoker set search_path = ''
as $$
    select jsonb_strip_nulls(jsonb_build_object('exists',p_summary -> 'exists','location',p_summary -> 'location',
        'zoewClosed',p_summary -> 'isClosed','deducted',p_summary -> 'isDeducted','restoreBlocked',p_summary -> 'restoreBlocked',
        'ztoTerminalDecision',p_summary -> 'ztoTerminalDecision','trashReason',p_summary -> 'trashReason','trashMode',p_summary -> 'trashMode','phase',p_summary -> 'phase','kind',p_summary -> 'kind',
        'barcodeCount',p_summary #> '{barcodes,total}','closedCount',p_summary #> '{barcodes,closed}',
        'deductedCount',p_summary #> '{barcodes,deducted}','observedSignedCount',p_summary #> '{barcodes,signed}',
        'effectiveReturnedCount',p_summary #> '{barcodes,returned}','observedReturnEvidenceCount',p_summary #> '{barcodes,returnEvidence}','ztoSignedAt',p_summary -> 'ztoSignedAt','ztoReturnedAt',p_summary -> 'ztoReturnedAt'))
$$;

create or replace function private.zoe_audit_archive_summary_v1(p_summary jsonb) returns boolean
language plpgsql immutable security invoker set search_path = ''
as $$
declare
    entry jsonb;key_name text;
    allowed text[]:=array['id','sourceId','targetId','restoreClaimId','restoreSourceId','restorePendingClaimId','restoreSourceGeneration','code','barcode','cod','dod','price','count','codDollar','dodDollar','totalCount','packagesPickedUp','pickupRevision','pickupResetEpoch','trashGeneration','generation','birth','rowBirth','createdAt','deletedAt','claimedAt','finalizedAt','closedAt','restoredAt','ztoSignedAt','ztoSignedExact','ztoReturnedAt','ztoSentOutAt','ztoMisplacedAt','isClosed','isDeducted','restoreBlocked','isFromDeletion','isCalled','trashReason','trashMode','ztoTerminalDecision','phase','kind','c','d','exists','location','barcodes','collected','pickedUpPhoneCount','pickedUpBarcodes','opsCount','dedCount','backCount','undoCount','restoreClaim','claimCorrelationHash','restoreAddedCodes','total','sampleLimit','truncated','sample','sha256','closed','deducted','signed','returnEvidence','returned','entryKey','entryKeyTruncated','length','malformed','zoewClosed','barcodeCount','closedCount','deductedCount','observedSignedCount','effectiveReturnedCount','observedReturnEvidenceCount'];
begin
    if jsonb_typeof(p_summary) is distinct from 'object' or jsonb_typeof(p_summary -> 'exists') is distinct from 'boolean' or (p_summary ->> 'location' in ('absent','history','trash','business_record')) is not true then return false;end if;
    for entry in select jsonb_path_query(p_summary,'strict $.** ? (@.type() == "object").keyvalue()') loop
        key_name:=entry ->> 'key';
        if key_name='ztoTerminalDecision' and (entry->'value' in ('"signed"'::jsonb,'"returned"'::jsonb)) is not true then return false;end if;
        if not(key_name=any(allowed)) and not (right(key_name,6)='Bounds' and left(key_name,length(key_name)-6)=any(allowed)) then return false;end if;
    end loop;
    return true;
end
$$;
