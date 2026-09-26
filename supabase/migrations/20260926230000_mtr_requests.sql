-- Inspector MTR request drafts. Lines are what the inspector typed.
-- This table does not create material and does not mark anything acceptable.
-- RLS matches the other project tables: a member can read, an owner or inspector can write.

create table public.mtr_requests (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete restrict,
  inspector_name text not null default '',
  vendor text not null default '',
  atmos_project_number text not null default '',
  sales_order_or_customer_po text not null default '',
  shipment_number_mrc text not null default '',
  lines jsonb not null default '[]'::jsonb,
  status_note text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint mtr_requests_lines_array_check check (jsonb_typeof(lines) = 'array')
);

comment on table public.mtr_requests is
  'Draft MTR request saved by an inspector. Not a submission and not an acceptance.';

create index mtr_requests_project_id_idx on public.mtr_requests (project_id);

create trigger mtr_requests_set_updated_at
before update on public.mtr_requests
for each row execute function private.touch_updated_at();

create trigger mtr_requests_audit
after insert or update or delete on public.mtr_requests
for each row execute function private.write_audit_log();

alter table public.mtr_requests enable row level security;
alter table public.mtr_requests force row level security;

revoke all on table public.mtr_requests from public, anon, authenticated;
grant select, insert, update on table public.mtr_requests to authenticated;

create policy mtr_requests_select on public.mtr_requests
for select to authenticated
using ((select private.is_project_member(project_id)));

create policy mtr_requests_insert on public.mtr_requests
for insert to authenticated
with check ((select private.can_edit_project(project_id)));

create policy mtr_requests_update on public.mtr_requests
for update to authenticated
using ((select private.can_edit_project(project_id)))
with check ((select private.can_edit_project(project_id)));

-- Site URL for Auth (set on the hosted project, not in SQL):
-- https://1319dev.github.io/TJMaterials/
-- Redirect allow list:
-- https://1319dev.github.io/TJMaterials/
-- https://1319dev.github.io/TJMaterials/auth/callback
-- http://localhost:5173/TJMaterials/auth/callback
