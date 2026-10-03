drop function public.zoe_pull(bigint, integer);

create function public.zoe_pull(p_since bigint, p_limit integer default 2000, p_full_head bigint default null) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
    tenant uuid := private.current_tenant_id();
    head bigint := 0;
    purged bigint := 0;
    since bigint := coalesce(p_since, 0);
    lim integer := least(greatest(coalesce(p_limit, 2000), 1), 5000);
    full_head bigint := p_full_head;
    tomb_after bigint;
    upper_seq bigint;
    rows_out jsonb;
    more boolean := false;
    full_sync boolean := false;
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    select s.seq, s.purged_seq into head, purged from public.zoe_tenant_state s where s.tenant_id = tenant;
    head := coalesce(head, 0);
    purged := coalesce(purged, 0);
    if full_head is not null and (since <= 0 or full_head < purged or full_head > head) then
        full_head := null;
    end if;
    if since < 0 or since > head or (since > 0 and since < purged and full_head is null) then
        since := 0;
    end if;
    full_sync := since = 0;
    if full_sync then
        full_head := head;
    end if;
    tomb_after := case when full_head is null then since else full_head end;
    select max(x.seq) into upper_seq
    from (
        select d.seq from public.zoe_docs d
        where d.tenant_id = tenant and d.seq > since and (d.value is not null or d.seq > tomb_after)
        order by d.seq
        limit lim
    ) x;
    if upper_seq is null then
        return jsonb_build_object('seq', greatest(since, head), 'more', false, 'reset', full_sync, 'head', head,
            'tenant', tenant, 'now', private.zoe_now_ms(), 'rows', '[]'::jsonb);
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('r', d.root, 'k', d.key, 'v', coalesce(d.value, 'null'::jsonb), 's', d.seq) order by d.seq), '[]'::jsonb)
        into rows_out
    from public.zoe_docs d
    where d.tenant_id = tenant and d.seq > since and d.seq <= upper_seq
        and (d.value is not null or d.seq > tomb_after);
    more := exists (
        select 1 from public.zoe_docs d
        where d.tenant_id = tenant and d.seq > upper_seq
            and (d.value is not null or d.seq > tomb_after)
    );
    return jsonb_build_object('seq', case when more then upper_seq else greatest(upper_seq, head) end, 'more', more, 'reset', full_sync,
        'head', head, 'tenant', tenant, 'now', private.zoe_now_ms(), 'rows', rows_out);
end
$$;

revoke all on function public.zoe_pull(bigint, integer, bigint) from public, anon, authenticated, service_role;
grant execute on function public.zoe_pull(bigint, integer, bigint) to authenticated;

notify pgrst, 'reload schema';
