create or replace function public.zoe_evidence_candidates(p_root text, p_before bigint, p_limit integer) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
    tenant uuid := private.current_tenant_id();
    docs jsonb;
    field text;
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    field := case p_root when 'zoew_scan_operations' then 'birth' when 'zoew_registry_releases' then 'deletedAt'
        when 'zoew_trash_consumptions' then 'deletedAt' end;
    if field is null or p_before is null or p_limit is null or p_limit < 1 or p_limit > 200 then
        raise exception 'invalid_data' using errcode = '22023';
    end if;
    select coalesce(('[' || string_agg(jsonb_build_object('r', c.root, 'k', c.key, 'v', c.value, 's', c.seq)::text, ',' order by c.at, c.key) || ']')::jsonb, '[]'::jsonb)
        into docs
    from (
        select d.root, d.key, d.value, d.seq, (d.value ->> field)::numeric as at
        from public.zoe_docs d
        where d.tenant_id = tenant and d.root = p_root and d.value is not null
            and jsonb_typeof(d.value -> field) = 'number' and (d.value ->> field)::numeric < p_before
        order by (d.value ->> field)::numeric, d.key
        limit p_limit
    ) c;
    return jsonb_build_object('now', private.zoe_now_ms(), 'docs', docs);
end
$$;
revoke all on function public.zoe_evidence_candidates(text, bigint, integer) from public, anon, authenticated, service_role;
grant execute on function public.zoe_evidence_candidates(text, bigint, integer) to authenticated;

notify pgrst, 'reload schema';
