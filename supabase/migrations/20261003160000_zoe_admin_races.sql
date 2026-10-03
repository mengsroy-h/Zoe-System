create or replace function private.admin_issue_reset_code(p_username text, p_valid_hours integer default 24)
returns table (code text, expires_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
declare
    member_id uuid;
    new_code text;
    valid_until timestamptz;
    attempt integer;
begin
    if not (select private.is_platform_admin()) then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_valid_hours is null or p_valid_hours not between 1 and 168 then
        raise exception 'reset-invalid' using errcode = '22023';
    end if;
    select m.user_id into member_id
    from public.tenant_members m
    where m.username = lower(btrim(p_username))
    for update;
    if member_id is null then
        raise exception 'member-not-found' using errcode = 'P0002';
    end if;
    update public.member_reset_codes r set used = true where r.user_id = member_id and r.used = false;
    valid_until := now() + make_interval(hours => p_valid_hours);
    for attempt in 1 .. 5 loop
        new_code := private.new_invite_code();
        insert into public.member_reset_codes (code_hash, user_id, expires_at, created_by)
        values (private.reset_code_hash(new_code), member_id, valid_until, auth.uid())
        on conflict (code_hash) do nothing;
        if found then
            code := new_code;
            expires_at := valid_until;
            return next;
            return;
        end if;
    end loop;
    raise exception 'reset-collision' using errcode = 'P0001';
end
$$;

create function private.admin_extend_tenant(p_tenant_id uuid, p_days integer, p_expected_expires_at timestamptz)
returns public.tenants
language plpgsql volatile security definer set search_path = ''
as $$
declare
    updated public.tenants;
begin
    if not (select private.is_platform_admin()) then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_days is null or p_days not between 1 and 3650 or p_expected_expires_at is null then
        raise exception 'extend-invalid' using errcode = '22023';
    end if;
    update public.tenants t
    set expires_at = greatest(t.expires_at, now()) + make_interval(days => p_days),
        updated_at = now()
    where t.id = p_tenant_id and t.expires_at = p_expected_expires_at
    returning * into updated;
    if updated.id is null then
        if exists (select 1 from public.tenants t where t.id = p_tenant_id) then
            raise exception 'tenant-changed' using errcode = 'P0001';
        end if;
        raise exception 'tenant-not-found' using errcode = 'P0002';
    end if;
    return updated;
end
$$;

create function public.admin_extend_tenant(p_tenant_id uuid, p_days integer, p_expected_expires_at timestamptz)
returns public.tenants
language sql volatile security invoker set search_path = ''
as $$
    select * from private.admin_extend_tenant(p_tenant_id, p_days, p_expected_expires_at)
$$;

revoke all on function private.admin_extend_tenant(uuid, integer, timestamptz), public.admin_extend_tenant(uuid, integer, timestamptz)
    from public, anon, authenticated, service_role;
grant execute on function private.admin_extend_tenant(uuid, integer, timestamptz), public.admin_extend_tenant(uuid, integer, timestamptz)
    to authenticated;

notify pgrst, 'reload schema';
