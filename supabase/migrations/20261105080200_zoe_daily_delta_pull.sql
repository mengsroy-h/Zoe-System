create table private.zoe_daily_delta_heads (
    tenant_id uuid not null,
    root text not null,
    key text not null,
    base_seq bigint not null,
    primary key (tenant_id, root, key),
    foreign key (tenant_id, root, key) references public.zoe_docs (tenant_id, root, key) on delete cascade
);

create table private.zoe_daily_deltas (
    tenant_id uuid not null,
    root text not null,
    key text not null,
    path text[] not null,
    value jsonb,
    seq bigint not null,
    primary key (tenant_id, root, key, path),
    foreign key (tenant_id, root, key) references private.zoe_daily_delta_heads (tenant_id, root, key) on delete cascade
);

alter table private.zoe_daily_delta_heads enable row level security;
alter table private.zoe_daily_deltas enable row level security;
create policy zoe_daily_delta_heads_read on private.zoe_daily_delta_heads for select to authenticated
    using (tenant_id = (select private.current_tenant_id()));
create policy zoe_daily_deltas_read on private.zoe_daily_deltas for select to authenticated
    using (tenant_id = (select private.current_tenant_id()));
revoke all on private.zoe_daily_delta_heads, private.zoe_daily_deltas from public, anon, authenticated, service_role;
grant select on private.zoe_daily_delta_heads, private.zoe_daily_deltas to authenticated;

insert into private.zoe_daily_delta_heads (tenant_id, root, key, base_seq)
select tenant_id, root, key, seq from public.zoe_docs
where root in ('zoew_daily_pickup_cod_dod', 'zoew_daily_collected_cod_dod') and jsonb_typeof(value) = 'object';

create function private.zoe_daily_diff(p_old jsonb, p_new jsonb, p_path text[] default '{}')
returns table (path text[], value jsonb)
language plpgsql immutable security invoker set search_path = ''
as $$
declare
    field text;
begin
    if p_old is not distinct from p_new then return; end if;
    if jsonb_typeof(p_old) = 'object' and jsonb_typeof(p_new) = 'object' then
        for field in select jsonb_object_keys(p_old) union select jsonb_object_keys(p_new) loop
            if not (p_new ? field) then
                path := p_path || field; value := null; return next;
            elsif not (p_old ? field) then
                path := p_path || field; value := p_new -> field; return next;
            else
                return query select d.path, d.value from private.zoe_daily_diff(p_old -> field, p_new -> field, p_path || field) d;
            end if;
        end loop;
    else
        path := p_path; value := p_new; return next;
    end if;
end
$$;

create function private.zoe_daily_capture() returns trigger
language plpgsql volatile security definer set search_path = ''
as $$
begin
    if new.root not in ('zoew_daily_pickup_cod_dod', 'zoew_daily_collected_cod_dod') then return null; end if;
    if tg_op = 'INSERT' or jsonb_typeof(old.value) is distinct from 'object' or jsonb_typeof(new.value) is distinct from 'object' then
        delete from private.zoe_daily_delta_heads h where h.tenant_id = new.tenant_id and h.root = new.root and h.key = new.key;
        if jsonb_typeof(new.value) = 'object' then
            insert into private.zoe_daily_delta_heads (tenant_id, root, key, base_seq) values (new.tenant_id, new.root, new.key, new.seq);
        end if;
        return null;
    end if;
    insert into private.zoe_daily_delta_heads (tenant_id, root, key, base_seq)
    values (new.tenant_id, new.root, new.key, old.seq) on conflict do nothing;
    insert into private.zoe_daily_deltas (tenant_id, root, key, path, value, seq)
    select new.tenant_id, new.root, new.key, d.path, d.value, new.seq from private.zoe_daily_diff(old.value, new.value) d
    on conflict (tenant_id, root, key, path) do update set value = excluded.value, seq = excluded.seq;
    return null;
end
$$;

create trigger zoe_daily_delta_capture after insert or update on public.zoe_docs
for each row execute function private.zoe_daily_capture();
revoke all on function private.zoe_daily_diff(jsonb, jsonb, text[]), private.zoe_daily_capture()
    from public, anon, authenticated, service_role;

create function public.zoe_pull_delta(p_since bigint, p_limit integer default 2000, p_full_head bigint default null)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
    result jsonb := public.zoe_pull(p_since, p_limit, p_full_head);
    tenant uuid := private.current_tenant_id();
    row_value jsonb;
    changes jsonb;
    rows_out jsonb := '[]'::jsonb;
begin
    if p_since <= 0 or p_full_head is not null or (result ->> 'reset')::boolean then return result; end if;
    for row_value in select jsonb_array_elements(result -> 'rows') loop
        if jsonb_typeof(row_value -> 'v') = 'object' and exists (
            select 1 from private.zoe_daily_delta_heads h where h.tenant_id = tenant
                and h.root = row_value ->> 'r' and h.key = row_value ->> 'k' and h.base_seq <= p_since
        ) then
            select coalesce(jsonb_agg(jsonb_build_object('p', d.path, 'v', d.value) order by d.seq, d.path), '[]'::jsonb)
            into changes from private.zoe_daily_deltas d where d.tenant_id = tenant
                and d.root = row_value ->> 'r' and d.key = row_value ->> 'k'
                and d.seq > p_since and d.seq <= (row_value ->> 's')::bigint;
            row_value := (row_value - 'v') || jsonb_build_object('d', changes);
        end if;
        rows_out := rows_out || jsonb_build_array(row_value);
    end loop;
    return jsonb_set(result, '{rows}', rows_out);
end
$$;

revoke all on function public.zoe_pull_delta(bigint, integer, bigint) from public, anon, authenticated, service_role;
grant execute on function public.zoe_pull_delta(bigint, integer, bigint) to authenticated;

notify pgrst, 'reload schema';
