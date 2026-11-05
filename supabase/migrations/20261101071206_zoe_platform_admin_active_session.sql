create or replace function private.is_platform_admin() returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
    v_uid uuid;
    v_sid text;
begin
    v_uid := auth.uid();
    if not exists (select 1 from public.platform_admins a where a.user_id = v_uid) then
        return false;
    end if;
    v_sid := auth.jwt() ->> 'session_id';
    if v_sid is null or v_sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
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
    return true;
exception
    when invalid_text_representation then
        raise exception 'session-revoked' using errcode = 'PT401';
end
$$;

notify pgrst, 'reload schema';
