create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.tenants (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(btrim(name)) between 1 and 120),
    branch_code text not null unique check (branch_code ~ '^[A-Za-z0-9_-]{1,32}$'),
    expires_at timestamptz not null,
    revoked boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.tenant_members (
    user_id uuid primary key references auth.users (id) on delete cascade,
    tenant_id uuid not null references public.tenants (id) on delete restrict,
    username text not null unique check (username ~ '^[a-z0-9_.]{3,32}$'),
    phone text not null unique check (phone ~ '^\+[1-9][0-9]{6,14}$'),
    role text not null default 'member' check (role in ('owner', 'member')),
    created_at timestamptz not null default now()
);
create index tenant_members_tenant_idx on public.tenant_members (tenant_id);

create table public.tenant_invites (
    code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    role text not null default 'member' check (role in ('owner', 'member')),
    max_uses integer not null default 1 check (max_uses between 1 and 50),
    used_count integer not null default 0 check (used_count between 0 and max_uses),
    expires_at timestamptz not null,
    revoked boolean not null default false,
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now()
);
create index tenant_invites_tenant_idx on public.tenant_invites (tenant_id);

create table public.platform_admins (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_invites enable row level security;
alter table public.platform_admins enable row level security;

revoke all on table public.tenants, public.tenant_members, public.tenant_invites, public.platform_admins
    from public, anon, authenticated, service_role;
grant select on table public.tenants, public.tenant_members, public.tenant_invites, public.platform_admins
    to authenticated;

create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
    select exists (select 1 from public.platform_admins a where a.user_id = auth.uid())
$$;

create function private.tenant_row_active(t public.tenants) returns boolean
language sql stable set search_path = ''
as $$
    select not t.revoked and t.expires_at > now()
$$;

create function private.invite_row_usable(i public.tenant_invites, t public.tenants) returns boolean
language sql stable set search_path = ''
as $$
    select not i.revoked and i.used_count < i.max_uses and i.expires_at > now() and private.tenant_row_active(t)
$$;

create function private.current_tenant_id() returns uuid
language sql stable security definer set search_path = ''
as $$
    select m.tenant_id
    from public.tenant_members m
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = auth.uid() and private.tenant_row_active(t)
$$;

create function private.invite_code_normalize(p_code text) returns text
language sql immutable set search_path = ''
as $$
    select translate(upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')), 'OIL', '011')
$$;

create function private.invite_code_hash(p_code text) returns text
language sql immutable set search_path = ''
as $$
    select encode(sha256(convert_to('zoe-invite:' || private.invite_code_normalize(p_code), 'UTF8')), 'hex')
$$;

create function private.new_invite_code() returns text
language plpgsql volatile set search_path = ''
as $$
declare
    alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    positions constant integer[] := array[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    raw bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
    code text := '';
    i integer;
begin
    for i in 1 .. array_length(positions, 1) loop
        code := code || substr(alphabet, (get_byte(raw, positions[i]) & 31) + 1, 1);
        if i % 4 = 0 and i < array_length(positions, 1) then
            code := code || '-';
        end if;
    end loop;
    return code;
end
$$;

revoke all on function private.is_platform_admin(), private.current_tenant_id(),
    private.tenant_row_active(public.tenants), private.invite_row_usable(public.tenant_invites, public.tenants),
    private.invite_code_normalize(text), private.invite_code_hash(text), private.new_invite_code()
    from public;
grant execute on function private.is_platform_admin(), private.current_tenant_id() to authenticated;

create policy tenants_select on public.tenants for select to authenticated
    using (id = (select private.current_tenant_id()) or (select private.is_platform_admin()));

create policy tenant_members_select on public.tenant_members for select to authenticated
    using (user_id = (select auth.uid()) or (select private.is_platform_admin()));

create policy tenant_invites_select on public.tenant_invites for select to authenticated
    using ((select private.is_platform_admin()));

create policy platform_admins_select on public.platform_admins for select to authenticated
    using (user_id = (select auth.uid()));

create function public.my_account()
returns table (
    username text,
    role text,
    tenant_id uuid,
    tenant_name text,
    branch_code text,
    expires_at timestamptz,
    status text
)
language sql stable security definer set search_path = ''
as $$
    select m.username, m.role, t.id, t.name, t.branch_code, t.expires_at,
        case when t.revoked then 'revoked' when t.expires_at <= now() then 'expired' else 'active' end
    from public.tenant_members m
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = auth.uid()
$$;

create function public.admin_create_tenant(p_name text, p_branch_code text, p_expires_at timestamptz)
returns public.tenants
language plpgsql volatile security definer set search_path = ''
as $$
declare
    created public.tenants;
begin
    if not private.is_platform_admin() then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_expires_at is null or p_expires_at <= now() then
        raise exception 'expires-invalid' using errcode = '22023';
    end if;
    insert into public.tenants (name, branch_code, expires_at)
    values (btrim(p_name), btrim(p_branch_code), p_expires_at)
    returning * into created;
    return created;
exception
    when unique_violation then
        raise exception 'branch-taken' using errcode = '23505';
    when check_violation or not_null_violation then
        raise exception 'tenant-invalid' using errcode = '22023';
end
$$;

create function public.admin_update_tenant(
    p_tenant_id uuid,
    p_name text default null,
    p_branch_code text default null,
    p_expires_at timestamptz default null,
    p_revoked boolean default null
)
returns public.tenants
language plpgsql volatile security definer set search_path = ''
as $$
declare
    updated public.tenants;
begin
    if not private.is_platform_admin() then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    update public.tenants t
    set name = coalesce(btrim(p_name), t.name),
        branch_code = coalesce(btrim(p_branch_code), t.branch_code),
        expires_at = coalesce(p_expires_at, t.expires_at),
        revoked = coalesce(p_revoked, t.revoked),
        updated_at = now()
    where t.id = p_tenant_id
    returning * into updated;
    if updated.id is null then
        raise exception 'tenant-not-found' using errcode = 'P0002';
    end if;
    return updated;
exception
    when unique_violation then
        raise exception 'branch-taken' using errcode = '23505';
    when check_violation then
        raise exception 'tenant-invalid' using errcode = '22023';
end
$$;

create function public.admin_issue_invite(
    p_tenant_id uuid,
    p_role text default 'member',
    p_max_uses integer default 1,
    p_valid_hours integer default 72
)
returns table (code text, expires_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
declare
    new_code text;
    valid_until timestamptz;
    attempt integer;
begin
    if not private.is_platform_admin() then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_role is null or p_role not in ('owner', 'member')
        or p_max_uses is null or p_max_uses not between 1 and 50
        or p_valid_hours is null or p_valid_hours not between 1 and 720 then
        raise exception 'invite-invalid' using errcode = '22023';
    end if;
    if not exists (
        select 1 from public.tenants t
        where t.id = p_tenant_id and private.tenant_row_active(t)
    ) then
        raise exception 'tenant-inactive' using errcode = '22023';
    end if;
    valid_until := now() + make_interval(hours => p_valid_hours);
    for attempt in 1 .. 5 loop
        new_code := private.new_invite_code();
        insert into public.tenant_invites (code_hash, tenant_id, role, max_uses, expires_at, created_by)
        values (private.invite_code_hash(new_code), p_tenant_id, p_role, p_max_uses, valid_until, auth.uid())
        on conflict (code_hash) do nothing;
        if found then
            code := new_code;
            expires_at := valid_until;
            return next;
            return;
        end if;
    end loop;
    raise exception 'invite-collision' using errcode = 'P0001';
end
$$;

create function public.admin_revoke_invite(p_code_hash text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
    if not private.is_platform_admin() then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    update public.tenant_invites i set revoked = true where i.code_hash = p_code_hash;
    return found;
end
$$;

create function public.finish_registration(p_user_id uuid, p_code_hash text, p_username text, p_phone text)
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
        where u.id = p_user_id and lower(split_part(u.email, '@', 1)) = p_username
    ) then
        raise exception 'user-mismatch' using errcode = 'P0001';
    end if;
    select m.tenant_id, m.role into invite_tenant, invite_role
    from public.tenant_members m
    where m.user_id = p_user_id and m.username = p_username and m.phone = p_phone;
    if found then
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
    insert into public.tenant_members (user_id, tenant_id, username, phone, role)
    values (p_user_id, invite_tenant, p_username, p_phone, invite_role);
    tenant_id := invite_tenant;
    role := invite_role;
    return next;
exception
    when unique_violation then
        get stacked diagnostics violated = constraint_name;
        if violated = 'tenant_members_phone_key' then
            raise exception 'phone-taken' using errcode = 'P0001';
        elsif violated = 'tenant_members_username_key' then
            raise exception 'username-taken' using errcode = 'P0001';
        end if;
        raise exception 'account-exists' using errcode = 'P0001';
    when check_violation then
        raise exception 'account-invalid' using errcode = 'P0001';
end
$$;

create function public.invite_is_usable(p_code_hash text)
returns boolean
language sql stable security definer set search_path = ''
as $$
    select exists (
        select 1 from public.tenant_invites i
        join public.tenants t on t.id = i.tenant_id
        where i.code_hash = p_code_hash and private.invite_row_usable(i, t)
    )
$$;

create function public.revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
    removed integer;
begin
    delete from auth.sessions s where s.user_id = p_user_id;
    get diagnostics removed = row_count;
    return removed;
end
$$;

create function public.member_for_reset(p_username text, p_phone text)
returns uuid
language sql stable security definer set search_path = ''
as $$
    select m.user_id from public.tenant_members m
    where m.username = p_username and m.phone = p_phone
$$;

revoke all on function public.my_account(),
    public.admin_create_tenant(text, text, timestamptz),
    public.admin_update_tenant(uuid, text, text, timestamptz, boolean),
    public.admin_issue_invite(uuid, text, integer, integer),
    public.admin_revoke_invite(text),
    public.finish_registration(uuid, text, text, text),
    public.invite_is_usable(text),
    public.revoke_user_sessions(uuid),
    public.member_for_reset(text, text)
    from public, anon, authenticated, service_role;
grant execute on function public.my_account(),
    public.admin_create_tenant(text, text, timestamptz),
    public.admin_update_tenant(uuid, text, text, timestamptz, boolean),
    public.admin_issue_invite(uuid, text, integer, integer),
    public.admin_revoke_invite(text)
    to authenticated;
grant execute on function public.finish_registration(uuid, text, text, text),
    public.invite_is_usable(text),
    public.revoke_user_sessions(uuid),
    public.member_for_reset(text, text)
    to service_role;
