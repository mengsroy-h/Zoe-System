create table public.zoe_business_audit (
    event_id uuid not null default gen_random_uuid(),
    archive_seq bigint generated always as identity,
    archive_imported_at timestamptz,
    schema_version smallint not null default 1 check (schema_version = 1),
    tenant_id uuid not null,
    origin_tenant_id uuid not null,
    operation_id text not null check (operation_id ~ '^[A-Za-z0-9_-]{1,128}$'),
    seq bigint not null check (seq > 0),
    actor_uid uuid,
    actor_kind text not null check (actor_kind in ('user', 'admin', 'system')),
    origin text not null check (origin in ('app_engine', 'admin_engine', 'direct_sql')),
    root text not null check(root in ('zoew_scan_history_cod_dod','zoew_recently_deleted_cod_dod','zoew_daily_revenue_cod_dod','zoew_monthly_revenue_cod_dod','zoew_daily_pickup_cod_dod','zoew_daily_collected_cod_dod','zoew_scan_operations','zoew_trash_consumptions','zoew_restore_finalizations','zoew_registry_releases')),
    record_key text not null,
    action text not null,
    reason text not null,
    status_source text not null default 'stored_business_state' check (status_source = 'stored_business_state'),
    previous_status jsonb not null,
    new_status jsonb not null,
    before_value jsonb not null,
    after_value jsonb not null,
    changed_fields text[] not null check (cardinality(changed_fields) <= 32),
    changed_fields_truncated boolean not null,
    summary_unchanged boolean not null,
    projection_scope text not null default 'bounded_business_fields' check (projection_scope='bounded_business_fields'),
    committed_at timestamptz not null default clock_timestamp(),
    primary key(tenant_id,event_id),
    check (octet_length(before_value::text) + octet_length(after_value::text) <= 131072)
);
create unique index zoe_business_audit_archive_order on public.zoe_business_audit(tenant_id,archive_seq);
create index zoe_business_audit_tenant_time on public.zoe_business_audit(tenant_id, committed_at desc, event_id);
create index zoe_business_audit_record on public.zoe_business_audit(tenant_id, root, record_key, committed_at desc, event_id);
create index zoe_business_audit_operation on public.zoe_business_audit(tenant_id, operation_id, event_id);
alter table public.zoe_business_audit enable row level security;
revoke all on public.zoe_business_audit from public, anon, authenticated, service_role;
revoke all on sequence public.zoe_business_audit_archive_seq_seq from public,anon,authenticated,service_role;
grant select on public.zoe_business_audit to authenticated;
create policy zoe_business_audit_read on public.zoe_business_audit for select to authenticated
    using (tenant_id = (select private.current_tenant_id()));

create function private.zoe_audit_fields_v1(p_value jsonb, p_compact boolean default false) returns jsonb
language plpgsql immutable security invoker set search_path = ''
as $$
declare
    result jsonb := '{}'::jsonb;
    field text;
    value jsonb;
    text_value text;
    fields text[] := case when p_compact then array['code','barcode','cod','dod','c','d','createdAt','restoredAt','isClosed','isDeducted','ztoSignedAt','ztoSignedExact','ztoReturnedAt','ztoSentOutAt','ztoMisplacedAt','restoreBlocked']
        else array['id','sourceId','targetId','restoreClaimId','restoreSourceId','restorePendingClaimId','restoreSourceGeneration','code','barcode','cod','dod','price','count','codDollar','dodDollar','totalCount','packagesPickedUp','pickupRevision','pickupResetEpoch','trashGeneration','generation','birth','rowBirth','createdAt','deletedAt','claimedAt','finalizedAt','closedAt','restoredAt','ztoSignedAt','ztoSignedExact','ztoReturnedAt','ztoSentOutAt','ztoMisplacedAt','isClosed','isDeducted','restoreBlocked','isFromDeletion','isCalled','trashReason','trashMode','phase','kind','c','d'] end;
begin
    if jsonb_typeof(p_value) <> 'object' then return result; end if;
    foreach field in array fields loop
        value := p_value -> field;
        if value is null or value = 'null'::jsonb then continue; end if;
        if jsonb_typeof(value) in ('number','boolean') then
            if octet_length(value::text) <= 48 then result := result || jsonb_build_object(field,value);
            else result := result || jsonb_build_object(field,jsonb_build_object('truncated',true,'sha256',encode(sha256(convert_to(value::text,'UTF8')),'hex'))); end if;
        elsif jsonb_typeof(value) = 'string' then
            text_value := value #>> '{}';
            if field = 'trashReason' and text_value not in ('delete','remove','pickup','returned')
                or field = 'trashMode' and text_value not in ('local','cookie','palm')
                or field = 'phase' and text_value not in ('admitted','prepared','committed','cancelled')
                or field = 'kind' and text_value not in ('restore','purge') then continue; end if;
            if field in ('id','sourceId','targetId','restoreClaimId','restoreSourceId','restorePendingClaimId','restoreSourceGeneration','code','barcode','trashReason','trashMode','phase','kind') then
                result := result || jsonb_build_object(field,left(text_value,128));
                if length(text_value) > 128 then result := result || jsonb_build_object(field || 'Bounds',jsonb_build_object('truncated',true,'length',length(text_value),'sha256',encode(sha256(convert_to(text_value,'UTF8')),'hex'))); end if;
            end if;
        end if;
    end loop;
    return result;
end
$$;

create function private.zoe_audit_entries_v1(p_value jsonb) returns table(key text, value jsonb)
language sql immutable security invoker set search_path = ''
as $$
    select e.key,e.value from jsonb_each(case when jsonb_typeof(p_value) = 'object' then p_value else '{}'::jsonb end) e
    union all
    select (e.ordinality - 1)::text,e.value from jsonb_array_elements(case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end) with ordinality e
$$;

create function private.zoe_audit_members_v1(p_members jsonb, p_keyed boolean default false, p_parent_created numeric default 0) returns jsonb
language sql immutable security invoker set search_path = ''
as $$
    with projected as materialized (
        select e.key, e.value, private.zoe_audit_fields_v1(e.value,true)
            || case when p_keyed then jsonb_build_object('entryKey',left(e.key,128),'entryKeyTruncated',length(e.key)>128) else '{}'::jsonb end as projected,
            row_number() over(order by e.key) as ordinal
        from private.zoe_audit_entries_v1(p_members) e
    )
    select jsonb_build_object('total',count(*),'sampleLimit',20,'truncated',count(*) > 20,
        'sample',coalesce(jsonb_agg(p.projected order by p.key) filter(where p.ordinal <= 20),'[]'::jsonb),
        'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_array(p.key,p.projected)::text,',' order by p.key),''),'UTF8')),'hex'),
        'closed',count(*) filter(where p.value -> 'isClosed' = 'true'::jsonb),
        'deducted',count(*) filter(where p.value -> 'isDeducted' = 'true'::jsonb),
        'signed',count(*) filter(where jsonb_typeof(p.value -> 'ztoSignedAt') = 'number' and (p.value ->> 'ztoSignedAt')::numeric > 0),
        'returnEvidence',count(*) filter(where jsonb_typeof(p.value -> 'ztoReturnedAt') = 'number' and (p.value ->> 'ztoReturnedAt')::numeric > 0),
        'returned',count(*) filter(where p.value -> 'isClosed' is distinct from 'true'::jsonb and jsonb_typeof(p.value -> 'ztoReturnedAt') = 'number' and (p.value ->> 'ztoReturnedAt')::numeric >= greatest(case when jsonb_typeof(p.value -> 'createdAt')='number' and (p.value ->> 'createdAt')::numeric <> 0 then (p.value ->> 'createdAt')::numeric else p_parent_created end,case when jsonb_typeof(p.value -> 'restoredAt')='number' then (p.value ->> 'restoredAt')::numeric else 0 end) and (p.value ->> 'ztoReturnedAt')::numeric > greatest(0,case when jsonb_typeof(p.value -> 'ztoSentOutAt')='number' then (p.value ->> 'ztoSentOutAt')::numeric else 0 end,case when jsonb_typeof(p.value -> 'ztoMisplacedAt')='number' then (p.value ->> 'ztoMisplacedAt')::numeric else 0 end)))
        || private.zoe_audit_fields_v1(jsonb_build_object('cod',coalesce(sum(case when jsonb_typeof(p.value -> 'cod')='number' then (p.value ->> 'cod')::numeric when jsonb_typeof(p.value -> 'c')='number' then (p.value ->> 'c')::numeric else 0 end),0),
        'dod',coalesce(sum(case when jsonb_typeof(p.value -> 'dod')='number' then (p.value ->> 'dod')::numeric when jsonb_typeof(p.value -> 'd')='number' then (p.value ->> 'd')::numeric else 0 end),0)),true)
    from projected p
$$;

create function private.zoe_audit_codes_v1(p_codes text) returns jsonb
language plpgsql immutable security invoker set search_path = ''
as $$
declare parsed jsonb;sample jsonb;total bigint;
begin
    begin parsed:=p_codes::jsonb;exception when invalid_text_representation then return jsonb_build_object('malformed',true);end;
    if jsonb_typeof(parsed) is distinct from 'array' or exists(select 1 from jsonb_array_elements(parsed) e where jsonb_typeof(e.value)<>'string') then return jsonb_build_object('malformed',true);end if;
    total:=jsonb_array_length(parsed);
    select coalesce(jsonb_agg(jsonb_build_object('code',left(e.value #>> '{}',128),'truncated',length(e.value #>> '{}')>128) order by e.ordinality),'[]'::jsonb)
        into sample from jsonb_array_elements(parsed) with ordinality e where e.ordinality<=20;
    return jsonb_build_object('total',total,'sample',sample,'sampleLimit',20,'truncated',total>20,'sha256',encode(sha256(convert_to(parsed::text,'UTF8')),'hex'));
end
$$;

create function private.zoe_audit_summary_v1(p_root text,p_value jsonb) returns jsonb
language plpgsql immutable security invoker set search_path = ''
as $$
declare
    result jsonb;
    members jsonb;
    evidence text;
    claim jsonb;
    field text;
begin
    if p_value is null or p_value = 'null'::jsonb then return jsonb_build_object('exists',false,'location','absent'); end if;
    result := private.zoe_audit_fields_v1(p_value) || jsonb_build_object('exists',true,'location',case p_root when 'zoew_scan_history_cod_dod' then 'history' when 'zoew_recently_deleted_cod_dod' then 'trash' else 'business_record' end);
    if p_root in ('zoew_scan_history_cod_dod','zoew_recently_deleted_cod_dod') then
        members := p_value -> 'barcodes';
        if members is null and jsonb_typeof(p_value -> 'barcode')='string' then members := jsonb_build_array(private.zoe_audit_fields_v1(p_value,true) || jsonb_build_object('code',p_value -> 'barcode')); end if;
        result := result || jsonb_build_object('barcodes',private.zoe_audit_members_v1(members,false,case when jsonb_typeof(p_value -> 'createdAt')='number' then (p_value ->> 'createdAt')::numeric else 0 end));
    elsif p_root='zoew_daily_collected_cod_dod' then
        result := result || jsonb_build_object('collected',private.zoe_audit_members_v1(p_value,true));
    elsif p_root='zoew_daily_pickup_cod_dod' then
        result := result || jsonb_build_object('pickedUpPhoneCount',(select count(*) from private.zoe_audit_entries_v1(p_value -> 'pickedUpPhones')),
            'pickedUpBarcodes',private.zoe_audit_members_v1(p_value -> 'pickedUpBarcodes',true));
    end if;
    foreach field in array array['ops','ded','back','undo'] loop
        if jsonb_typeof(p_value -> field)='object' then result := result || jsonb_build_object(field || 'Count',(select count(*) from jsonb_object_keys(p_value -> field))); end if;
    end loop;
    claim := p_value -> 'restoreClaim';
    if jsonb_typeof(claim)='object' then
        result := result || jsonb_build_object('restoreClaim',private.zoe_audit_fields_v1(claim));
        if jsonb_typeof(claim -> 'token')='string' then result := result || jsonb_build_object('claimCorrelationHash',encode(sha256(convert_to(claim ->> 'token','UTF8')),'hex')); end if;
    end if;
    if p_root='zoew_scan_history_cod_dod' and jsonb_typeof(p_value -> 'restoreAddedCodes')='string' then result:=result || jsonb_build_object('restoreAddedCodes',private.zoe_audit_codes_v1(p_value ->> 'restoreAddedCodes'));end if;
    if p_root='zoew_scan_history_cod_dod' and jsonb_typeof(p_value -> 'restoreClaimToken')='string' then result:=result || jsonb_build_object('claimCorrelationHash',encode(sha256(convert_to(p_value ->> 'restoreClaimToken','UTF8')),'hex'));end if;
    if p_root in ('zoew_trash_consumptions','zoew_restore_finalizations') and jsonb_typeof(p_value -> 'token')='string' then
        result := result || jsonb_build_object('claimCorrelationHash',encode(sha256(convert_to(p_value ->> 'token','UTF8')),'hex'));
    end if;
    return result;
end
$$;

create function private.zoe_audit_status_v1(p_summary jsonb) returns jsonb
language sql immutable security invoker set search_path = ''
as $$
    select jsonb_strip_nulls(jsonb_build_object('exists',p_summary -> 'exists','location',p_summary -> 'location',
        'zoewClosed',p_summary -> 'isClosed','deducted',p_summary -> 'isDeducted','restoreBlocked',p_summary -> 'restoreBlocked',
        'trashReason',p_summary -> 'trashReason','trashMode',p_summary -> 'trashMode','phase',p_summary -> 'phase','kind',p_summary -> 'kind',
        'barcodeCount',p_summary #> '{barcodes,total}','closedCount',p_summary #> '{barcodes,closed}',
        'deductedCount',p_summary #> '{barcodes,deducted}','observedSignedCount',p_summary #> '{barcodes,signed}',
        'effectiveReturnedCount',p_summary #> '{barcodes,returned}','observedReturnEvidenceCount',p_summary #> '{barcodes,returnEvidence}','ztoSignedAt',p_summary -> 'ztoSignedAt','ztoReturnedAt',p_summary -> 'ztoReturnedAt'))
$$;

create function private.zoe_business_audit_capture_v1() returns trigger
language plpgsql volatile security definer set search_path = ''
as $$
declare
    old_value jsonb;
    new_value jsonb;
    tenant uuid;
    row_root text;
    row_key text;
    row_seq bigint;
    operation text;
    origin_kind text := 'direct_sql';
    actor uuid := auth.uid();
    context jsonb;
    before_summary jsonb;
    after_summary jsonb;
    fields text[];
    event_action text;
    event_reason text;
begin
    if tg_op = 'DELETE' then tenant:=old.tenant_id;row_root:=old.root;row_key:=old.key;row_seq:=old.seq;old_value:=old.value;
    else tenant:=new.tenant_id;row_root:=new.root;row_key:=new.key;row_seq:=new.seq;new_value:=new.value;if tg_op='UPDATE' then old_value:=old.value;end if;end if;
    if old_value is not distinct from new_value or row_root not in ('zoew_scan_history_cod_dod','zoew_recently_deleted_cod_dod','zoew_daily_revenue_cod_dod','zoew_monthly_revenue_cod_dod','zoew_daily_pickup_cod_dod','zoew_daily_collected_cod_dod','zoew_scan_operations','zoew_trash_consumptions','zoew_restore_finalizations','zoew_registry_releases') then return null;end if;
    begin context:=nullif(current_setting('zoe.audit_context',true),'')::jsonb;exception when invalid_text_representation then context:=null;end;
    if context ->> 'tenant' = tenant::text and context ->> 'operation' ~ '^[A-Za-z0-9_-]{16,64}$' and context ->> 'origin' in ('app_engine','admin_engine') then
        operation:=context ->> 'operation';origin_kind:=context ->> 'origin';
    else operation:='sql_' || txid_current()::text || '_' || floor(extract(epoch from statement_timestamp())*1000000)::bigint::text;end if;
    before_summary:=private.zoe_audit_summary_v1(row_root,old_value);after_summary:=private.zoe_audit_summary_v1(row_root,new_value);
    select coalesce(array_agg(k order by k),'{}'::text[]) into fields from (select jsonb_object_keys(before_summary) k union select jsonb_object_keys(after_summary)) f where before_summary -> k is distinct from after_summary -> k;
    event_action:=case when old_value is null then 'create' when new_value is null then 'delete' else 'update' end;
    event_reason:=case when new_value is null then 'record_removed' when old_value is null then 'record_created' else 'stored_fields_changed' end;
    if row_root='zoew_recently_deleted_cod_dod' then
        event_reason:=coalesce(after_summary ->> 'trashReason',before_summary ->> 'trashReason',event_reason);
        if old_value is null then event_action:=case event_reason when 'delete' then 'delete' when 'remove' then 'remove' when 'pickup' then 'cleanup' when 'returned' then 'cleanup' else event_action end;end if;
    elsif row_root='zoew_trash_consumptions' and after_summary ->> 'kind' in ('restore','purge') then event_action:=after_summary ->> 'kind';event_reason:='stored_consumption';
    elsif after_summary #>> '{barcodes,signed}' is distinct from before_summary #>> '{barcodes,signed}' and coalesce((after_summary #>> '{barcodes,signed}')::bigint,0)>coalesce((before_summary #>> '{barcodes,signed}')::bigint,0) then event_action:='observed_zto_sign';event_reason:='stored_positive_sign_mark';
    elsif after_summary #>> '{barcodes,returned}' is distinct from before_summary #>> '{barcodes,returned}' and coalesce((after_summary #>> '{barcodes,returned}')::bigint,0)>coalesce((before_summary #>> '{barcodes,returned}')::bigint,0) then event_action:='observed_zto_return';event_reason:='stored_positive_return_mark';
    end if;
    insert into public.zoe_business_audit(tenant_id,origin_tenant_id,operation_id,seq,actor_uid,actor_kind,origin,root,record_key,action,reason,previous_status,new_status,before_value,after_value,changed_fields,changed_fields_truncated,summary_unchanged)
    values(tenant,tenant,operation,row_seq,actor,case when origin_kind='admin_engine' then 'admin' when actor is not null then 'user' else 'system' end,origin_kind,row_root,row_key,event_action,event_reason,
        private.zoe_audit_status_v1(before_summary),private.zoe_audit_status_v1(after_summary),before_summary,after_summary,fields[1:32],cardinality(fields)>32,before_summary=after_summary);
    return null;
end
$$;
create trigger zoe_business_audit_capture after insert or update or delete on public.zoe_docs
for each row execute function private.zoe_business_audit_capture_v1();
revoke all on function private.zoe_audit_fields_v1(jsonb,boolean),private.zoe_audit_entries_v1(jsonb),private.zoe_audit_members_v1(jsonb,boolean,numeric),private.zoe_audit_summary_v1(text,jsonb),private.zoe_audit_codes_v1(text),private.zoe_audit_status_v1(jsonb),private.zoe_business_audit_capture_v1() from public,anon,authenticated,service_role;

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

notify pgrst, 'reload schema';

create function private.zoe_audit_export_row_v1(p_row public.zoe_business_audit) returns jsonb
language sql immutable security invoker set search_path = ''
as $$ select (to_jsonb(p_row)-'archive_seq'-'archive_imported_at') || jsonb_build_object('seq',p_row.seq::text,'committed_at',to_char(p_row.committed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) $$;
revoke all on function private.zoe_audit_export_row_v1(public.zoe_business_audit) from public,anon,authenticated,service_role;

create function public.zoe_admin_audit_tenants(p_after uuid default null,p_limit integer default 200) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare lim integer:=least(greatest(coalesce(p_limit,200),1),500);ids uuid[];more boolean;
begin
    with recursive candidates(tenant_id,ordinal) as (
        select case when p_after is null then (select a.tenant_id from public.zoe_business_audit a order by a.tenant_id limit 1)
            else (select a.tenant_id from public.zoe_business_audit a where a.tenant_id>p_after order by a.tenant_id limit 1) end,1
        union all
        select (select a.tenant_id from public.zoe_business_audit a where a.tenant_id>c.tenant_id order by a.tenant_id limit 1),c.ordinal+1
        from candidates c where c.tenant_id is not null and c.ordinal<=lim
    )
    select array_agg(c.tenant_id order by c.ordinal) filter(where c.tenant_id is not null) into ids from candidates c;
    more:=coalesce(cardinality(ids),0)>lim;
    return jsonb_build_object('tenants',coalesce(to_jsonb(ids[1:lim]),'[]'::jsonb),'more',more,'next',case when more then to_jsonb(ids[lim]) else 'null'::jsonb end);
end
$$;

create function public.zoe_admin_audit_export(p_tenant uuid,p_after bigint default 0,p_through bigint default null,p_limit integer default 200,p_max_bytes integer default 1048576) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
    lim integer:=least(greatest(coalesce(p_limit,200),1),500);
    max_bytes integer:=least(greatest(coalesce(p_max_bytes,1048576),65536),4194304);
    through_seq bigint;after_seq bigint:=coalesce(p_after,0);rows_out jsonb;taken integer;fetched integer;last_seq bigint;more boolean;
begin
    if p_tenant is null or after_seq<0 or p_through<0 or p_through is not null and after_seq>p_through then raise exception 'invalid-audit-cursor' using errcode='22023';end if;
    select coalesce(max(a.archive_seq),0) into through_seq from public.zoe_business_audit a where a.tenant_id=p_tenant;
    if p_through is not null then through_seq:=least(through_seq,p_through);end if;
    with page as materialized(
        select a.archive_seq,private.zoe_audit_export_row_v1(a) as value from public.zoe_business_audit a
        where a.tenant_id=p_tenant and a.archive_seq>after_seq and a.archive_seq<=through_seq order by a.archive_seq limit lim+1
    ),sizes as(
        select p.*,row_number() over(order by p.archive_seq) as ordinal,sum(octet_length(p.value::text)) over(order by p.archive_seq) as bytes from page p
    ),picked as(
        select * from sizes where ordinal<=lim and (ordinal=1 or bytes<=max_bytes)
    )
    select coalesce(('[' || string_agg(p.value::text,',' order by p.archive_seq) || ']')::jsonb,'[]'::jsonb),count(*)::integer,(select count(*)::integer from page),max(p.archive_seq)
        into rows_out,taken,fetched,last_seq from picked p;
    more:=fetched>taken;
    return jsonb_build_object('v',1,'tenant',p_tenant,'through',through_seq::text,'rows',rows_out,'more',more,'next',case when more then to_jsonb(last_seq::text) else 'null'::jsonb end);
end
$$;

create function private.zoe_audit_archive_summary_v1(p_summary jsonb) returns boolean
language plpgsql immutable security invoker set search_path = ''
as $$
declare
    entry jsonb;key_name text;
    allowed text[]:=array['id','sourceId','targetId','restoreClaimId','restoreSourceId','restorePendingClaimId','restoreSourceGeneration','code','barcode','cod','dod','price','count','codDollar','dodDollar','totalCount','packagesPickedUp','pickupRevision','pickupResetEpoch','trashGeneration','generation','birth','rowBirth','createdAt','deletedAt','claimedAt','finalizedAt','closedAt','restoredAt','ztoSignedAt','ztoSignedExact','ztoReturnedAt','ztoSentOutAt','ztoMisplacedAt','isClosed','isDeducted','restoreBlocked','isFromDeletion','isCalled','trashReason','trashMode','phase','kind','c','d','exists','location','barcodes','collected','pickedUpPhoneCount','pickedUpBarcodes','opsCount','dedCount','backCount','undoCount','restoreClaim','claimCorrelationHash','restoreAddedCodes','total','sampleLimit','truncated','sample','sha256','closed','deducted','signed','returnEvidence','returned','entryKey','entryKeyTruncated','length','malformed','zoewClosed','barcodeCount','closedCount','deductedCount','observedSignedCount','effectiveReturnedCount','observedReturnEvidenceCount'];
begin
    if jsonb_typeof(p_summary) is distinct from 'object' or jsonb_typeof(p_summary -> 'exists') is distinct from 'boolean' or (p_summary ->> 'location' in ('absent','history','trash','business_record')) is not true then return false;end if;
    for entry in select jsonb_path_query(p_summary,'strict $.** ? (@.type() == "object").keyvalue()') loop
        key_name:=entry ->> 'key';
        if not(key_name=any(allowed)) and not (right(key_name,6)='Bounds' and left(key_name,length(key_name)-6)=any(allowed)) then return false;end if;
    end loop;
    return true;
end
$$;
revoke all on function private.zoe_audit_archive_summary_v1(jsonb) from public,anon,authenticated,service_role;

create function public.zoe_admin_audit_restore(p_target_tenant uuid,p_source_tenant uuid,p_events jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
    event jsonb;candidate public.zoe_business_audit;existing public.zoe_business_audit;incoming jsonb;prior jsonb;
    imported integer:=0;replayed integer:=0;field_count integer;
    fields text[]:=array['event_id','schema_version','tenant_id','origin_tenant_id','operation_id','seq','actor_uid','actor_kind','origin','root','record_key','action','reason','status_source','previous_status','new_status','before_value','after_value','changed_fields','changed_fields_truncated','summary_unchanged','projection_scope','committed_at'];
begin
    if p_target_tenant is null or not exists(select 1 from public.tenants where id=p_target_tenant) then raise exception 'tenant-not-found' using errcode='P0002';end if;
    if p_source_tenant is null or jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)>500 or octet_length(p_events::text)>4194304 then raise exception 'invalid-audit-archive' using errcode='22023';end if;
    insert into public.zoe_tenant_state(tenant_id) values(p_target_tenant) on conflict do nothing;
    perform 1 from public.zoe_tenant_state where tenant_id=p_target_tenant for update;
    for event in select jsonb_array_elements(p_events) loop
        if jsonb_typeof(event) is distinct from 'object' or not(event ?& fields) or (select count(*) from jsonb_object_keys(event))<>cardinality(fields)
            or event -> 'schema_version' is distinct from '1'::jsonb or event ->> 'tenant_id' is distinct from p_source_tenant::text
            or jsonb_typeof(event -> 'seq') is distinct from 'string' or event ->> 'seq' !~ '^[1-9][0-9]{0,18}$' or event ->> 'committed_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$'
            or jsonb_typeof(event -> 'changed_fields') is distinct from 'array' or exists(select 1 from jsonb_array_elements(event -> 'changed_fields') e where jsonb_typeof(e.value)<>'string' or not(event -> 'before_value' ? (e.value #>> '{}') or event -> 'after_value' ? (e.value #>> '{}')))
            or not private.zoe_audit_archive_summary_v1(event -> 'previous_status') or not private.zoe_audit_archive_summary_v1(event -> 'new_status')
            or not private.zoe_audit_archive_summary_v1(event -> 'before_value') or not private.zoe_audit_archive_summary_v1(event -> 'after_value')
            or (event ->> 'action' in ('create','update','delete','remove','cleanup','restore','purge','observed_zto_sign','observed_zto_return')) is not true
            or (event ->> 'reason' in ('record_created','record_removed','stored_fields_changed','delete','remove','pickup','returned','stored_consumption','stored_positive_sign_mark','stored_positive_return_mark')) is not true then
            raise exception 'invalid-audit-archive' using errcode='22023';
        end if;
        begin
            candidate:=jsonb_populate_record(null::public.zoe_business_audit,event || jsonb_build_object('tenant_id',p_target_tenant));
        exception when others then raise exception 'invalid-audit-archive' using errcode='22023';end;
        if candidate.event_id is null or candidate.operation_id is null or candidate.operation_id !~ '^[A-Za-z0-9_-]{1,128}$' or candidate.seq is null or candidate.seq<=0
            or candidate.root not in ('zoew_scan_history_cod_dod','zoew_recently_deleted_cod_dod','zoew_daily_revenue_cod_dod','zoew_monthly_revenue_cod_dod','zoew_daily_pickup_cod_dod','zoew_daily_collected_cod_dod','zoew_scan_operations','zoew_trash_consumptions','zoew_restore_finalizations','zoew_registry_releases') or not private.zoe_key_ok(candidate.record_key)
            or candidate.origin_tenant_id is null or candidate.committed_at is null or candidate.root is null or candidate.record_key is null
            or (candidate.actor_kind in ('user','admin','system')) is not true or (candidate.origin in ('app_engine','admin_engine','direct_sql')) is not true or candidate.projection_scope is distinct from 'bounded_business_fields' or candidate.status_source is distinct from 'stored_business_state'
            or octet_length(candidate.before_value::text)+octet_length(candidate.after_value::text)>131072
            or candidate.actor_kind='user' and candidate.actor_uid is null or candidate.actor_kind='system' and candidate.actor_uid is not null
            or candidate.origin='app_engine' and candidate.actor_kind<>'user' or candidate.origin='admin_engine' and candidate.actor_kind<>'admin'
            or candidate.changed_fields is null or cardinality(candidate.changed_fields)>32 or candidate.changed_fields_truncated is null or candidate.summary_unchanged is null then raise exception 'invalid-audit-archive' using errcode='22023';end if;
        incoming:=private.zoe_audit_export_row_v1(candidate);
        select * into existing from public.zoe_business_audit where tenant_id=p_target_tenant and event_id=candidate.event_id;
        if found then
            prior:=private.zoe_audit_export_row_v1(existing);
            if prior is distinct from incoming then raise exception 'audit-event-conflict' using errcode='PT409';end if;
            replayed:=replayed+1;continue;
        end if;
        insert into public.zoe_business_audit(event_id,schema_version,tenant_id,origin_tenant_id,operation_id,seq,actor_uid,actor_kind,origin,root,record_key,action,reason,status_source,previous_status,new_status,before_value,after_value,changed_fields,changed_fields_truncated,summary_unchanged,projection_scope,committed_at,archive_imported_at)
        values(candidate.event_id,candidate.schema_version,p_target_tenant,candidate.origin_tenant_id,candidate.operation_id,candidate.seq,candidate.actor_uid,candidate.actor_kind,candidate.origin,candidate.root,candidate.record_key,candidate.action,candidate.reason,candidate.status_source,candidate.previous_status,candidate.new_status,candidate.before_value,candidate.after_value,candidate.changed_fields,candidate.changed_fields_truncated,candidate.summary_unchanged,candidate.projection_scope,candidate.committed_at,clock_timestamp());
        imported:=imported+1;
    end loop;
    return jsonb_build_object('v',1,'tenant',p_target_tenant,'source_tenant',p_source_tenant,'imported',imported,'replayed',replayed,'total',imported+replayed);
end
$$;
revoke all on function public.zoe_admin_audit_tenants(uuid,integer),public.zoe_admin_audit_export(uuid,bigint,bigint,integer,integer),public.zoe_admin_audit_restore(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.zoe_admin_audit_tenants(uuid,integer),public.zoe_admin_audit_export(uuid,bigint,bigint,integer,integer),public.zoe_admin_audit_restore(uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
