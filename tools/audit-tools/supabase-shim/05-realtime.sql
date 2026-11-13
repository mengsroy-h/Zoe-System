-- ⛔ មិនមែនច្បាប់ចម្លងពី Supabase ទេ ៖ schema `realtime` (តារាង messages · topic() · send()) ត្រូវបង្កើតដោយ service Realtime ផ្ទាល់
--    (migration Elixir) ដែលម៉ាស៊ីននេះទាញមិនបាន ➜ នេះជាគំរូតាមកិច្ចសន្យាដែលឯកសារ Supabase ពិពណ៌នា ៖
--    · realtime.send(payload jsonb, event text, topic text, private boolean) ➜ ដាក់ជួរដេកក្នុង realtime.messages (extension 'broadcast')
--    · realtime.topic() ➜ current_setting('realtime.topic') ដែល Realtime កំណត់ពេលពិនិត្យសិទ្ធិ channel ឯកជន
--    · Realtime ពិនិត្យសិទ្ធិដោយ SELECT លើ realtime.messages ជា role/JWT របស់អ្នកប្រើ ➜ RLS policy របស់យើងជាអ្នកសម្រេច
-- ⛔ បើ signature ពិតខុស ➜ trigger របស់យើងលេបកំហុស ➜ App ធ្លាក់ចុះទៅការទាញតាមវដ្ត (មិនមែនការបាត់ទិន្នន័យ)
create schema if not exists realtime;
grant usage on schema realtime to postgres, anon, authenticated, service_role;

create table realtime.messages (
    id uuid primary key default gen_random_uuid(),
    topic text not null,
    extension text not null,
    payload jsonb,
    event text,
    private boolean default false,
    updated_at timestamp without time zone not null default now(),
    inserted_at timestamp without time zone not null default now()
);
alter table realtime.messages enable row level security;
grant select, insert, update, delete on realtime.messages to postgres, authenticated, anon, service_role;

create function realtime.topic() returns text
language sql stable
as $$
    select nullif(current_setting('realtime.topic', true), '')::text;
$$;

create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
language plpgsql
as $$
begin
    begin
        execute format('set local realtime.topic to %L', topic);
        insert into realtime.messages (payload, event, topic, private, extension)
        values (payload, event, topic, private, 'broadcast');
    exception
        when others then
            raise warning 'ErrorSendingBroadcastMessage: %', sqlerrm;
    end;
end;
$$;
grant execute on function realtime.topic(), realtime.send(jsonb, text, text, boolean) to postgres, authenticated, anon, service_role;
-- ⛔ ឯកសារ Supabase ឲ្យ SQL editor (role postgres) បង្កើត policy លើ realtime.messages ➜ postgres ត្រូវជាម្ចាស់ក្នុងគំរូនេះ
alter table realtime.messages owner to postgres;
