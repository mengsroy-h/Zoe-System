create or replace function private.current_tenant_id() returns uuid
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
    return (
        select m.tenant_id
        from public.tenant_members m
        join public.tenants t on t.id = m.tenant_id
        where m.user_id = v_uid and private.tenant_row_active(t)
    );
exception
    when invalid_text_representation then
        raise exception 'session-revoked' using errcode = 'PT401';
end
$$;

notify pgrst, 'reload schema';
