create function private.zoe_write_v2(p_expected_tenant uuid, p_op_id text, p_ops jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
    member_tenant uuid;
    tenant uuid;
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_op_id is null or p_op_id !~ '^[A-Za-z0-9_-]{16,64}$' then
        raise exception 'invalid-op-id' using errcode = '22023';
    end if;
    if p_expected_tenant is null then
        raise exception 'tenant-mismatch' using errcode = 'PT409';
    end if;
    select m.tenant_id into member_tenant
    from public.tenant_members m
    where m.user_id = uid
    for share;
    tenant := private.current_tenant_id();
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if tenant <> p_expected_tenant or member_tenant is distinct from tenant then
        raise exception 'tenant-mismatch' using errcode = 'PT409';
    end if;
    return private.zoe_apply(tenant, p_op_id, p_ops, true, false);
end
$$;

create function public.zoe_write_v2(p_expected_tenant uuid, p_op_id text, p_ops jsonb)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$
    select private.zoe_write_v2(p_expected_tenant, p_op_id, p_ops)
$$;

revoke all on function private.zoe_write_v2(uuid, text, jsonb), public.zoe_write_v2(uuid, text, jsonb)
    from public, anon, authenticated, service_role;
grant execute on function private.zoe_write_v2(uuid, text, jsonb), public.zoe_write_v2(uuid, text, jsonb)
    to authenticated;

notify pgrst, 'reload schema';
