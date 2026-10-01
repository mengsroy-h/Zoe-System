create table public.zoe_tenant_state (
    tenant_id uuid primary key references public.tenants (id) on delete cascade,
    seq bigint not null default 0 check (seq >= 0),
    purged_seq bigint not null default 0 check (purged_seq >= 0)
);

create table public.zoe_docs (
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    root text not null check (octet_length(root) between 1 and 768 and root !~ '[\]\[.#$/\x01-\x1f\x7f]'),
    key text not null check (octet_length(key) between 1 and 768 and key !~ '[\]\[.#$/\x01-\x1f\x7f]'),
    value jsonb check (value is null or jsonb_typeof(value) <> 'null'),
    seq bigint not null check (seq > 0),
    updated_at timestamptz not null default now(),
    primary key (tenant_id, root, key)
);
create index zoe_docs_tenant_seq_idx on public.zoe_docs (tenant_id, seq);

create table public.zoe_ops (
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    op_id text not null check (op_id ~ '^[A-Za-z0-9_-]{16,64}$'),
    result jsonb not null,
    created_at timestamptz not null default now(),
    primary key (tenant_id, op_id)
);

alter table public.zoe_tenant_state enable row level security;
alter table public.zoe_docs enable row level security;
alter table public.zoe_ops enable row level security;

revoke all on table public.zoe_tenant_state, public.zoe_docs, public.zoe_ops from public, anon, authenticated, service_role;
grant select on table public.zoe_tenant_state, public.zoe_docs to authenticated;

create policy zoe_tenant_state_select on public.zoe_tenant_state for select to authenticated
    using (tenant_id = (select private.current_tenant_id()));

create policy zoe_docs_select on public.zoe_docs for select to authenticated
    using (tenant_id = (select private.current_tenant_id()));

create function private.zoe_now_ms() returns bigint
language sql volatile set search_path = ''
as $$
    select floor(extract(epoch from clock_timestamp()) * 1000)::bigint
$$;

create function private.zoe_key_ok(p_key text) returns boolean
language sql immutable set search_path = ''
as $$
    select p_key is not null and octet_length(p_key) between 1 and 768 and p_key !~ '[\]\[.#$/\x01-\x1f\x7f]'
$$;

create function private.zoe_canon(p_value jsonb, p_depth integer default 0) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
    result jsonb := '{}'::jsonb;
    child_key text;
    child jsonb;
    idx integer := 0;
begin
    if p_value is null then
        return 'null'::jsonb;
    end if;
    if p_depth > 32 then
        raise exception 'invalid_data' using errcode = '22023', detail = 'depth';
    end if;
    case jsonb_typeof(p_value)
    when 'object' then
        for child_key, child in select e.key, e.value from jsonb_each(p_value) e loop
            if not private.zoe_key_ok(child_key) then
                raise exception 'invalid_data' using errcode = '22023', detail = 'key';
            end if;
            child := private.zoe_canon(child, p_depth + 1);
            if child <> 'null'::jsonb then
                result := result || jsonb_build_object(child_key, child);
            end if;
        end loop;
    when 'array' then
        for child in select e.value from jsonb_array_elements(p_value) e loop
            child := private.zoe_canon(child, p_depth + 1);
            if child <> 'null'::jsonb then
                result := result || jsonb_build_object(idx::text, child);
            end if;
            idx := idx + 1;
        end loop;
    when 'number' then
        if abs((p_value #>> '{}')::numeric) > 1.7976931348623157e308 then
            raise exception 'invalid_data' using errcode = '22023', detail = 'number';
        end if;
        if abs((p_value #>> '{}')::numeric) < 2.2250738585072014e-308 then
            return '0'::jsonb;
        end if;
        return to_jsonb((p_value #>> '{}')::float8);
    else
        return p_value;
    end case;
    if result = '{}'::jsonb then
        return 'null'::jsonb;
    end if;
    return result;
end
$$;

create function private.zoe_set_path(p_doc jsonb, p_sub text[], p_value jsonb) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
    base jsonb;
    child jsonb;
begin
    if coalesce(cardinality(p_sub), 0) = 0 then
        return p_value;
    end if;
    base := case when jsonb_typeof(p_doc) = 'object' then p_doc else '{}'::jsonb end;
    child := private.zoe_set_path(coalesce(base -> p_sub[1], 'null'::jsonb), p_sub[2:], p_value);
    if child = 'null'::jsonb then
        base := base - p_sub[1];
    else
        base := base || jsonb_build_object(p_sub[1], child);
    end if;
    if base = '{}'::jsonb then
        return 'null'::jsonb;
    end if;
    return base;
end
$$;

create function private.zoe_utf16_length(p_text text) returns integer
language sql immutable set search_path = ''
as $$
    select char_length(p_text) + (select count(*)::integer from regexp_matches(p_text, '[\U00010000-\U0010FFFF]', 'g'))
$$;

create function private.zoe_is_snap(p_value jsonb) returns boolean
language sql immutable set search_path = ''
as $$
    select jsonb_typeof(p_value) = 'object' and p_value ? '$s'
$$;

create function private.zoe_snap_val(p_snap jsonb, p_ctx jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
    snap_path text[] := array(select jsonb_array_elements_text(p_snap -> 'p'));
    depth integer := cardinality(snap_path);
    post boolean := (p_snap ->> '$s') = '1';
    tenant uuid := (p_ctx ->> 't')::uuid;
    pre jsonb := coalesce(p_ctx -> 'pre', '{}'::jsonb);
    doc jsonb;
    doc_key text;
begin
    if depth = 0 then
        select coalesce(jsonb_object_agg(x.root, x.v), 'null'::jsonb) into doc
        from (
            select r.root, private.zoe_snap_val(jsonb_build_object('$s', p_snap -> '$s', 'p', jsonb_build_array(r.root)), p_ctx) as v
            from (select distinct z.root from public.zoe_docs z where z.tenant_id = tenant) r
        ) x
        where x.v <> 'null'::jsonb;
        return doc;
    end if;
    if depth = 1 then
        select coalesce(jsonb_object_agg(d.key, d.v), 'null'::jsonb) into doc
        from (
            select z.key,
                case when not post and pre ? (z.root || '/' || z.key) then pre -> (z.root || '/' || z.key)
                     else coalesce(z.value, 'null'::jsonb) end as v
            from public.zoe_docs z
            where z.tenant_id = tenant and z.root = snap_path[1]
        ) d
        where d.v <> 'null'::jsonb;
        return doc;
    end if;
    doc_key := snap_path[1] || '/' || snap_path[2];
    if not post and pre ? doc_key then
        doc := pre -> doc_key;
    else
        select coalesce(z.value, 'null'::jsonb) into doc
        from public.zoe_docs z
        where z.tenant_id = tenant and z.root = snap_path[1] and z.key = snap_path[2];
        if not found then
            doc := 'null'::jsonb;
        end if;
    end if;
    if depth = 2 then
        return doc;
    end if;
    return coalesce(doc #> snap_path[3:depth], 'null'::jsonb);
end
$$;

create function private.zoe_eval(p_expr jsonb, p_ctx jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
    kind text := p_expr ->> 't';
    op text := p_expr ->> 'o';
    left_value jsonb;
    right_value jsonb;
    target jsonb;
    arg jsonb;
    value jsonb;
    item jsonb;
    seg text;
    snap_path jsonb;
    left_type text;
    right_type text;
    same boolean;
    left_num numeric;
    right_num numeric;
begin
    case kind
    when 'l' then
        return p_expr -> 'v';
    when 'v' then
        return p_ctx -> 'vars' -> (p_expr ->> 'n');
    when 'now' then
        return to_jsonb((p_ctx ->> 'now')::numeric);
    when 'auth' then
        return '{}'::jsonb;
    when 'root' then
        return jsonb_build_object('$s', 0, 'p', '[]'::jsonb);
    when 'data' then
        return jsonb_build_object('$s', 0, 'p', p_ctx -> 'loc');
    when 'newData' then
        return jsonb_build_object('$s', 1, 'p', p_ctx -> 'loc');
    when 'arr' then
        value := '[]'::jsonb;
        for item in select e.value from jsonb_array_elements(p_expr -> 'items') e loop
            arg := private.zoe_eval(item, p_ctx);
            if arg is null then
                return null;
            end if;
            value := value || jsonb_build_array(arg);
        end loop;
        return value;
    when '&&', '||' then
        left_value := private.zoe_eval(p_expr -> 'l', p_ctx);
        if left_value is null or jsonb_typeof(left_value) <> 'boolean' then
            return null;
        end if;
        if (kind = '&&' and left_value = 'false'::jsonb) or (kind = '||' and left_value = 'true'::jsonb) then
            return left_value;
        end if;
        right_value := private.zoe_eval(p_expr -> 'r', p_ctx);
        if right_value is null or jsonb_typeof(right_value) <> 'boolean' then
            return null;
        end if;
        return right_value;
    when 'u' then
        value := private.zoe_eval(p_expr -> 'e', p_ctx);
        if value is null or private.zoe_is_snap(value) then
            return null;
        end if;
        if op = '!' then
            if jsonb_typeof(value) <> 'boolean' then
                return null;
            end if;
            return to_jsonb(not (value = 'true'::jsonb));
        end if;
        if op = '-' and jsonb_typeof(value) = 'number' then
            return to_jsonb(-((value #>> '{}')::numeric));
        end if;
        return null;
    when 'b' then
        left_value := private.zoe_eval(p_expr -> 'l', p_ctx);
        if left_value is null then
            return null;
        end if;
        right_value := private.zoe_eval(p_expr -> 'r', p_ctx);
        if right_value is null or private.zoe_is_snap(left_value) or private.zoe_is_snap(right_value) then
            return null;
        end if;
        left_type := jsonb_typeof(left_value);
        right_type := jsonb_typeof(right_value);
        if op in ('===', '==', '!==', '!=') then
            if left_type <> right_type then
                same := false;
            elsif left_type in ('object', 'array') then
                return null;
            elsif left_type = 'number' then
                same := (left_value #>> '{}')::numeric = (right_value #>> '{}')::numeric;
            else
                same := left_value = right_value;
            end if;
            return to_jsonb(case when op in ('===', '==') then same else not same end);
        end if;
        if op in ('<', '<=', '>', '>=') then
            if left_type = 'number' and right_type = 'number' then
                left_num := (left_value #>> '{}')::numeric;
                right_num := (right_value #>> '{}')::numeric;
                return to_jsonb(case op when '<' then left_num < right_num when '<=' then left_num <= right_num
                    when '>' then left_num > right_num else left_num >= right_num end);
            end if;
            if left_type = 'string' and right_type = 'string' then
                return to_jsonb(case op
                    when '<' then (left_value #>> '{}') collate "C" < (right_value #>> '{}') collate "C"
                    when '<=' then (left_value #>> '{}') collate "C" <= (right_value #>> '{}') collate "C"
                    when '>' then (left_value #>> '{}') collate "C" > (right_value #>> '{}') collate "C"
                    else (left_value #>> '{}') collate "C" >= (right_value #>> '{}') collate "C" end);
            end if;
            return 'false'::jsonb;
        end if;
        if op = '+' and left_type = 'string' and right_type = 'string' then
            return to_jsonb((left_value #>> '{}') || (right_value #>> '{}'));
        end if;
        if left_type <> 'number' or right_type <> 'number' then
            return null;
        end if;
        left_num := (left_value #>> '{}')::numeric;
        right_num := (right_value #>> '{}')::numeric;
        if op = '+' then
            return to_jsonb(left_num + right_num);
        elsif op = '-' then
            return to_jsonb(left_num - right_num);
        elsif op = '*' then
            return to_jsonb(left_num * right_num);
        elsif op in ('/', '%') then
            if right_num = 0 then
                return null;
            end if;
            return to_jsonb(case when op = '/' then left_num / right_num else left_num % right_num end);
        end if;
        return null;
    when 'p' then
        value := private.zoe_eval(p_expr -> 'o', p_ctx);
        if value is null or private.zoe_is_snap(value) or jsonb_typeof(value) <> 'string' or p_expr ->> 'n' <> 'length' then
            return null;
        end if;
        return to_jsonb(private.zoe_utf16_length(value #>> '{}'));
    when 'm' then
        target := private.zoe_eval(p_expr -> 'o', p_ctx);
        if target is null or not private.zoe_is_snap(target) then
            return null;
        end if;
        case p_expr ->> 'n'
        when 'child' then
            arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx);
            if arg is null or jsonb_typeof(arg) <> 'string' then
                return null;
            end if;
            snap_path := target -> 'p';
            for seg in select s from unnest(string_to_array(arg #>> '{}', '/')) s loop
                if seg <> '' then
                    if not private.zoe_key_ok(seg) then
                        return null;
                    end if;
                    snap_path := snap_path || to_jsonb(seg);
                end if;
            end loop;
            if snap_path = target -> 'p' then
                return null;
            end if;
            return jsonb_build_object('$s', target -> '$s', 'p', snap_path);
        when 'parent' then
            if jsonb_array_length(target -> 'p') = 0 then
                return null;
            end if;
            return jsonb_build_object('$s', target -> '$s', 'p', (target -> 'p') - (jsonb_array_length(target -> 'p') - 1));
        when 'val' then
            return private.zoe_snap_val(target, p_ctx);
        when 'exists' then
            return to_jsonb(private.zoe_snap_val(target, p_ctx) <> 'null'::jsonb);
        when 'isString' then
            return to_jsonb(jsonb_typeof(private.zoe_snap_val(target, p_ctx)) = 'string');
        when 'isNumber' then
            return to_jsonb(jsonb_typeof(private.zoe_snap_val(target, p_ctx)) = 'number');
        when 'isBoolean' then
            return to_jsonb(jsonb_typeof(private.zoe_snap_val(target, p_ctx)) = 'boolean');
        when 'hasChildren' then
            value := private.zoe_snap_val(target, p_ctx);
            if jsonb_array_length(p_expr -> 'a') = 0 then
                return to_jsonb(jsonb_typeof(value) = 'object');
            end if;
            arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx);
            if arg is null or jsonb_typeof(arg) <> 'array' then
                return null;
            end if;
            for item in select e.value from jsonb_array_elements(arg) e loop
                if jsonb_typeof(item) <> 'string' then
                    return null;
                end if;
            end loop;
            if jsonb_typeof(value) <> 'object' then
                return 'false'::jsonb;
            end if;
            for item in select e.value from jsonb_array_elements(arg) e loop
                if not value ? (item #>> '{}') then
                    return 'false'::jsonb;
                end if;
            end loop;
            return 'true'::jsonb;
        when 'hasChild' then
            arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx);
            if arg is null or jsonb_typeof(arg) <> 'string' then
                return null;
            end if;
            value := private.zoe_snap_val(target, p_ctx);
            return to_jsonb(jsonb_typeof(value) = 'object' and value ? (arg #>> '{}'));
        else
            return null;
        end case;
    else
        return null;
    end case;
end
$$;

create function private.zoe_rule_true(p_expr jsonb, p_ctx jsonb) returns boolean
language sql stable set search_path = ''
as $$
    select coalesce(private.zoe_eval(p_expr, p_ctx) = 'true'::jsonb, false)
$$;

create function private.zoe_validate_tree(p_node jsonb, p_path text[], p_value jsonb, p_vars jsonb, p_ctx jsonb) returns boolean
language plpgsql stable set search_path = ''
as $$
declare
    child_key text;
    child_value jsonb;
    child_node jsonb;
    child_vars jsonb;
    child_path text[];
begin
    for child_key, child_value in select e.key, e.value from jsonb_each(p_value) e loop
        if p_node -> 'c' ? child_key then
            child_node := p_node -> 'c' -> child_key;
            child_vars := p_vars;
        elsif p_node ? 'x' then
            child_node := p_node -> 'x' -> 'r';
            child_vars := p_vars || jsonb_build_object(p_node -> 'x' ->> 'n', child_key);
        else
            continue;
        end if;
        child_path := p_path || child_key;
        if child_node ? 'v' and not private.zoe_rule_true(child_node -> 'v',
                p_ctx || jsonb_build_object('vars', child_vars, 'loc', to_jsonb(child_path))) then
            return false;
        end if;
        if jsonb_typeof(child_value) = 'object' and (child_node ? 'c' or child_node ? 'x')
                and not private.zoe_validate_tree(child_node, child_path, child_value, child_vars, p_ctx) then
            return false;
        end if;
    end loop;
    return true;
end
$$;

create function private.zoe_check_location(p_rules jsonb, p_path text[], p_ctx jsonb) returns boolean
language plpgsql stable set search_path = ''
as $$
declare
    node jsonb := p_rules;
    vars jsonb := '{}'::jsonb;
    granted boolean := false;
    depth integer := cardinality(p_path);
    i integer;
    seg text;
    ctx jsonb;
    post jsonb;
begin
    for i in 0 .. depth loop
        if i > 0 then
            seg := p_path[i];
            if node -> 'c' ? seg then
                node := node -> 'c' -> seg;
            elsif node ? 'x' then
                vars := vars || jsonb_build_object(node -> 'x' ->> 'n', seg);
                node := node -> 'x' -> 'r';
            else
                node := null;
            end if;
        end if;
        exit when node is null;
        ctx := p_ctx || jsonb_build_object('vars', vars, 'loc', to_jsonb(p_path[1:i]));
        if not granted and node ? 'w' then
            granted := private.zoe_rule_true(node -> 'w', ctx);
        end if;
        if node ? 'v' then
            post := private.zoe_snap_val(jsonb_build_object('$s', 1, 'p', to_jsonb(p_path[1:i])), p_ctx);
            if post <> 'null'::jsonb and not private.zoe_rule_true(node -> 'v', ctx) then
                return false;
            end if;
        end if;
        if i = depth and (node ? 'c' or node ? 'x') then
            post := private.zoe_snap_val(jsonb_build_object('$s', 1, 'p', to_jsonb(p_path)), p_ctx);
            if jsonb_typeof(post) = 'object' and not private.zoe_validate_tree(node, p_path, post, vars, p_ctx) then
                return false;
            end if;
        end if;
    end loop;
    return granted;
end
$$;

create function private.zoe_path_of(p_raw jsonb) returns text[]
language plpgsql immutable set search_path = ''
as $$
declare
    result text[];
begin
    if jsonb_typeof(p_raw) <> 'array' or jsonb_array_length(p_raw) < 1 or jsonb_array_length(p_raw) > 32 then
        raise exception 'invalid_path' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(p_raw) e where jsonb_typeof(e.value) <> 'string') then
        raise exception 'invalid_path' using errcode = '22023';
    end if;
    result := array(select e.value from jsonb_array_elements_text(p_raw) e);
    if exists (select 1 from unnest(result) s where not private.zoe_key_ok(s)) then
        raise exception 'invalid_path' using errcode = '22023';
    end if;
    return result;
end
$$;

create function private.zoe_root_value(p_work jsonb, p_root text) returns jsonb
language sql immutable set search_path = ''
as $$
    select coalesce(jsonb_object_agg(substr(e.key, char_length(p_root) + 2), e.value) filter (where e.value <> 'null'::jsonb), 'null'::jsonb)
    from jsonb_each(p_work) e
    where starts_with(e.key, p_root || '/')
$$;

create function private.zoe_apply(p_tenant uuid, p_op_id text, p_ops jsonb, p_enforce boolean, p_replace boolean) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
    tenant uuid := p_tenant;
    now_ms bigint := private.zoe_now_ms();
    head bigint;
    next_seq bigint;
    prior jsonb;
    op jsonb;
    kind text;
    op_path text[];
    doc_key text;
    pre jsonb := '{}'::jsonb;
    pre_seq jsonb := '{}'::jsonb;
    locked_roots text[] := '{}'::text[];
    work jsonb;
    locations jsonb := '[]'::jsonb;
    rules jsonb;
    ctx jsonb;
    loc jsonb;
    loc_path text[];
    current_value jsonb;
    delta float8;
    new_value jsonb;
    child_key text;
    row_key text;
    row_value jsonb;
    row_seq bigint;
    changed boolean := false;
    out_docs jsonb := '[]'::jsonb;
    stored_docs jsonb := '[]'::jsonb;
    result jsonb;
    ops_count integer;
    i integer;
    j integer;
    a text[];
    b text[];
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_op_id is null or p_op_id !~ '^[A-Za-z0-9_-]{16,64}$' then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    if jsonb_typeof(p_ops) <> 'array' then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    ops_count := jsonb_array_length(p_ops);
    if ops_count < 1 or ops_count > 500 then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    if octet_length(p_ops::text) > 4194304 then
        raise exception 'invalid_data' using errcode = '22023', detail = 'size';
    end if;

    insert into public.zoe_tenant_state (tenant_id) values (tenant) on conflict (tenant_id) do nothing;
    select s.seq into head from public.zoe_tenant_state s where s.tenant_id = tenant for update;
    select o.result into prior from public.zoe_ops o where o.tenant_id = tenant and o.op_id = p_op_id;
    if found then
        return prior || jsonb_build_object('replayed', true, 'now', now_ms);
    end if;
    next_seq := head + 1;
    if p_replace then
        update public.zoe_docs z set value = null, seq = next_seq, updated_at = now()
        where z.tenant_id = tenant and z.value is not null;
        changed := found;
    end if;

    for op in select e.value from jsonb_array_elements(p_ops) e loop
        kind := op ->> 'k';
        if kind is null or kind not in ('set', 'inc', 'cas') then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        if kind = 'cas' and ops_count <> 1 then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        if kind <> 'inc' and not op ? 'v' then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        op_path := private.zoe_path_of(op -> 'p');
        if cardinality(op_path) = 1 and kind = 'inc' then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        locations := locations || jsonb_build_array(to_jsonb(op_path));
        if cardinality(op_path) = 1 then
            if not op_path[1] = any(locked_roots) then
                for row_key, row_value, row_seq in
                    select z.key, z.value, z.seq from public.zoe_docs z
                    where z.tenant_id = tenant and z.root = op_path[1]
                    order by z.key
                    for update
                loop
                    doc_key := op_path[1] || '/' || row_key;
                    if not pre ? doc_key then
                        pre := pre || jsonb_build_object(doc_key, coalesce(row_value, 'null'::jsonb));
                        pre_seq := pre_seq || jsonb_build_object(doc_key, case when row_value is null then 0 else row_seq end);
                    end if;
                end loop;
                locked_roots := locked_roots || op_path[1];
            end if;
            new_value := private.zoe_canon(op -> 'v');
            if jsonb_typeof(new_value) = 'object' then
                for child_key in select jsonb_object_keys(new_value) loop
                    doc_key := op_path[1] || '/' || child_key;
                    if not pre ? doc_key then
                        pre := pre || jsonb_build_object(doc_key, 'null'::jsonb);
                        pre_seq := pre_seq || jsonb_build_object(doc_key, 0);
                    end if;
                end loop;
            end if;
            continue;
        end if;
        doc_key := op_path[1] || '/' || op_path[2];
        if not pre ? doc_key then
            select coalesce(z.value, 'null'::jsonb), case when z.value is null then 0 else z.seq end
                into current_value, row_seq
            from public.zoe_docs z
            where z.tenant_id = tenant and z.root = op_path[1] and z.key = op_path[2]
            for update;
            if not found then
                current_value := 'null'::jsonb;
                row_seq := 0;
            end if;
            pre := pre || jsonb_build_object(doc_key, current_value);
            pre_seq := pre_seq || jsonb_build_object(doc_key, row_seq);
        end if;
    end loop;

    for i in 0 .. jsonb_array_length(locations) - 1 loop
        a := array(select jsonb_array_elements_text(locations -> i));
        for j in 0 .. jsonb_array_length(locations) - 1 loop
            continue when i = j;
            b := array(select jsonb_array_elements_text(locations -> j));
            if cardinality(a) <= cardinality(b) and b[1:cardinality(a)] = a then
                raise exception 'invalid_op' using errcode = '22023', detail = 'overlap';
            end if;
        end loop;
    end loop;

    work := pre;
    for op in select e.value from jsonb_array_elements(p_ops) e loop
        kind := op ->> 'k';
        op_path := private.zoe_path_of(op -> 'p');
        if cardinality(op_path) = 1 then
            if kind = 'cas' then
                current_value := private.zoe_root_value(work, op_path[1]);
                if current_value <> private.zoe_canon(op -> 'x') then
                    return jsonb_build_object('ok', false, 'conflict', true, 'now', now_ms, 'value', current_value);
                end if;
            end if;
            new_value := private.zoe_canon(op -> 'v');
            if new_value <> 'null'::jsonb and jsonb_typeof(new_value) <> 'object' then
                raise exception 'invalid_data' using errcode = '22023', detail = 'root';
            end if;
            for doc_key in select e.key from jsonb_each(work) e where starts_with(e.key, op_path[1] || '/') loop
                work := jsonb_set(work, array[doc_key], coalesce(new_value -> substr(doc_key, char_length(op_path[1]) + 2), 'null'::jsonb));
            end loop;
            continue;
        end if;
        doc_key := op_path[1] || '/' || op_path[2];
        if kind = 'set' then
            work := jsonb_set(work, array[doc_key], private.zoe_set_path(work -> doc_key, op_path[3:], private.zoe_canon(op -> 'v')));
        elsif kind = 'inc' then
            if jsonb_typeof(op -> 'd') <> 'number' then
                raise exception 'invalid_op' using errcode = '22023';
            end if;
            delta := (op ->> 'd')::float8;
            current_value := coalesce((work -> doc_key) #> op_path[3:], 'null'::jsonb);
            new_value := to_jsonb(case when jsonb_typeof(current_value) = 'number' then (current_value #>> '{}')::float8 else 0::float8 end + delta);
            work := jsonb_set(work, array[doc_key], private.zoe_set_path(work -> doc_key, op_path[3:], private.zoe_canon(new_value)));
        else
            current_value := coalesce((work -> doc_key) #> op_path[3:], 'null'::jsonb);
            if current_value <> private.zoe_canon(op -> 'x') then
                return jsonb_build_object('ok', false, 'conflict', true, 'now', now_ms, 'value', current_value);
            end if;
            work := jsonb_set(work, array[doc_key], private.zoe_set_path(work -> doc_key, op_path[3:], private.zoe_canon(op -> 'v')));
        end if;
    end loop;

    for doc_key, new_value in select e.key, e.value from jsonb_each(work) e loop
        if octet_length(new_value::text) > 1048576 then
            raise exception 'invalid_data' using errcode = '22023', detail = 'size';
        end if;
        if new_value = pre -> doc_key then
            out_docs := out_docs || jsonb_build_array(jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2),
                'v', new_value, 's', (pre_seq ->> doc_key)::bigint));
            continue;
        end if;
        changed := true;
        insert into public.zoe_docs as z (tenant_id, root, key, value, seq, updated_at)
        values (tenant, split_part(doc_key, '/', 1), split_part(doc_key, '/', 2), nullif(new_value, 'null'::jsonb), next_seq, now())
        on conflict (tenant_id, root, key) do update
            set value = excluded.value, seq = excluded.seq, updated_at = excluded.updated_at;
        out_docs := out_docs || jsonb_build_array(jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2),
            'v', new_value, 's', next_seq));
        stored_docs := stored_docs || jsonb_build_array(jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2), 's', next_seq));
    end loop;

    if p_enforce then
        rules := private.zoe_rules();
        ctx := jsonb_build_object('t', tenant, 'now', now_ms, 'pre', pre);
        for loc in select e.value from jsonb_array_elements(locations) e loop
            loc_path := array(select jsonb_array_elements_text(loc));
            if not private.zoe_check_location(rules, loc_path, ctx) then
                raise exception 'permission_denied' using errcode = '42501', detail = array_to_string(loc_path, '/');
            end if;
        end loop;
    end if;

    if changed then
        update public.zoe_tenant_state s set seq = next_seq where s.tenant_id = tenant;
    else
        next_seq := head;
    end if;
    result := jsonb_build_object('ok', true, 'seq', next_seq, 'docs', stored_docs);
    insert into public.zoe_ops (tenant_id, op_id, result) values (tenant, p_op_id, result);
    if changed and next_seq % 64 = 0 then
        perform private.zoe_housekeeping(tenant);
    end if;
    return jsonb_build_object('ok', true, 'seq', next_seq, 'now', now_ms, 'docs', out_docs);
end
$$;

create function public.zoe_write(p_op_id text, p_ops jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
    tenant uuid := private.current_tenant_id();
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    return private.zoe_apply(tenant, p_op_id, p_ops, true, false);
end
$$;

create function public.zoe_admin_write(p_tenant uuid, p_op_id text, p_ops jsonb, p_replace boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
    if p_tenant is null or not exists (select 1 from public.tenants t where t.id = p_tenant) then
        raise exception 'tenant-not-found' using errcode = 'P0002';
    end if;
    return private.zoe_apply(p_tenant, p_op_id, p_ops, false, coalesce(p_replace, false));
end
$$;

create function private.zoe_housekeeping(p_tenant uuid) returns void
language plpgsql volatile set search_path = ''
as $$
declare
    purged bigint;
begin
    with gone as (
        delete from public.zoe_docs z
        where z.tenant_id = p_tenant and z.value is null and z.updated_at < now() - interval '7 days'
        returning z.seq
    )
    select max(gone.seq) into purged from gone;
    if purged is not null then
        update public.zoe_tenant_state s set purged_seq = greatest(s.purged_seq, purged) where s.tenant_id = p_tenant;
    end if;
    delete from public.zoe_ops o where o.tenant_id = p_tenant and o.created_at < now() - interval '2 days';
end
$$;

create function public.zoe_read(p_root text, p_key text default null) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
    tenant uuid := private.current_tenant_id();
    docs jsonb;
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('r', d.root, 'k', d.key, 'v', coalesce(d.value, 'null'::jsonb), 's', case when d.value is null then 0 else d.seq end)), '[]'::jsonb)
        into docs
    from public.zoe_docs d
    where d.tenant_id = tenant and d.root = p_root and (p_key is null or d.key = p_key) and (p_key is not null or d.value is not null);
    return jsonb_build_object('now', private.zoe_now_ms(), 'docs', docs);
end
$$;

create function public.zoe_pull(p_since bigint, p_limit integer default 2000) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
    tenant uuid := private.current_tenant_id();
    head bigint := 0;
    purged bigint := 0;
    since bigint := coalesce(p_since, 0);
    lim integer := least(greatest(coalesce(p_limit, 2000), 1), 5000);
    upper_seq bigint;
    rows_out jsonb;
    more boolean := false;
    full_sync boolean := false;
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    select s.seq, s.purged_seq into head, purged from public.zoe_tenant_state s where s.tenant_id = tenant;
    head := coalesce(head, 0);
    purged := coalesce(purged, 0);
    if since < 0 or since > head or (since > 0 and since < purged) then
        since := 0;
    end if;
    full_sync := since = 0;
    select max(x.seq) into upper_seq
    from (
        select d.seq from public.zoe_docs d
        where d.tenant_id = tenant and d.seq > since and (not full_sync or d.value is not null)
        order by d.seq
        limit lim
    ) x;
    if upper_seq is null then
        return jsonb_build_object('seq', greatest(since, head), 'more', false, 'reset', full_sync, 'now', private.zoe_now_ms(), 'rows', '[]'::jsonb);
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('r', d.root, 'k', d.key, 'v', coalesce(d.value, 'null'::jsonb), 's', d.seq) order by d.seq), '[]'::jsonb)
        into rows_out
    from public.zoe_docs d
    where d.tenant_id = tenant and d.seq > since and d.seq <= upper_seq and (not full_sync or d.value is not null);
    more := exists (
        select 1 from public.zoe_docs d
        where d.tenant_id = tenant and d.seq > upper_seq and (not full_sync or d.value is not null)
    );
    return jsonb_build_object('seq', case when more then upper_seq else greatest(upper_seq, head) end, 'more', more, 'reset', full_sync,
        'now', private.zoe_now_ms(), 'rows', rows_out);
end
$$;

create function public.zoe_now() returns bigint
language sql volatile security invoker set search_path = ''
as $$
    select private.zoe_now_ms()
$$;

create function private.zoe_broadcast_seq() returns trigger
language plpgsql volatile security definer set search_path = ''
as $$
begin
    begin
        perform realtime.send(jsonb_build_object('seq', new.seq), 'seq', 'zoe:' || new.tenant_id::text, true);
    exception when others then
        null;
    end;
    return null;
end
$$;

create trigger zoe_tenant_state_broadcast
after update of seq on public.zoe_tenant_state
for each row when (new.seq is distinct from old.seq)
execute function private.zoe_broadcast_seq();

do $zoe_realtime$
begin
    if to_regclass('realtime.messages') is not null then
        execute $policy$
            create policy zoe_tenant_broadcast_read on realtime.messages for select to authenticated
            using (
                realtime.messages.extension = 'broadcast'
                and (select realtime.topic()) = 'zoe:' || (select private.current_tenant_id())::text
            )
        $policy$;
    end if;
end
$zoe_realtime$;

revoke all on function private.zoe_now_ms(), private.zoe_key_ok(text), private.zoe_canon(jsonb, integer),
    private.zoe_set_path(jsonb, text[], jsonb), private.zoe_utf16_length(text), private.zoe_is_snap(jsonb),
    private.zoe_snap_val(jsonb, jsonb), private.zoe_eval(jsonb, jsonb), private.zoe_rule_true(jsonb, jsonb),
    private.zoe_validate_tree(jsonb, text[], jsonb, jsonb, jsonb), private.zoe_check_location(jsonb, text[], jsonb),
    private.zoe_path_of(jsonb), private.zoe_housekeeping(uuid), private.zoe_broadcast_seq(),
    private.zoe_apply(uuid, text, jsonb, boolean, boolean), private.zoe_root_value(jsonb, text)
    from public;
grant execute on function private.zoe_now_ms() to authenticated;
revoke all on function public.zoe_write(text, jsonb), public.zoe_read(text, text), public.zoe_pull(bigint, integer), public.zoe_now(),
    public.zoe_admin_write(uuid, text, jsonb, boolean)
    from public, anon, authenticated, service_role;
grant execute on function public.zoe_write(text, jsonb), public.zoe_read(text, text), public.zoe_pull(bigint, integer), public.zoe_now()
    to authenticated;
grant execute on function public.zoe_admin_write(uuid, text, jsonb, boolean) to service_role;
