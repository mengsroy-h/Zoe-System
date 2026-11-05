create function private.admin_remove_member(p_tenant_id uuid, p_username text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
    member public.tenant_members;
begin
    if not (select private.is_platform_admin()) then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    perform 1 from public.tenants t where t.id = p_tenant_id for update;
    if not found then
        raise exception 'tenant-not-found' using errcode = 'P0002';
    end if;
    select m.* into member from public.tenant_members m
    where m.tenant_id = p_tenant_id and m.username = lower(btrim(p_username)) for update;
    if member.user_id is null then
        raise exception 'member-not-found' using errcode = 'P0002';
    end if;
    if member.role = 'owner' and not exists (
        select 1 from public.tenant_members m
        where m.tenant_id = p_tenant_id and m.role = 'owner' and m.user_id <> member.user_id
    ) then
        raise exception 'last-owner' using errcode = 'P0001';
    end if;
    perform public.revoke_user_sessions(member.user_id);
    delete from public.member_reset_codes r where r.user_id = member.user_id;
    delete from public.tenant_members m where m.user_id = member.user_id;
    insert into public.zoe_tenant_state (tenant_id) values (p_tenant_id) on conflict (tenant_id) do nothing;
    update public.zoe_tenant_state s set seq = s.seq + 1 where s.tenant_id = p_tenant_id;
end
$$;

create function public.admin_remove_member(p_tenant_id uuid, p_username text)
returns void
language sql volatile security invoker set search_path = ''
as $$
    select private.admin_remove_member(p_tenant_id, p_username)
$$;

revoke all on function private.admin_remove_member(uuid, text), public.admin_remove_member(uuid, text)
    from public, anon, authenticated, service_role;
grant execute on function private.admin_remove_member(uuid, text), public.admin_remove_member(uuid, text) to authenticated;

notify pgrst, 'reload schema';
