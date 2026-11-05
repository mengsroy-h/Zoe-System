create function private.zoe_pickup_reset_text_v1(p_value jsonb) returns boolean
language sql immutable set search_path = ''
as $$ select coalesce(jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') > 0, false) $$;

create function private.zoe_pickup_reset_receipt_v1(p_value jsonb) returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
    fields text[] := array['v','outcome','proof','tenant','actorUid','scope','batchId','batchHash','dayId','day','nonce','attemptId','intentHash','beforeRevision','beforeEpoch','afterRevision','afterEpoch'];
    field text;
begin
    if jsonb_typeof(p_value) is distinct from 'object' then return false; end if;
    if not (p_value ?& fields) or (select count(*) from jsonb_object_keys(p_value)) <> 17
        or p_value -> 'v' is distinct from '1'::jsonb or p_value ->> 'outcome' is distinct from 'applied'
        or (p_value ->> 'proof' in ('operation','native-day')) is not true then return false; end if;
    foreach field in array array['tenant','actorUid','scope','batchId','batchHash','dayId','day','nonce','attemptId','intentHash'] loop
        if not private.zoe_pickup_reset_text_v1(p_value -> field) then return false; end if;
    end loop;
    if p_value ->> 'batchHash' !~ '^[a-f0-9]{64}$' or p_value ->> 'attemptId' !~ '^[a-f0-9]{64}$'
        or p_value -> 'intentHash' is distinct from p_value -> 'attemptId'
        or p_value ->> 'day' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or (p_value ->> 'dayId') collate "C" is distinct from ((p_value ->> 'batchId') || ':' || (p_value ->> 'day')) collate "C"
        or not private.zoe_purge_integer_v1(p_value -> 'beforeRevision') or not private.zoe_purge_integer_v1(p_value -> 'beforeEpoch')
        or not private.zoe_purge_integer_v1(p_value -> 'afterRevision', 1) or not private.zoe_purge_integer_v1(p_value -> 'afterEpoch', 1) then return false; end if;
    return ((p_value ->> 'beforeRevision')::bigint <> 0 or (p_value ->> 'beforeEpoch')::bigint = 0)
        and (p_value ->> 'afterRevision')::bigint = (p_value ->> 'beforeRevision')::bigint + 1
        and (p_value ->> 'afterEpoch')::bigint = (p_value ->> 'beforeEpoch')::bigint + 1;
end
$$;

create function private.zoe_pickup_reset_intent_v1(p_tenant uuid, p_uid uuid, p_attempt_id text, p_context jsonb, p_cas_text text) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
    op jsonb;
    basis jsonb;
    desired jsonb;
    proof jsonb;
    field text;
    before_revision bigint := 0;
    before_epoch bigint := 0;
    after_revision bigint;
    after_epoch bigint;
    preimage text;
    digest text;
begin
    if p_tenant is null or p_uid is null or p_attempt_id is null or p_attempt_id !~ '^[a-f0-9]{64}$'
        or jsonb_typeof(p_context) is distinct from 'object' or p_cas_text is null then
        raise exception 'invalid-reset-intent' using errcode = '22023';
    end if;
    if not (p_context ?& array['v','scope','batchId','batchHash','dayId','day','nonce'])
        or (select count(*) from jsonb_object_keys(p_context)) <> 7 or p_context -> 'v' is distinct from '1'::jsonb then
        raise exception 'invalid-reset-intent' using errcode = '22023';
    end if;
    foreach field in array array['scope','batchId','batchHash','dayId','day','nonce'] loop
        if not private.zoe_pickup_reset_text_v1(p_context -> field) then
            raise exception 'invalid-reset-intent' using errcode = '22023';
        end if;
    end loop;
    if p_context ->> 'batchHash' !~ '^[a-f0-9]{64}$' or p_context ->> 'day' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or (p_context ->> 'dayId') collate "C" is distinct from ((p_context ->> 'batchId') || ':' || (p_context ->> 'day')) collate "C" then
        raise exception 'invalid-reset-intent' using errcode = '22023';
    end if;
    op := p_cas_text::jsonb;
    if jsonb_typeof(op) is distinct from 'object' then raise exception 'invalid-reset-intent' using errcode = '22023'; end if;
    if not (op ?& array['k','p','x','v']) or (select count(*) from jsonb_object_keys(op)) <> 4
        or op ->> 'k' is distinct from 'cas'
        or op -> 'p' is distinct from jsonb_build_array('zoew_daily_pickup_cod_dod', p_context ->> 'day') then
        raise exception 'invalid-reset-intent' using errcode = '22023';
    end if;
    basis := op -> 'x'; desired := op -> 'v';
    if jsonb_typeof(basis) not in ('null','object') then raise exception 'invalid-reset-intent' using errcode = '22023'; end if;
    if jsonb_typeof(basis) = 'object' and (basis ? 'pickupRevision' or basis ? 'pickupResetEpoch') then
        if not private.zoe_purge_integer_v1(basis -> 'pickupRevision', 1) or not private.zoe_purge_integer_v1(basis -> 'pickupResetEpoch') then
            raise exception 'invalid-reset-intent' using errcode = '22023';
        end if;
        before_revision := (basis ->> 'pickupRevision')::bigint;
        before_epoch := (basis ->> 'pickupResetEpoch')::bigint;
    end if;
    if before_revision >= 9007199254740990 or before_epoch >= 9007199254740990 then
        raise exception 'invalid-reset-intent' using errcode = '22023';
    end if;
    if basis ? 'pickupResetApplied' then
        proof := basis -> 'pickupResetApplied';
        if not private.zoe_pickup_reset_receipt_v1(proof) then raise exception 'invalid-reset-intent' using errcode = '22023'; end if;
        if (proof ->> 'afterRevision')::bigint > before_revision or (proof ->> 'afterEpoch')::bigint <> before_epoch then
            raise exception 'invalid-reset-intent' using errcode = '22023';
        end if;
    end if;
    perform private.zoe_canon(basis);
    after_revision := before_revision + 1; after_epoch := before_epoch + 1;
    if jsonb_typeof(desired) is distinct from 'object' then raise exception 'invalid-reset-intent' using errcode = '22023'; end if;
    if not (desired ?& array['pickupRevision','pickupResetEpoch','packagesPickedUp','pickedUpPhones','pickedUpBarcodes'])
        or (select count(*) from jsonb_object_keys(desired)) <> 5
        or desired -> 'pickupRevision' is distinct from to_jsonb(after_revision)
        or desired -> 'pickupResetEpoch' is distinct from to_jsonb(after_epoch)
        or desired -> 'packagesPickedUp' is distinct from '0'::jsonb
        or desired -> 'pickedUpPhones' is distinct from 'null'::jsonb or desired -> 'pickedUpBarcodes' is distinct from 'null'::jsonb then
        raise exception 'invalid-reset-intent' using errcode = '22023';
    end if;
    preimage := private.zoe_purge_compact_v1(jsonb_build_array('zoew-pickup-reset-attempt-v1', 1, p_tenant::text, p_uid::text,
        p_context -> 'scope', p_context -> 'batchId', p_context -> 'batchHash', p_context -> 'dayId', p_context -> 'day', p_context -> 'nonce', p_cas_text));
    digest := encode(sha256(convert_to(preimage, 'UTF8')), 'hex');
    if digest <> p_attempt_id then raise exception 'reset-context-conflict' using errcode = 'PT409'; end if;
    return jsonb_build_object('operation', op, 'reset', jsonb_build_object('v', 1, 'outcome', 'applied', 'proof', 'operation',
        'tenant', p_tenant, 'actorUid', p_uid, 'scope', p_context -> 'scope', 'batchId', p_context -> 'batchId',
        'batchHash', p_context -> 'batchHash', 'dayId', p_context -> 'dayId', 'day', p_context -> 'day', 'nonce', p_context -> 'nonce',
        'attemptId', p_attempt_id, 'intentHash', digest, 'beforeRevision', before_revision, 'beforeEpoch', before_epoch,
        'afterRevision', after_revision, 'afterEpoch', after_epoch));
end
$$;

create function private.zoe_pickup_reset_execute_v1(p_expected_tenant uuid, p_attempt_id text, p_context jsonb, p_cas_text text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
    uid uuid := auth.uid();
    member_tenant uuid;
    tenant uuid;
    intent jsonb;
    binding jsonb;
    physical_operation jsonb;
    prior jsonb;
    result jsonb;
    base_result jsonb;
    final_result jsonb;
    old_value jsonb;
    new_value jsonb;
    old_bytes bigint := 0;
    doc_growth bigint;
    extra_bytes bigint;
    total_growth bigint;
    used bigint;
    quota bigint;
    head bigint;
begin
    if uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
    select m.tenant_id into member_tenant from public.tenant_members m where m.user_id = uid for share;
    tenant := private.current_tenant_id();
    if tenant is null then raise exception 'forbidden' using errcode = '42501'; end if;
    if p_expected_tenant is null or tenant <> p_expected_tenant or member_tenant is distinct from tenant then
        raise exception 'tenant-mismatch' using errcode = 'PT409';
    end if;
    intent := private.zoe_pickup_reset_intent_v1(tenant, uid, p_attempt_id, p_context, p_cas_text);
    binding := intent -> 'reset';
    insert into public.zoe_tenant_state(tenant_id) values(tenant) on conflict(tenant_id) do nothing;
    select s.seq into head from public.zoe_tenant_state s where s.tenant_id = tenant for update;
    select o.result into prior from public.zoe_ops o where o.tenant_id = tenant and o.op_id = p_attempt_id;
    if found then
        if prior -> 'ok' is distinct from 'true'::jsonb or prior -> 'reset' is distinct from binding then
            raise exception 'reset-context-conflict' using errcode = 'PT409';
        end if;
        return jsonb_build_object('ok', true, 'seq', head, 'now', private.zoe_now_ms(), 'docs', '[]'::jsonb, 'replayed', true, 'reset', binding);
    end if;
    select d.value into old_value from public.zoe_docs d
    where d.tenant_id = tenant and d.root = 'zoew_daily_pickup_cod_dod' and d.key = p_context ->> 'day' for update;
    if found then old_bytes := private.zoe_doc_bytes('zoew_daily_pickup_cod_dod', p_context ->> 'day', old_value); end if;
    physical_operation := intent -> 'operation';
    if (physical_operation -> 'x') ? 'pickupResetApplied' then
        physical_operation := jsonb_set(physical_operation, '{v}', (physical_operation -> 'v')
            || jsonb_build_object('pickupResetApplied', binding || jsonb_build_object('proof', 'native-day')), false);
    end if;
    result := private.zoe_apply(tenant, p_attempt_id, jsonb_build_array(physical_operation), true, false);
    if result -> 'conflict' = 'true'::jsonb then
        return result || jsonb_build_object('seq', head, 'docs', '[]'::jsonb, 'reset', binding || jsonb_build_object('outcome', 'unknown', 'proof', 'none'));
    end if;
    if result -> 'ok' is distinct from 'true'::jsonb then raise exception 'reset-outcome-unavailable' using errcode = 'PT409'; end if;
    select o.result into base_result from public.zoe_ops o where o.tenant_id = tenant and o.op_id = p_attempt_id for update;
    if not found then raise exception 'reset-proof-unavailable' using errcode = 'PT409'; end if;
    final_result := base_result || jsonb_build_object('reset', binding);
    extra_bytes := private.zoe_op_bytes(p_attempt_id, final_result) - private.zoe_op_bytes(p_attempt_id, base_result);
    select d.value into new_value from public.zoe_docs d
    where d.tenant_id = tenant and d.root = 'zoew_daily_pickup_cod_dod' and d.key = p_context ->> 'day';
    if not found then raise exception 'reset-proof-unavailable' using errcode = 'PT409'; end if;
    doc_growth := private.zoe_doc_bytes('zoew_daily_pickup_cod_dod', p_context ->> 'day', new_value) - old_bytes;
    total_growth := doc_growth + private.zoe_op_bytes(p_attempt_id, final_result);
    if total_growth > 0 then
        perform private.zoe_housekeeping(tenant);
        select s.bytes, s.quota_bytes into used, quota from public.zoe_tenant_state s where s.tenant_id = tenant;
        if used::numeric + extra_bytes > quota then
            raise exception 'quota_exceeded' using errcode = '22023', detail = 'bytes';
        end if;
    end if;
    update public.zoe_ops o set result = final_result where o.tenant_id = tenant and o.op_id = p_attempt_id;
    if not found then raise exception 'reset-proof-unavailable' using errcode = 'PT409'; end if;
    update public.zoe_tenant_state s set bytes = greatest(s.bytes + extra_bytes, 0) where s.tenant_id = tenant;
    return result || jsonb_build_object('reset', binding);
end
$$;

create function private.zoe_pickup_reset_status_v1(p_expected_tenant uuid, p_attempt_id text, p_context jsonb, p_cas_text text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
    uid uuid := auth.uid();
    member_tenant uuid;
    tenant uuid;
    intent jsonb;
    binding jsonb;
    prior jsonb;
    head bigint;
begin
    if uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
    select m.tenant_id into member_tenant from public.tenant_members m where m.user_id = uid for share;
    tenant := private.current_tenant_id();
    if tenant is null then raise exception 'forbidden' using errcode = '42501'; end if;
    if p_expected_tenant is null or tenant <> p_expected_tenant or member_tenant is distinct from tenant then
        raise exception 'tenant-mismatch' using errcode = 'PT409';
    end if;
    intent := private.zoe_pickup_reset_intent_v1(tenant, uid, p_attempt_id, p_context, p_cas_text);
    binding := intent -> 'reset';
    select s.seq into head from public.zoe_tenant_state s where s.tenant_id = tenant for share;
    select o.result into prior from public.zoe_ops o where o.tenant_id = tenant and o.op_id = p_attempt_id;
    if found then
        if prior -> 'ok' is distinct from 'true'::jsonb or prior -> 'reset' is distinct from binding then
            raise exception 'reset-context-conflict' using errcode = 'PT409';
        end if;
    else binding := binding || jsonb_build_object('outcome', 'unknown', 'proof', 'none');
    end if;
    return jsonb_build_object('ok', true, 'seq', coalesce(head, 0), 'now', private.zoe_now_ms(), 'docs', '[]'::jsonb, 'reset', binding);
end
$$;

create function public.zoe_pickup_reset_execute_v1(p_expected_tenant uuid, p_attempt_id text, p_context jsonb, p_cas_text text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select private.zoe_pickup_reset_execute_v1(p_expected_tenant, p_attempt_id, p_context, p_cas_text) $$;

create function public.zoe_pickup_reset_status_v1(p_expected_tenant uuid, p_attempt_id text, p_context jsonb, p_cas_text text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select private.zoe_pickup_reset_status_v1(p_expected_tenant, p_attempt_id, p_context, p_cas_text) $$;

revoke all on function private.zoe_pickup_reset_text_v1(jsonb), private.zoe_pickup_reset_receipt_v1(jsonb), private.zoe_pickup_reset_intent_v1(uuid, uuid, text, jsonb, text)
    from public, anon, authenticated, service_role;
revoke all on function private.zoe_pickup_reset_execute_v1(uuid, text, jsonb, text), private.zoe_pickup_reset_status_v1(uuid, text, jsonb, text),
    public.zoe_pickup_reset_execute_v1(uuid, text, jsonb, text), public.zoe_pickup_reset_status_v1(uuid, text, jsonb, text)
    from public, anon, authenticated, service_role;
grant execute on function private.zoe_pickup_reset_execute_v1(uuid, text, jsonb, text), private.zoe_pickup_reset_status_v1(uuid, text, jsonb, text),
    public.zoe_pickup_reset_execute_v1(uuid, text, jsonb, text), public.zoe_pickup_reset_status_v1(uuid, text, jsonb, text)
    to authenticated;

notify pgrst, 'reload schema';
