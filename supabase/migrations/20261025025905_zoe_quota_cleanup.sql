create or replace function private.zoe_apply(p_tenant uuid, p_op_id text, p_ops jsonb, p_enforce boolean, p_replace boolean) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
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
    if ops_count < 1 or ops_count > 500 then
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
    return jsonb_build_object('ok', true, 'seq', next_seq, 'now', now_ms, 'docs', private.zoe_json_array(out_list));
end
$$;

notify pgrst, 'reload schema';
