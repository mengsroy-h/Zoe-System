begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
lock table private.registration_protocol, auth.users, public.tenants,
    public.tenant_invites, public.tenant_members, public.platform_admins
    in share row exclusive mode;
do $$
declare
    gate private.registration_protocol%rowtype;
    capability jsonb;
    role_name text;
begin
    if clock_timestamp() > '__PREFLIGHT_EXPIRES__'::timestamptz then
        raise exception 'registration-preflight-expired';
    end if;
    select * into strict gate from private.registration_protocol where singleton;
    if gate.accepting then
        if gate.protocol <> 1 or public.registration_capability_v1()
            is distinct from '{"protocol":"zoe-registration-v1","ready":true}'::jsonb then
            raise exception 'registration-already-open-not-ready';
        end if;
        raise notice 'registration-already-open-no-change';
        return;
    end if;
    if gate.protocol <> 1 then raise exception 'registration-protocol-incompatible'; end if;
    if exists(select 1 from public.tenants)
        or exists(select 1 from public.tenant_invites)
        or exists(select 1 from public.tenant_members)
        or exists(select 1 from auth.users u where not exists (
            select 1 from public.platform_admins a where a.user_id = u.id
        ) or u.raw_app_meta_data ? 'zoe_registration') then
        raise exception 'registration-new-project-only';
    end if;
    if not exists (
        select 1 from pg_catalog.pg_class c
        where c.oid = 'private.registration_protocol'::regclass and c.relrowsecurity
            and pg_catalog.pg_get_userbyid(c.relowner) = 'postgres'
    ) or exists(select 1 from pg_catalog.pg_policy where polrelid = 'private.registration_protocol'::regclass) then
        raise exception 'registration-gate-permissions-invalid';
    end if;
    foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
        if pg_catalog.has_table_privilege(role_name, 'private.registration_protocol', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or pg_catalog.has_any_column_privilege(role_name, 'private.registration_protocol', 'SELECT,INSERT,UPDATE,REFERENCES') then
            raise exception 'registration-gate-permissions-invalid';
        end if;
    end loop;
    if not pg_catalog.has_function_privilege('service_role', 'public.registration_capability_v1()', 'EXECUTE')
        or not pg_catalog.has_function_privilege('service_role', 'public.finish_registration(uuid,text,text)', 'EXECUTE') then
        raise exception 'registration-service-permissions-invalid';
    end if;
    foreach role_name in array array['anon', 'authenticated'] loop
        if pg_catalog.has_function_privilege(role_name, 'public.registration_capability_v1()', 'EXECUTE')
            or pg_catalog.has_function_privilege(role_name, 'public.finish_registration(uuid,text,text)', 'EXECUTE') then
            raise exception 'registration-client-permissions-invalid';
        end if;
    end loop;
    update private.registration_protocol set accepting = true where singleton and protocol = 1 and not accepting;
    capability := public.registration_capability_v1();
    if capability is distinct from '{"protocol":"zoe-registration-v1","ready":true}'::jsonb then
        raise exception 'registration-database-not-ready';
    end if;
end
$$;
select public.registration_capability_v1() as registration_capability;
commit;
