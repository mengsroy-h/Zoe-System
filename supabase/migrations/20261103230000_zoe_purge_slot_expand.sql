create function private.zoe_purge_expand_v1(p_tenant uuid, p_packet jsonb, p_ops jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
    source_id text := p_packet ->> 'sourceId';
    source jsonb;
    slots text[];
    member_values jsonb[];
    missing integer;
    key_names text[];
    key_values jsonb[];
    certificate jsonb;
    expanded jsonb[];
begin
    select d.value into source from public.zoe_docs d
    where d.tenant_id = p_tenant and d.root = 'zoew_recently_deleted_cod_dod' and d.key = source_id;
    if jsonb_typeof(source) is distinct from 'object' then
        raise exception 'purge-source-conflict' using errcode = 'PT409';
    end if;
    if jsonb_typeof(source -> 'barcodes') = 'object' then
        select array_agg(e.key order by e.key::bigint) into slots
        from jsonb_each(source -> 'barcodes') e where e.value <> 'null'::jsonb;
    elsif jsonb_typeof(source -> 'barcodes') = 'array' then
        select array_agg((e.n - 1)::text order by e.n) into slots
        from jsonb_array_elements(source -> 'barcodes') with ordinality e(value, n) where e.value <> 'null'::jsonb;
    else
        raise exception 'purge-source-conflict' using errcode = 'PT409';
    end if;
    if coalesce(cardinality(slots), 0) = 0 then
        raise exception 'purge-source-conflict' using errcode = 'PT409';
    end if;
    select count(*) filter (where r.value is null),
           array_agg(jsonb_build_object('o', s.o - 1, 'id', r.value -> 'id')
               || case when s.o > 1 then jsonb_build_object('p', slots[s.o - 1]) else '{}'::jsonb end
               || case when s.o < cardinality(slots) then jsonb_build_object('n', slots[s.o + 1]) else '{}'::jsonb end order by s.o)
    into missing, member_values
    from unnest(slots) with ordinality s(slot, o)
    left join jsonb_array_elements(p_packet -> 'receipts') r on (r.value ->> 'slot') = s.slot;
    if missing > 0 or cardinality(slots) <> jsonb_array_length(p_packet -> 'receipts') then
        raise exception 'purge-source-conflict' using errcode = 'PT409';
    end if;
    select array_agg(r.value ->> 'registryKey' order by r.n), array_agg(r.value -> 'id' order by r.n)
    into key_names, key_values from jsonb_array_elements(p_packet -> 'receipts') with ordinality r(value, n);
    certificate := jsonb_build_object('first', slots[1], 'members', private.zoe_json_object(slots, member_values),
        'keys', private.zoe_json_object(key_names, key_values));
    select array_agg(x.op order by x.o, x.k collate "C") into expanded from (
        select 0 as o, e.n::text as k, case when e.value -> 'p' = jsonb_build_array('zoew_trash_consumptions', source_id)
            then jsonb_set(e.value, '{v}', (e.value -> 'v') || certificate) else e.value end as op
        from jsonb_array_elements(p_ops) with ordinality e(value, n)
        where e.value -> 'p' <> jsonb_build_array('zoew_recently_deleted_cod_dod', source_id)
        union all
        select 1, s.slot, jsonb_build_object('k', 'set', 'p', jsonb_build_array('zoew_recently_deleted_cod_dod', source_id, 'barcodes', s.slot), 'v', null)
        from unnest(slots) s(slot)
        union all
        select 2, f.key, jsonb_build_object('k', 'set', 'p', jsonb_build_array('zoew_recently_deleted_cod_dod', source_id, f.key), 'v', null)
        from jsonb_object_keys(source) f(key) where f.key <> 'barcodes'
    ) x;
    return private.zoe_json_array(expanded);
end
$$;

revoke all on function private.zoe_purge_expand_v1(uuid, jsonb, jsonb) from public, anon, authenticated, service_role;

create or replace function private.zoe_purge_execute_v1(p_expected_tenant uuid, p_op_id text, p_ops jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
    uid uuid := auth.uid();
    member_tenant uuid;
    tenant uuid;
    packet jsonb;
    binding jsonb;
    prior jsonb;
    head bigint;
    result jsonb;
begin
    if uid is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_op_id is null or p_op_id !~ '^[A-Za-z0-9_-]{16,64}$' then
        raise exception 'invalid-op-id' using errcode = '22023';
    end if;
    select m.tenant_id into member_tenant from public.tenant_members m where m.user_id = uid for share;
    tenant := private.current_tenant_id();
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_expected_tenant is null or tenant <> p_expected_tenant or member_tenant is distinct from tenant then
        raise exception 'tenant-mismatch' using errcode = 'PT409';
    end if;
    packet := private.zoe_purge_packet_v1(p_ops);
    if packet ->> 'actorUid' is distinct from uid::text then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    binding := private.zoe_purge_binding_v1(packet, tenant, p_op_id, uid, 'operation');
    insert into public.zoe_tenant_state (tenant_id) values (tenant) on conflict (tenant_id) do nothing;
    select s.seq into head from public.zoe_tenant_state s where s.tenant_id = tenant for update;
    select o.result into prior from public.zoe_ops o where o.tenant_id = tenant and o.op_id = p_op_id;
    if found then
        if prior -> 'purge' is distinct from binding or prior -> 'ok' is distinct from 'true'::jsonb then
            raise exception 'purge-context-conflict' using errcode = 'PT409';
        end if;
        return jsonb_build_object('ok', true, 'seq', head, 'docs', '[]'::jsonb, 'now', private.zoe_now_ms(), 'replayed', true, 'purge', binding);
    end if;
    perform private.zoe_purge_source_v1(tenant, packet);
    if (private.zoe_rules() #> '{c,zoew_recently_deleted_cod_dod,x,r,c,barcodes,x,r}') ? 'w' then
        result := private.zoe_apply_engine_v1(tenant, p_op_id, private.zoe_purge_expand_v1(tenant, packet, p_ops), true, false, binding);
        return jsonb_build_object('ok', true, 'seq', result -> 'seq', 'docs', '[]'::jsonb, 'now', result -> 'now', 'purge', binding);
    end if;
    return private.zoe_apply_engine_v1(tenant, p_op_id, p_ops, true, false, binding);
end
$$;

notify pgrst, 'reload schema';
