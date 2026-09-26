-- Pipeline Material Inspector — initial schema.
-- Third-party inspection records. Not an Atmos Energy or TJ Inspection product.
-- atmos_project_number stores the customer form label "Atmos Project #".
-- shipment_number_mrc stores "Shipment # (MRC)".
-- verification_status never defaults to a pass/accept outcome.
-- Clients may generate UUID primary keys for offline inserts.
-- Helper functions live in schema private, which must stay out of the Data API exposed schemas.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create domain public.verification_status as text
  constraint verification_status_check check (
    value in (
      'match',
      'difference_found',
      'review_required',
      'not_provided',
      'not_verified',
      'missing_documentation'
    )
  );

comment on domain public.verification_status is
  'Inspector-recorded comparison state. The database does not treat any value as clearance to install.';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  inspector_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint profiles_email_len_check check (char_length(email) <= 320)
);

comment on table public.profiles is
  'Application profile for auth.users. Authorization roles are not stored here.';

create unique index profiles_email_uidx
  on public.profiles (lower(email))
  where email <> '';

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_number text not null default '',
  construction_order_no text not null default '',
  atmos_project_number text not null default '',
  inspector_name text not null default '',
  vendor text not null default '',
  sales_order_or_customer_po text not null default '',
  client_name text not null default '',
  spread text not null default '',
  location_name text not null default '',
  notes text not null default '',
  status text not null default 'active',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint projects_name_check check (char_length(btrim(name)) > 0),
  constraint projects_status_check check (status in ('active', 'archived'))
);

comment on column public.projects.atmos_project_number is
  'Customer-supplied reference labeled Atmos Project # on the MTR request form.';

comment on column public.projects.project_number is
  'Bill of materials header: Project Number.';

comment on column public.projects.construction_order_no is
  'Bill of materials header: Construction Order No.';

create index projects_created_by_idx on public.projects (created_by);
create index projects_project_number_idx on public.projects (project_number);
create index projects_atmos_project_number_idx on public.projects (atmos_project_number);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint project_members_role_check check (role in ('owner', 'inspector', 'viewer')),
  constraint project_members_unique unique (project_id, user_id)
);

create index project_members_user_id_idx on public.project_members (user_id);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  name text not null,
  location_type text not null default 'other',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  station_number text not null default '',
  description text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint locations_name_check check (char_length(btrim(name)) > 0),
  constraint locations_type_check check (
    location_type in ('yard', 'row', 'warehouse', 'laydown', 'station', 'other')
  ),
  constraint locations_lat_check check (latitude is null or latitude between -90 and 90),
  constraint locations_lng_check check (longitude is null or longitude between -180 and 180),
  constraint locations_gps_pair_check check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  )
);

create index locations_project_id_idx on public.locations (project_id);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  po_number text not null,
  vendor text not null default '',
  sales_order_number text not null default '',
  issued_on date,
  notes text not null default '',
  status text not null default 'open',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint purchase_orders_po_number_check check (char_length(btrim(po_number)) > 0),
  constraint purchase_orders_status_check check (status in ('open', 'closed', 'void')),
  constraint purchase_orders_project_po_unique unique (project_id, po_number)
);

create index purchase_orders_project_id_idx on public.purchase_orders (project_id);
create index purchase_orders_created_by_idx on public.purchase_orders (created_by);
create index purchase_orders_po_number_idx on public.purchase_orders (lower(po_number));

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  purchase_order_id uuid references public.purchase_orders (id) on delete restrict,
  received_on date,
  scheduled_on date,
  vendor text not null default '',
  inspector_name text not null default '',
  carrier text not null default '',
  bol_number text not null default '',
  packing_slip_number text not null default '',
  shipment_number_mrc text not null default '',
  sales_order_or_customer_po text not null default '',
  atmos_project_number text not null default '',
  status text not null default 'expected',
  notes text not null default '',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  gps_status text not null default 'not_requested',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint deliveries_status_check check (status in ('expected', 'received', 'partial')),
  constraint deliveries_gps_status_check check (
    gps_status in ('not_requested', 'granted', 'denied', 'unavailable', 'not_provided')
  ),
  constraint deliveries_lat_check check (latitude is null or latitude between -90 and 90),
  constraint deliveries_lng_check check (longitude is null or longitude between -180 and 180),
  constraint deliveries_gps_pair_check check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  ),
  constraint deliveries_paper_check check (
    status = 'expected'
    or char_length(btrim(bol_number)) > 0
    or char_length(btrim(packing_slip_number)) > 0
  )
);

comment on column public.deliveries.shipment_number_mrc is
  'MTR request form label: Shipment # (MRC).';

create index deliveries_project_id_idx on public.deliveries (project_id);
create index deliveries_purchase_order_id_idx on public.deliveries (purchase_order_id);
create index deliveries_created_by_idx on public.deliveries (created_by);
create index deliveries_project_received_on_idx on public.deliveries (project_id, received_on);
create index deliveries_project_scheduled_on_idx on public.deliveries (project_id, scheduled_on);
create index deliveries_bol_number_idx on public.deliveries (lower(bol_number));
create index deliveries_packing_slip_idx on public.deliveries (lower(packing_slip_number));
create index deliveries_shipment_mrc_idx on public.deliveries (lower(shipment_number_mrc));

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  delivery_id uuid references public.deliveries (id) on delete restrict,
  purchase_order_id uuid references public.purchase_orders (id) on delete restrict,
  location_id uuid references public.locations (id) on delete restrict,
  material_code text not null,
  category text not null,
  description text not null,
  diameter text not null default '',
  diameter_in numeric(8, 3),
  wall_thickness text not null default '',
  grade text not null default '',
  specification text not null default '',
  manufacturer text not null default '',
  model_number text not null default '',
  heat_number text not null default '',
  serial_or_lot text not null default '',
  joint_number text not null default '',
  ansi_pressure_rating text not null default '',
  quantity numeric(12, 3) not null default 1,
  unit text not null default 'ea',
  custody_status text not null default 'received',
  verification_status public.verification_status not null default 'not_verified',
  received_on date,
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint materials_code_check check (material_code ~ '^PMI-[A-Z]+-[0-9]{6}$'),
  constraint materials_category_check check (
    category in ('pipe', 'fitting', 'flange', 'valve', 'other')
  ),
  constraint materials_description_check check (char_length(btrim(description)) > 0),
  constraint materials_quantity_check check (quantity >= 0),
  constraint materials_custody_check check (
    custody_status in ('expected', 'received', 'on_hold', 'damaged', 'installed')
  ),
  constraint materials_code_unique unique (material_code)
);

comment on column public.materials.material_code is
  'Human Material ID, for example PMI-PIPE-000001. UUID id remains the primary key.';

comment on column public.materials.verification_status is
  'Defaults to not_verified. Receiving must not write match without an explicit inspector action.';

create index materials_project_id_idx on public.materials (project_id);
create index materials_delivery_id_idx on public.materials (delivery_id);
create index materials_purchase_order_id_idx on public.materials (purchase_order_id);
create index materials_location_id_idx on public.materials (location_id);
create index materials_created_by_idx on public.materials (created_by);
create index materials_project_heat_idx on public.materials (project_id, lower(heat_number));
create index materials_project_received_idx on public.materials (project_id, received_on);
create index materials_project_verification_idx on public.materials (project_id, verification_status);
create index materials_serial_idx on public.materials (lower(serial_or_lot));
create index materials_joint_idx on public.materials (lower(joint_number));
create index materials_manufacturer_idx on public.materials (lower(manufacturer));

create table public.pipe_joints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  material_id uuid references public.materials (id) on delete restrict,
  delivery_id uuid references public.deliveries (id) on delete restrict,
  material_code text not null,
  joint_number text not null,
  heat_number text not null default '',
  manufacturer text not null default '',
  diameter text not null default '',
  wall_thickness text not null default '',
  grade text not null default '',
  specification text not null default '',
  length_ft numeric(10, 3),
  coating text not null default '',
  custody_status text not null default 'received',
  verification_status public.verification_status not null default 'not_verified',
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pipe_joints_code_check check (material_code ~ '^PMI-[A-Z]+-[0-9]{6}$'),
  constraint pipe_joints_joint_check check (char_length(btrim(joint_number)) > 0),
  constraint pipe_joints_length_check check (length_ft is null or length_ft >= 0),
  constraint pipe_joints_custody_check check (
    custody_status in ('expected', 'received', 'on_hold', 'damaged', 'installed')
  ),
  constraint pipe_joints_code_unique unique (material_code),
  constraint pipe_joints_project_joint_unique unique (project_id, joint_number)
);

create index pipe_joints_project_id_idx on public.pipe_joints (project_id);
create index pipe_joints_material_id_idx on public.pipe_joints (material_id);
create index pipe_joints_delivery_id_idx on public.pipe_joints (delivery_id);
create index pipe_joints_created_by_idx on public.pipe_joints (created_by);
create index pipe_joints_heat_idx on public.pipe_joints (lower(heat_number));

create table public.fittings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  material_id uuid references public.materials (id) on delete restrict,
  delivery_id uuid references public.deliveries (id) on delete restrict,
  purchase_order_id uuid references public.purchase_orders (id) on delete restrict,
  material_code text not null,
  fitting_type text not null default 'other',
  description text not null,
  diameter text not null default '',
  wall_thickness text not null default '',
  grade text not null default '',
  specification text not null default '',
  manufacturer text not null default '',
  heat_number text not null default '',
  angle_deg numeric(6, 2),
  quantity numeric(12, 3) not null default 1,
  custody_status text not null default 'received',
  verification_status public.verification_status not null default 'not_verified',
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint fittings_code_check check (material_code ~ '^PMI-[A-Z]+-[0-9]{6}$'),
  constraint fittings_type_check check (
    fitting_type in ('elbow', 'tee', 'reducer', 'cap', 'other')
  ),
  constraint fittings_description_check check (char_length(btrim(description)) > 0),
  constraint fittings_quantity_check check (quantity >= 0),
  constraint fittings_custody_check check (
    custody_status in ('expected', 'received', 'on_hold', 'damaged', 'installed')
  ),
  constraint fittings_code_unique unique (material_code)
);

create index fittings_project_id_idx on public.fittings (project_id);
create index fittings_material_id_idx on public.fittings (material_id);
create index fittings_delivery_id_idx on public.fittings (delivery_id);
create index fittings_purchase_order_id_idx on public.fittings (purchase_order_id);
create index fittings_created_by_idx on public.fittings (created_by);
create index fittings_heat_idx on public.fittings (lower(heat_number));

create table public.flanges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  material_id uuid references public.materials (id) on delete restrict,
  delivery_id uuid references public.deliveries (id) on delete restrict,
  purchase_order_id uuid references public.purchase_orders (id) on delete restrict,
  material_code text not null,
  flange_type text not null default 'other',
  description text not null,
  diameter text not null default '',
  class_rating text not null default '',
  grade text not null default '',
  facing text not null default '',
  manufacturer text not null default '',
  heat_number text not null default '',
  serial_or_lot text not null default '',
  quantity numeric(12, 3) not null default 1,
  custody_status text not null default 'received',
  verification_status public.verification_status not null default 'not_verified',
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint flanges_code_check check (material_code ~ '^PMI-[A-Z]+-[0-9]{6}$'),
  constraint flanges_type_check check (
    flange_type in ('wn', 'so', 'blind', 'lap_joint', 'threaded', 'other')
  ),
  constraint flanges_description_check check (char_length(btrim(description)) > 0),
  constraint flanges_quantity_check check (quantity >= 0),
  constraint flanges_custody_check check (
    custody_status in ('expected', 'received', 'on_hold', 'damaged', 'installed')
  ),
  constraint flanges_code_unique unique (material_code)
);

create index flanges_project_id_idx on public.flanges (project_id);
create index flanges_material_id_idx on public.flanges (material_id);
create index flanges_delivery_id_idx on public.flanges (delivery_id);
create index flanges_purchase_order_id_idx on public.flanges (purchase_order_id);
create index flanges_created_by_idx on public.flanges (created_by);
create index flanges_heat_idx on public.flanges (lower(heat_number));
create index flanges_serial_idx on public.flanges (lower(serial_or_lot));

create table public.valves (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  material_id uuid references public.materials (id) on delete restrict,
  delivery_id uuid references public.deliveries (id) on delete restrict,
  purchase_order_id uuid references public.purchase_orders (id) on delete restrict,
  material_code text not null,
  valve_type text not null default 'other',
  description text not null,
  diameter text not null default '',
  class_rating text not null default '',
  grade text not null default '',
  manufacturer text not null default '',
  model_number text not null default '',
  heat_number text not null default '',
  serial_number text not null default '',
  quantity numeric(12, 3) not null default 1,
  custody_status text not null default 'received',
  verification_status public.verification_status not null default 'not_verified',
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint valves_code_check check (material_code ~ '^PMI-[A-Z]+-[0-9]{6}$'),
  constraint valves_description_check check (char_length(btrim(description)) > 0),
  constraint valves_quantity_check check (quantity >= 0),
  constraint valves_custody_check check (
    custody_status in ('expected', 'received', 'on_hold', 'damaged', 'installed')
  ),
  constraint valves_code_unique unique (material_code)
);

create index valves_project_id_idx on public.valves (project_id);
create index valves_material_id_idx on public.valves (material_id);
create index valves_delivery_id_idx on public.valves (delivery_id);
create index valves_purchase_order_id_idx on public.valves (purchase_order_id);
create index valves_created_by_idx on public.valves (created_by);
create index valves_heat_idx on public.valves (lower(heat_number));
create index valves_serial_idx on public.valves (lower(serial_number));

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  doc_type text not null default 'other',
  title text not null default '',
  file_name text not null,
  mime_type text not null default '',
  byte_size bigint not null default 0,
  storage_path text,
  checksum_sha256 text,
  subject_type text not null default 'project',
  subject_id uuid,
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint documents_file_name_check check (char_length(btrim(file_name)) > 0),
  constraint documents_byte_size_check check (byte_size >= 0),
  constraint documents_doc_type_check check (
    doc_type in (
      'project_attachment',
      'packing_slip',
      'bol',
      'mtr',
      'mtr_request',
      'specification',
      'daily_report',
      'other'
    )
  ),
  constraint documents_checksum_check check (
    checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'
  )
);

create index documents_project_id_idx on public.documents (project_id);
create index documents_created_by_idx on public.documents (created_by);
create index documents_subject_idx on public.documents (subject_type, subject_id);

create table public.mtrs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  document_id uuid references public.documents (id) on delete restrict,
  mtr_number text not null,
  heat_number text not null default '',
  manufacturer text not null default '',
  description text not null default '',
  specification text not null default '',
  grade text not null default '',
  issued_on date,
  paperwork_status text not null default 'on_file',
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint mtrs_number_check check (char_length(btrim(mtr_number)) > 0),
  constraint mtrs_paperwork_check check (
    paperwork_status in ('not_provided', 'on_file', 'missing_documentation')
  ),
  constraint mtrs_project_number_unique unique (project_id, mtr_number)
);

create index mtrs_project_id_idx on public.mtrs (project_id);
create index mtrs_document_id_idx on public.mtrs (document_id);
create index mtrs_created_by_idx on public.mtrs (created_by);
create index mtrs_heat_idx on public.mtrs (lower(heat_number));
create index mtrs_number_idx on public.mtrs (lower(mtr_number));

create table public.material_mtr_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  mtr_id uuid not null references public.mtrs (id) on delete restrict,
  material_id uuid references public.materials (id) on delete restrict,
  pipe_joint_id uuid references public.pipe_joints (id) on delete restrict,
  fitting_id uuid references public.fittings (id) on delete restrict,
  flange_id uuid references public.flanges (id) on delete restrict,
  valve_id uuid references public.valves (id) on delete restrict,
  heat_number_on_item text not null default '',
  heat_number_on_mtr text not null default '',
  verification_status public.verification_status not null default 'not_verified',
  notes text not null default '',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint material_mtr_links_target_check check (
    num_nonnulls(material_id, pipe_joint_id, fitting_id, flange_id, valve_id) >= 1
  )
);

create index material_mtr_links_project_id_idx on public.material_mtr_links (project_id);
create index material_mtr_links_mtr_id_idx on public.material_mtr_links (mtr_id);
create index material_mtr_links_material_id_idx on public.material_mtr_links (material_id);
create index material_mtr_links_pipe_joint_id_idx on public.material_mtr_links (pipe_joint_id);
create index material_mtr_links_fitting_id_idx on public.material_mtr_links (fitting_id);
create index material_mtr_links_flange_id_idx on public.material_mtr_links (flange_id);
create index material_mtr_links_valve_id_idx on public.material_mtr_links (valve_id);
create index material_mtr_links_reviewed_by_idx on public.material_mtr_links (reviewed_by);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  subject_type text not null,
  subject_id uuid not null,
  role text not null default 'other',
  caption text not null default '',
  file_name text not null default '',
  mime_type text not null default '',
  byte_size bigint not null default 0,
  storage_path text,
  captured_at timestamptz,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  gps_status text not null default 'not_requested',
  permission_status text not null default 'not_requested',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint photos_subject_type_check check (
    subject_type in (
      'project',
      'delivery',
      'material',
      'pipe_joint',
      'fitting',
      'flange',
      'valve',
      'mtr',
      'damage_report',
      'discrepancy',
      'installation',
      'document'
    )
  ),
  constraint photos_role_check check (
    role in ('packing_slip', 'bol', 'material', 'damage', 'other')
  ),
  constraint photos_byte_size_check check (byte_size >= 0),
  constraint photos_permission_check check (
    permission_status in ('not_requested', 'granted', 'denied', 'unavailable', 'not_provided')
  ),
  constraint photos_gps_status_check check (
    gps_status in ('not_requested', 'granted', 'denied', 'unavailable', 'not_provided')
  ),
  constraint photos_lat_check check (latitude is null or latitude between -90 and 90),
  constraint photos_lng_check check (longitude is null or longitude between -180 and 180),
  constraint photos_gps_pair_check check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  )
);

create index photos_project_id_idx on public.photos (project_id);
create index photos_created_by_idx on public.photos (created_by);
create index photos_subject_idx on public.photos (subject_type, subject_id);

create table public.material_movements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  material_id uuid references public.materials (id) on delete restrict,
  pipe_joint_id uuid references public.pipe_joints (id) on delete restrict,
  from_location_id uuid references public.locations (id) on delete restrict,
  to_location_id uuid references public.locations (id) on delete restrict,
  quantity numeric(12, 3) not null default 1,
  moved_at timestamptz not null default pg_catalog.now(),
  moved_by uuid references public.profiles (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint material_movements_quantity_check check (quantity >= 0),
  constraint material_movements_target_check check (
    num_nonnulls(material_id, pipe_joint_id) >= 1
  )
);

create index material_movements_project_id_idx on public.material_movements (project_id);
create index material_movements_material_id_idx on public.material_movements (material_id);
create index material_movements_pipe_joint_id_idx on public.material_movements (pipe_joint_id);
create index material_movements_from_location_id_idx on public.material_movements (from_location_id);
create index material_movements_to_location_id_idx on public.material_movements (to_location_id);
create index material_movements_moved_by_idx on public.material_movements (moved_by);

create table public.pipe_cuts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  pipe_joint_id uuid not null references public.pipe_joints (id) on delete restrict,
  cut_at timestamptz not null default pg_catalog.now(),
  length_removed_ft numeric(10, 3) not null,
  remaining_length_ft numeric(10, 3) not null,
  reason text not null default '',
  cut_by uuid references public.profiles (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pipe_cuts_removed_check check (length_removed_ft > 0),
  constraint pipe_cuts_remaining_check check (remaining_length_ft >= 0)
);

create index pipe_cuts_project_id_idx on public.pipe_cuts (project_id);
create index pipe_cuts_pipe_joint_id_idx on public.pipe_cuts (pipe_joint_id);
create index pipe_cuts_cut_by_idx on public.pipe_cuts (cut_by);

create table public.installations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  material_id uuid references public.materials (id) on delete restrict,
  pipe_joint_id uuid references public.pipe_joints (id) on delete restrict,
  fitting_id uuid references public.fittings (id) on delete restrict,
  flange_id uuid references public.flanges (id) on delete restrict,
  valve_id uuid references public.valves (id) on delete restrict,
  location_id uuid references public.locations (id) on delete restrict,
  installed_at timestamptz not null default pg_catalog.now(),
  station text not null default '',
  installed_by uuid references public.profiles (id) on delete set null,
  weld_number text not null default '',
  notes text not null default '',
  verification_status public.verification_status not null default 'not_verified',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint installations_target_check check (
    num_nonnulls(material_id, pipe_joint_id, fitting_id, flange_id, valve_id) >= 1
  )
);

create index installations_project_id_idx on public.installations (project_id);
create index installations_material_id_idx on public.installations (material_id);
create index installations_pipe_joint_id_idx on public.installations (pipe_joint_id);
create index installations_fitting_id_idx on public.installations (fitting_id);
create index installations_flange_id_idx on public.installations (flange_id);
create index installations_valve_id_idx on public.installations (valve_id);
create index installations_location_id_idx on public.installations (location_id);
create index installations_installed_by_idx on public.installations (installed_by);

create table public.damage_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  material_id uuid references public.materials (id) on delete restrict,
  pipe_joint_id uuid references public.pipe_joints (id) on delete restrict,
  delivery_id uuid references public.deliveries (id) on delete restrict,
  reported_at timestamptz not null default pg_catalog.now(),
  description text not null,
  severity text not null default 'unknown',
  status text not null default 'open',
  closed_at timestamptz,
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint damage_reports_description_check check (char_length(btrim(description)) > 0),
  constraint damage_reports_severity_check check (severity in ('minor', 'major', 'unknown')),
  constraint damage_reports_status_check check (status in ('open', 'closed')),
  constraint damage_reports_target_check check (
    num_nonnulls(material_id, pipe_joint_id, delivery_id) >= 1
  ),
  constraint damage_reports_closed_check check (
    (status = 'open' and closed_at is null)
    or (status = 'closed' and closed_at is not null)
  )
);

create index damage_reports_project_id_idx on public.damage_reports (project_id);
create index damage_reports_material_id_idx on public.damage_reports (material_id);
create index damage_reports_pipe_joint_id_idx on public.damage_reports (pipe_joint_id);
create index damage_reports_delivery_id_idx on public.damage_reports (delivery_id);
create index damage_reports_created_by_idx on public.damage_reports (created_by);
create index damage_reports_open_idx on public.damage_reports (project_id) where status = 'open';

create table public.holds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  material_id uuid references public.materials (id) on delete restrict,
  pipe_joint_id uuid references public.pipe_joints (id) on delete restrict,
  fitting_id uuid references public.fittings (id) on delete restrict,
  flange_id uuid references public.flanges (id) on delete restrict,
  valve_id uuid references public.valves (id) on delete restrict,
  reason text not null,
  status text not null default 'open',
  held_at timestamptz not null default pg_catalog.now(),
  released_at timestamptz,
  released_by uuid references public.profiles (id) on delete set null,
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint holds_reason_check check (char_length(btrim(reason)) > 0),
  constraint holds_status_check check (status in ('open', 'released')),
  constraint holds_target_check check (
    num_nonnulls(material_id, pipe_joint_id, fitting_id, flange_id, valve_id) >= 1
  ),
  constraint holds_released_check check (
    (status = 'open' and released_at is null)
    or (status = 'released' and released_at is not null)
  )
);

create index holds_project_id_idx on public.holds (project_id);
create index holds_material_id_idx on public.holds (material_id);
create index holds_pipe_joint_id_idx on public.holds (pipe_joint_id);
create index holds_fitting_id_idx on public.holds (fitting_id);
create index holds_flange_id_idx on public.holds (flange_id);
create index holds_valve_id_idx on public.holds (valve_id);
create index holds_released_by_idx on public.holds (released_by);
create index holds_created_by_idx on public.holds (created_by);
create index holds_open_idx on public.holds (project_id) where status = 'open';

create table public.discrepancies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  material_id uuid references public.materials (id) on delete restrict,
  delivery_id uuid references public.deliveries (id) on delete restrict,
  mtr_id uuid references public.mtrs (id) on delete restrict,
  material_mtr_link_id uuid references public.material_mtr_links (id) on delete restrict,
  title text not null,
  description text not null,
  status text not null default 'open',
  verification_status public.verification_status not null default 'difference_found',
  opened_at timestamptz not null default pg_catalog.now(),
  resolved_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint discrepancies_title_check check (char_length(btrim(title)) > 0),
  constraint discrepancies_description_check check (char_length(btrim(description)) > 0),
  constraint discrepancies_status_check check (status in ('open', 'resolved')),
  constraint discrepancies_resolved_check check (
    (status = 'open' and resolved_at is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create index discrepancies_project_id_idx on public.discrepancies (project_id);
create index discrepancies_material_id_idx on public.discrepancies (material_id);
create index discrepancies_delivery_id_idx on public.discrepancies (delivery_id);
create index discrepancies_mtr_id_idx on public.discrepancies (mtr_id);
create index discrepancies_link_id_idx on public.discrepancies (material_mtr_link_id);
create index discrepancies_created_by_idx on public.discrepancies (created_by);
create index discrepancies_open_idx on public.discrepancies (project_id) where status = 'open';

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  report_date date not null,
  inspector_name text not null default '',
  summary text not null default '',
  weather text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index daily_reports_project_date_idx on public.daily_reports (project_id, report_date);
create index daily_reports_created_by_idx on public.daily_reports (created_by);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  constraint audit_logs_action_check check (char_length(btrim(action)) > 0),
  constraint audit_logs_entity_type_check check (char_length(btrim(entity_type)) > 0),
  constraint audit_logs_payload_object_check check (jsonb_typeof(payload) = 'object')
);

comment on table public.audit_logs is
  'Append-only. Updates, deletes, and truncates are rejected.';

create index audit_logs_project_created_idx on public.audit_logs (project_id, created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function private.protect_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end;
$$;

create or replace function private.protect_project_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

create or replace function private.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = (select auth.uid())
      and pm.role in ('owner', 'inspector')
  );
$$;

create or replace function private.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = (select auth.uid())
      and pm.role = 'owner'
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

comment on function private.handle_new_user() is
  'Copies display_name for presentation only. raw_user_meta_data is never used for authorization.';

create or replace function private.add_project_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := coalesce((select auth.uid()), new.created_by);
begin
  if v_user is not null then
    insert into public.project_members (project_id, user_id, role)
    values (new.id, v_user, 'owner')
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_project uuid;
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_row := pg_catalog.to_jsonb(old);
  else
    v_row := pg_catalog.to_jsonb(new);
  end if;

  v_project := nullif(v_row ->> 'project_id', '')::uuid;
  if v_project is null and tg_table_name = 'projects' then
    v_project := nullif(v_row ->> 'id', '')::uuid;
  end if;
  v_id := nullif(v_row ->> 'id', '')::uuid;

  insert into public.audit_logs (project_id, actor_id, action, entity_type, entity_id, payload)
  values (v_project, (select auth.uid()), lower(tg_op), tg_table_name, v_id, v_row);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function private.write_audit_log() is
  'Security definer so the audit insert is not blocked by RLS. Owner is the migration role (Supabase postgres), which bypasses RLS.';

create or replace function private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.protect_profile_identity() from public, anon, authenticated;
revoke all on function private.protect_project_creator() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.add_project_owner() from public, anon, authenticated;
revoke all on function private.write_audit_log() from public, anon, authenticated;
revoke all on function private.reject_audit_mutation() from public, anon, authenticated;
revoke all on function private.is_project_member(uuid) from public, anon, authenticated;
revoke all on function private.can_edit_project(uuid) from public, anon, authenticated;
revoke all on function private.is_project_owner(uuid) from public, anon, authenticated;

grant execute on function private.is_project_member(uuid) to authenticated;
grant execute on function private.can_edit_project(uuid) to authenticated;
grant execute on function private.is_project_owner(uuid) to authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create trigger profiles_protect_identity
before update on public.profiles
for each row execute function private.protect_profile_identity();

create trigger profiles_audit
after insert or update or delete on public.profiles
for each row execute function private.write_audit_log();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function private.touch_updated_at();

create trigger projects_protect_creator
before update on public.projects
for each row execute function private.protect_project_creator();

create trigger projects_add_owner
after insert on public.projects
for each row execute function private.add_project_owner();

create trigger projects_audit
after insert or update or delete on public.projects
for each row execute function private.write_audit_log();

create trigger project_members_set_updated_at
before update on public.project_members
for each row execute function private.touch_updated_at();

create trigger project_members_audit
after insert or update or delete on public.project_members
for each row execute function private.write_audit_log();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger audit_logs_no_update
before update on public.audit_logs
for each row execute function private.reject_audit_mutation();

create trigger audit_logs_no_delete
before delete on public.audit_logs
for each row execute function private.reject_audit_mutation();

create trigger audit_logs_no_truncate
before truncate on public.audit_logs
for each statement execute function private.reject_audit_mutation();

do $$
declare
  t text;
  project_tables text[] := array[
    'locations',
    'purchase_orders',
    'deliveries',
    'materials',
    'pipe_joints',
    'fittings',
    'flanges',
    'valves',
    'documents',
    'mtrs',
    'material_mtr_links',
    'photos',
    'material_movements',
    'pipe_cuts',
    'installations',
    'damage_reports',
    'holds',
    'discrepancies',
    'daily_reports'
  ];
begin
  foreach t in array project_tables loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.touch_updated_at()',
      t || '_set_updated_at',
      t
    );
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.write_audit_log()',
      t || '_audit',
      t
    );
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant insert, update on table public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_project_member(project_id)))',
      t || '_select',
      t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.can_edit_project(project_id)))',
      t || '_insert',
      t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.can_edit_project(project_id))) with check ((select private.can_edit_project(project_id)))',
      t || '_update',
      t
    );
  end loop;
end
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.project_members enable row level security;
alter table public.project_members force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.projects from public, anon, authenticated;
revoke all on table public.project_members from public, anon, authenticated;
revoke all on table public.audit_logs from public, anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.projects to authenticated;
grant select, insert, update on table public.project_members to authenticated;
grant select, insert on table public.audit_logs to authenticated;

create policy profiles_select_self on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy profiles_select_teammates on public.profiles
for select to authenticated
using (
  exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = profiles.id
  )
);

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy projects_select on public.projects
for select to authenticated
using (
  (select private.is_project_member(id))
  or created_by = (select auth.uid())
);

create policy projects_insert on public.projects
for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (created_by is null or created_by = (select auth.uid()))
);

create policy projects_update on public.projects
for update to authenticated
using ((select private.can_edit_project(id)))
with check ((select private.can_edit_project(id)));

create policy project_members_select on public.project_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_project_member(project_id))
);

create policy project_members_insert on public.project_members
for insert to authenticated
with check ((select private.is_project_owner(project_id)));

create policy project_members_update on public.project_members
for update to authenticated
using ((select private.is_project_owner(project_id)))
with check ((select private.is_project_owner(project_id)));

create policy audit_logs_select on public.audit_logs
for select to authenticated
using (
  project_id is null
  or (select private.is_project_member(project_id))
);

create policy audit_logs_insert on public.audit_logs
for insert to authenticated
with check (
  (actor_id is null or actor_id = (select auth.uid()))
  and (
    project_id is null
    or (select private.is_project_member(project_id))
  )
);

-- No UPDATE or DELETE policy exists on audit_logs.
-- anon has no policies on any table in this migration.
