create table private.registration_protocol (
    singleton boolean primary key default true check (singleton),
    protocol integer not null,
    accepting boolean not null default false
);
alter table private.registration_protocol enable row level security;
revoke all on private.registration_protocol from public, anon, authenticated, service_role;
insert into private.registration_protocol(singleton, protocol, accepting) values(true, 1, false);

create function private.enroll_registration_at_commit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
    intent jsonb;
    username text;
    email text;
    code_hash text;
    admitted boolean;
begin
    select u.raw_app_meta_data -> 'zoe_registration', u.email
      into intent, email from auth.users u where u.id = new.id;
    if intent is null then return null; end if;
    username := intent ->> 'username';
    code_hash := intent ->> 'invite_code_hash';
    if jsonb_typeof(intent) <> 'object' or intent ->> 'version' is distinct from '1'
      or username is null or username !~ '^[a-z0-9_.]{3,32}$'
      or code_hash is null or code_hash !~ '^[0-9a-f]{64}$'
      or lower(split_part(email, '@', 1)) is distinct from username then
        raise exception 'registration-intent-invalid' using errcode = 'P0001';
    end if;
    select p.protocol = 1 and p.accepting into admitted
      from private.registration_protocol p where p.singleton for share;
    if admitted is distinct from true then
        raise exception 'registration-unavailable' using errcode = 'P0001';
    end if;
    perform * from public.finish_registration(new.id, code_hash, username);
    return null;
end
$$;
revoke all on function private.enroll_registration_at_commit() from public, anon, authenticated, service_role;
create constraint trigger zoe_enroll_registration_at_commit
    after insert on auth.users deferrable initially deferred
    for each row execute function private.enroll_registration_at_commit();

create function public.registration_capability_v1() returns jsonb
language sql volatile security definer set search_path = ''
as $$
    select jsonb_build_object('protocol', 'zoe-registration-v1', 'ready',
        coalesce((select p.protocol = 1 and p.accepting from private.registration_protocol p where p.singleton), false)
        and exists (
            select 1 from pg_catalog.pg_trigger t
            join pg_catalog.pg_proc f on f.oid = t.tgfoid
            where t.tgrelid = 'auth.users'::regclass
                and t.tgname = 'zoe_enroll_registration_at_commit'
                and t.tgfoid = to_regprocedure('private.enroll_registration_at_commit()')
                and not t.tgisinternal and t.tgtype = 5
                and t.tgenabled = 'O' and t.tgdeferrable and t.tginitdeferred
                and f.prosecdef
                and pg_catalog.pg_get_userbyid(f.proowner) = 'postgres'
                and not pg_catalog.has_function_privilege('anon', f.oid, 'EXECUTE')
                and not pg_catalog.has_function_privilege('authenticated', f.oid, 'EXECUTE')
        ));
$$;
revoke all on function public.registration_capability_v1() from public, anon, authenticated, service_role;
grant execute on function public.registration_capability_v1() to service_role;

create function public.registration_diagnose_v1(p_code_hash text, p_username text)
returns text
language sql stable security definer set search_path = ''
as $$
    select case
        when p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$'
            or p_username is null or p_username !~ '^[a-z0-9_.]{3,32}$' then 'unknown'
        when exists (
            select 1 from public.tenant_members m
            where m.username = p_username and m.invite_code_hash is not distinct from p_code_hash
        ) then 'unknown'
        when exists (select 1 from public.tenant_members m where m.username = p_username) then 'username-taken'
        when not exists (
            select 1 from public.tenant_invites i
            join public.tenants t on t.id = i.tenant_id
            where i.code_hash = p_code_hash and private.invite_row_usable(i, t)
        ) then 'invite-invalid'
        else 'unknown'
    end
$$;
revoke all on function public.registration_diagnose_v1(text, text) from public, anon, authenticated, service_role;
grant execute on function public.registration_diagnose_v1(text, text) to service_role;

notify pgrst, 'reload schema';
