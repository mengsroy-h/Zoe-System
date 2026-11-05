create or replace function public.zoe_admin_write(p_tenant uuid, p_op_id text, p_ops jsonb, p_replace boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
    if p_replace is true then
        raise exception 'replace-unsupported' using errcode = '22023';
    end if;
    if p_tenant is null or not exists (select 1 from public.tenants t where t.id = p_tenant) then
        raise exception 'tenant-not-found' using errcode = 'P0002';
    end if;
    return private.zoe_apply(p_tenant, p_op_id, p_ops, false, false);
end
$$;

notify pgrst, 'reload schema';
