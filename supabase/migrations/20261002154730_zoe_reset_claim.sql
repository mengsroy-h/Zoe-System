alter table public.member_reset_codes add column claim_id uuid;

create function public.claim_reset_code(p_username text, p_code_hash text, p_claim_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
    claimed_user uuid;
begin
    if p_claim_id is null then return null; end if;
    update public.member_reset_codes r
    set claim_id = p_claim_id
    from public.tenant_members m
    where r.code_hash = p_code_hash and m.user_id = r.user_id
        and m.username = p_username
        and not r.used and r.expires_at > now()
        and (r.claim_id is null or r.claim_id = p_claim_id)
    returning r.user_id into claimed_user;
    return claimed_user;
end
$$;

create function public.settle_reset_code(p_username text, p_code_hash text, p_claim_id uuid, p_consumed boolean)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
    if p_claim_id is null or p_consumed is null then return false; end if;
    if p_consumed then
        update public.member_reset_codes r
        set used = true
        from public.tenant_members m
        where r.code_hash = p_code_hash and m.user_id = r.user_id
            and m.username = p_username and r.claim_id = p_claim_id;
    else
        update public.member_reset_codes r
        set claim_id = null
        from public.tenant_members m
        where r.code_hash = p_code_hash and m.user_id = r.user_id
            and m.username = p_username and not r.used
            and (r.claim_id = p_claim_id or r.claim_id is null);
    end if;
    return found;
end
$$;

create or replace function public.reset_code_user(p_username text, p_code_hash text)
returns uuid
language sql stable security definer set search_path = ''
as $$
    select m.user_id
    from public.member_reset_codes r
    join public.tenant_members m on m.user_id = r.user_id
    where r.code_hash = p_code_hash and r.claim_id is null
        and m.username = p_username and not r.used and r.expires_at > now()
$$;

create or replace function public.consume_reset_code(p_username text, p_code_hash text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
    update public.member_reset_codes r
    set used = true
    from public.tenant_members m
    where r.code_hash = p_code_hash and m.user_id = r.user_id and m.username = p_username
        and r.claim_id is null;
    return found;
end
$$;

revoke all on function public.claim_reset_code(text, text, uuid),
    public.settle_reset_code(text, text, uuid, boolean),
    public.reset_code_user(text, text), public.consume_reset_code(text, text)
    from public, anon, authenticated, service_role;
grant execute on function public.claim_reset_code(text, text, uuid),
    public.settle_reset_code(text, text, uuid, boolean),
    public.reset_code_user(text, text), public.consume_reset_code(text, text)
    to service_role;
