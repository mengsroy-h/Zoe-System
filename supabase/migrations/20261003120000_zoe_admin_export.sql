create function public.zoe_admin_tenants(p_after uuid default null, p_limit integer default 200)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
    lim integer := least(greatest(coalesce(p_limit, 200), 1), 1000);
    rows_out jsonb;
    last_id uuid;
    more boolean := false;
begin
    select coalesce(jsonb_agg(t.obj order by t.id), '[]'::jsonb), (array_agg(t.id order by t.id desc))[1]
        into rows_out, last_id
    from (
        select tn.id, jsonb_build_object(
            'id', tn.id,
            'name', tn.name,
            'branch_code', tn.branch_code,
            'expires_at', tn.expires_at,
            'revoked', tn.revoked,
            'seq', coalesce(s.seq, 0),
            'docs', (select count(*) from public.zoe_docs z where z.tenant_id = tn.id and z.value is not null)
        ) as obj
        from public.tenants tn
        left join public.zoe_tenant_state s on s.tenant_id = tn.id
        where p_after is null or tn.id > p_after
        order by tn.id
        limit lim
    ) t;
    if last_id is not null and jsonb_array_length(rows_out) = lim then
        more := exists (select 1 from public.tenants tn where tn.id > last_id);
    end if;
    return jsonb_build_object('now', private.zoe_now_ms(), 'tenants', rows_out, 'more', more,
        'next', case when more then to_jsonb(last_id) else 'null'::jsonb end);
end
$$;

create function public.zoe_admin_export(
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
    select coalesce(jsonb_agg(jsonb_build_object('r', p.root, 'k', p.key, 'v', coalesce(p.value, 'null'::jsonb), 's', p.seq) order by p.rn), '[]'::jsonb),
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

revoke all on function public.zoe_admin_tenants(uuid, integer), public.zoe_admin_export(uuid, bigint, text, text, bigint, integer, integer)
    from public, anon, authenticated, service_role;
grant execute on function public.zoe_admin_tenants(uuid, integer) to service_role;
grant execute on function public.zoe_admin_export(uuid, bigint, text, text, bigint, integer, integer) to service_role;

notify pgrst, 'reload schema';
