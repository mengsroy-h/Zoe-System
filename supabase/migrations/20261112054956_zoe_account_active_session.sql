create or replace function private.my_account()
returns table (
    username text,
    role text,
    tenant_id uuid,
    tenant_name text,
    branch_code text,
    expires_at timestamptz,
    status text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
    v_uid uuid;
    v_sid text;
begin
    v_uid := auth.uid();
    v_sid := auth.jwt() ->> 'session_id';
    if v_uid is null or v_sid is null
        or v_sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'session-revoked' using errcode = 'PT401';
    end if;
    if not exists (
        select 1 from auth.sessions s
        where s.id = v_sid::uuid and s.user_id = v_uid
            and ((to_jsonb(s) ->> 'not_after') is null
                or (to_jsonb(s) ->> 'not_after')::timestamptz > statement_timestamp())
    ) then
        raise exception 'session-revoked' using errcode = 'PT401';
    end if;
    return query
        select m.username, m.role, t.id, t.name, t.branch_code, t.expires_at,
            case when t.revoked then 'revoked' when t.expires_at <= now() then 'expired' else 'active' end
        from public.tenant_members m
        join public.tenants t on t.id = m.tenant_id
        where m.user_id = v_uid;
exception
    when invalid_text_representation then
        raise exception 'session-revoked' using errcode = 'PT401';
end
$$;

notify pgrst, 'reload schema';
