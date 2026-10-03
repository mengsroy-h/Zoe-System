alter table public.tenant_members
    add column invite_code_hash text references public.tenant_invites (code_hash) on delete set null;

create or replace function public.finish_registration(p_user_id uuid, p_code_hash text, p_username text)
returns table (tenant_id uuid, role text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
    invite_tenant uuid;
    invite_role text;
    violated text;
begin
    if not exists (
        select 1 from auth.users u
        where u.id = p_user_id
            and lower(split_part(u.email, '@', 1)) = p_username
    ) then
        raise exception 'user-mismatch' using errcode = 'P0001';
    end if;
    select m.tenant_id, m.role into invite_tenant, invite_role
    from public.tenant_members m
    where m.user_id = p_user_id and m.username = p_username;
    if found then
        if not exists (
            select 1 from public.tenant_invites i
            where i.code_hash = p_code_hash and i.tenant_id = invite_tenant and i.role = invite_role
        ) then
            raise exception 'username-taken' using errcode = 'P0001';
        end if;
        tenant_id := invite_tenant;
        role := invite_role;
        return next;
        return;
    end if;
    update public.tenant_invites i
    set used_count = i.used_count + 1
    from public.tenants t
    where i.code_hash = p_code_hash
        and t.id = i.tenant_id
        and private.invite_row_usable(i, t)
    returning i.tenant_id, i.role into invite_tenant, invite_role;
    if invite_tenant is null then
        raise exception 'invite-invalid' using errcode = 'P0001';
    end if;
    insert into public.tenant_members (user_id, tenant_id, username, role, invite_code_hash)
    values (p_user_id, invite_tenant, p_username, invite_role, p_code_hash);
    tenant_id := invite_tenant;
    role := invite_role;
    return next;
exception
    when unique_violation then
        get stacked diagnostics violated = constraint_name;
        if violated = 'tenant_members_username_key' then
            raise exception 'username-taken' using errcode = 'P0001';
        end if;
        raise exception 'account-exists' using errcode = 'P0001';
    when check_violation then
        raise exception 'account-invalid' using errcode = 'P0001';
end
$$;

create function public.spent_invite_member(p_code_hash text, p_username text)
returns table (user_id uuid, tenant_id uuid, role text)
language sql stable security definer set search_path = ''
as $$
    select m.user_id, m.tenant_id, m.role
    from public.tenant_invites i
    join public.tenants t on t.id = i.tenant_id
    join public.tenant_members m on m.invite_code_hash = i.code_hash
    where i.code_hash = p_code_hash
        and m.username = p_username
        and m.tenant_id = i.tenant_id
        and m.role = i.role
        and not i.revoked
        and (i.used_count >= i.max_uses or i.expires_at <= now())
        and private.tenant_row_active(t)
$$;

revoke all on function public.finish_registration(uuid, text, text),
    public.spent_invite_member(text, text)
    from public, anon, authenticated, service_role;
grant execute on function public.finish_registration(uuid, text, text) to service_role;
grant execute on function public.spent_invite_member(text, text) to service_role;

notify pgrst, 'reload schema';
