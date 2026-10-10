create table public.member_devices (
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    serial text not null check (serial ~ '^[0-9a-f]{8,64}$'),
    user_id uuid references public.tenant_members (user_id) on delete set null,
    model text not null default '' check (char_length(model) <= 80 and model !~ '[[:cntrl:]]'),
    platform text not null default '' check (char_length(platform) <= 40 and platform !~ '[[:cntrl:]]'),
    first_seen timestamptz not null default now(),
    last_seen timestamptz not null default now(),
    primary key (tenant_id, serial)
);
create index member_devices_user_idx on public.member_devices (user_id);

alter table public.member_devices enable row level security;
revoke all on table public.member_devices from public, anon, authenticated, service_role;
grant select on table public.member_devices to authenticated;

create policy member_devices_select on public.member_devices for select to authenticated
    using ((select private.is_platform_admin()));

create function private.note_my_device(p_serial text, p_model text, p_platform text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
    v_tenant uuid;
    v_serial text := lower(btrim(coalesce(p_serial, '')));
    v_model text := btrim(coalesce(p_model, ''));
    v_platform text := btrim(coalesce(p_platform, ''));
begin
    if v_uid is null then
        raise exception 'no-account' using errcode = '42501';
    end if;
    v_tenant := private.current_tenant_id();
    if v_tenant is null then
        raise exception 'shop-inactive' using errcode = '42501';
    end if;
    if v_serial !~ '^[0-9a-f]{8,64}$' or char_length(v_model) > 80 or char_length(v_platform) > 40
        or v_model ~ '[[:cntrl:]]' or v_platform ~ '[[:cntrl:]]' then
        raise exception 'device-invalid' using errcode = '22023';
    end if;
    insert into public.member_devices as d (tenant_id, serial, user_id, model, platform)
    values (v_tenant, v_serial, v_uid, v_model, v_platform)
    on conflict (tenant_id, serial) do update
        set user_id = excluded.user_id, model = excluded.model, platform = excluded.platform, last_seen = now()
        where d.user_id is distinct from excluded.user_id or d.model <> excluded.model or d.platform <> excluded.platform
            or d.last_seen < now() - interval '1 hour';
    delete from public.member_devices d
    where d.tenant_id = v_tenant and d.serial in (
        select x.serial from public.member_devices x where x.tenant_id = v_tenant
        order by x.last_seen desc, x.serial offset 30
    );
    return true;
end
$$;

create function public.note_my_device(p_serial text, p_model text default '', p_platform text default '')
returns boolean
language sql volatile security invoker set search_path = ''
as $$
    select private.note_my_device(p_serial, p_model, p_platform)
$$;

revoke all on function private.note_my_device(text, text, text), public.note_my_device(text, text, text)
    from public, anon, authenticated, service_role;
grant execute on function private.note_my_device(text, text, text), public.note_my_device(text, text, text)
    to authenticated;

notify pgrst, 'reload schema';
