create or replace function private.current_tenant_id() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
    sid text := nullif(auth.jwt() ->> 'session_id', '');
begin
    if sid is not null then
        if sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
            raise exception 'session-revoked' using errcode = 'PT401';
        end if;
        if not exists (select 1 from auth.sessions s where s.id = sid::uuid) then
            raise exception 'session-revoked' using errcode = 'PT401';
        end if;
    end if;
    return (
        select m.tenant_id
        from public.tenant_members m
        join public.tenants t on t.id = m.tenant_id
        where m.user_id = auth.uid() and private.tenant_row_active(t)
    );
end
$$;

create or replace function public.revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
    removed integer;
begin
    delete from auth.sessions s where s.user_id = p_user_id;
    get diagnostics removed = row_count;
    if removed > 0 then
        insert into public.zoe_tenant_state (tenant_id)
        select m.tenant_id from public.tenant_members m where m.user_id = p_user_id
        on conflict (tenant_id) do nothing;
        update public.zoe_tenant_state s set seq = s.seq + 1
        where s.tenant_id in (select m.tenant_id from public.tenant_members m where m.user_id = p_user_id);
    end if;
    return removed;
end
$$;

create function private.zoe_docs_restamp() returns trigger
language plpgsql volatile security definer set search_path = ''
as $$
declare
    head bigint;
    next_seq bigint;
    delta bigint;
begin
    if pg_trigger_depth() > 1 or current_setting('zoe.raw_docs', true) = 'on' then
        return new;
    end if;
    select s.seq into head from public.zoe_tenant_state s where s.tenant_id = new.tenant_id;
    if new.seq = coalesce(head, 0) + 1 then
        return new;
    end if;
    if tg_op = 'UPDATE' then
        if new.tenant_id <> old.tenant_id or new.root <> old.root or new.key <> old.key then
            raise exception 'zoe_docs_identity' using errcode = '22023', detail = 'delete the row and insert a new one';
        end if;
        if new.value is not distinct from old.value then
            new.seq := old.seq;
            return new;
        end if;
        delta := coalesce(octet_length(new.value::text), 0) - coalesce(octet_length(old.value::text), 0);
    else
        delta := private.zoe_doc_bytes(new.root, new.key, new.value);
    end if;
    insert into public.zoe_tenant_state (tenant_id) values (new.tenant_id) on conflict (tenant_id) do nothing;
    update public.zoe_tenant_state s set seq = s.seq + 1, bytes = greatest(s.bytes + delta, 0)
    where s.tenant_id = new.tenant_id
    returning s.seq into next_seq;
    new.seq := next_seq;
    new.updated_at := now();
    return new;
end
$$;

create function private.zoe_docs_tombstone() returns trigger
language plpgsql volatile security definer set search_path = ''
as $$
declare
    next_seq bigint;
begin
    if pg_trigger_depth() > 1 or current_setting('zoe.raw_docs', true) = 'on' or old.value is null
        or not exists (select 1 from public.tenants t where t.id = old.tenant_id) then
        return null;
    end if;
    update public.zoe_tenant_state s set seq = s.seq + 1, bytes = greatest(s.bytes - octet_length(old.value::text), 0)
    where s.tenant_id = old.tenant_id
    returning s.seq into next_seq;
    if next_seq is null then
        return null;
    end if;
    insert into public.zoe_docs (tenant_id, root, key, value, seq, updated_at)
    values (old.tenant_id, old.root, old.key, null, next_seq, now());
    return null;
end
$$;

revoke all on function private.zoe_docs_restamp(), private.zoe_docs_tombstone() from public, anon, authenticated, service_role;

create trigger zoe_docs_external_write
before insert or update on public.zoe_docs
for each row execute function private.zoe_docs_restamp();

create trigger zoe_docs_external_delete
after delete on public.zoe_docs
for each row execute function private.zoe_docs_tombstone();

notify pgrst, 'reload schema';
