create index if not exists tenant_invites_created_by_idx on public.tenant_invites (created_by);
create index if not exists member_reset_codes_created_by_idx on public.member_reset_codes (created_by);
create index if not exists tenant_members_invite_code_hash_idx on public.tenant_members (invite_code_hash);
