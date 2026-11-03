create or replace function private.zoe_housekeeping(p_tenant uuid) returns void
language plpgsql volatile set search_path = ''
as $$
declare
    purged bigint;
    freed_docs bigint;
    freed_ops bigint;
    prior_raw text := current_setting('zoe.raw_docs', true);
begin
    perform set_config('zoe.raw_docs', 'on', true);
    with gone as (
        delete from public.zoe_docs z
        where z.tenant_id = p_tenant and z.value is null and z.updated_at < now() - interval '7 days'
        returning z.seq, private.zoe_doc_bytes(z.root, z.key, null) as b
    )
    select max(gone.seq), coalesce(sum(gone.b), 0) into purged, freed_docs from gone;
    perform set_config('zoe.raw_docs', coalesce(prior_raw, ''), true);
    if purged is not null then
        update public.zoe_tenant_state s set purged_seq = greatest(s.purged_seq, purged) where s.tenant_id = p_tenant;
    end if;
    with gone as (
        delete from public.zoe_ops o where o.tenant_id = p_tenant and o.created_at < now() - interval '2 days'
        returning private.zoe_op_bytes(o.op_id, o.result) as b
    )
    select coalesce(sum(gone.b), 0) into freed_ops from gone;
    if freed_docs + freed_ops > 0 then
        update public.zoe_tenant_state s set bytes = greatest(s.bytes - freed_docs - freed_ops, 0) where s.tenant_id = p_tenant;
    end if;
end
$$;

create or replace function private.zoe_docs_tombstone() returns trigger
language plpgsql volatile security definer set search_path = ''
as $$
declare
    next_seq bigint;
begin
    if pg_trigger_depth() > 1 or current_setting('zoe.raw_docs', true) = 'on'
        or not exists (select 1 from public.tenants t where t.id = old.tenant_id) then
        return null;
    end if;
    if old.value is null then
        update public.zoe_tenant_state s set purged_seq = greatest(s.purged_seq, old.seq),
            bytes = greatest(s.bytes - private.zoe_doc_bytes(old.root, old.key, null), 0)
        where s.tenant_id = old.tenant_id;
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

revoke all on function private.zoe_housekeeping(uuid), private.zoe_docs_tombstone() from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
