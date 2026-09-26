-- Phase 2 fields used by the pipe tally and the fitting, flange, and valve forms.
-- An expected grade or length is an inspector record. A mismatch is a review flag, not an acceptance.

alter table public.pipe_joints
  add column expected_length_ft numeric(10, 3),
  add constraint pipe_joints_expected_length_check check (expected_length_ft is null or expected_length_ft >= 0);

alter table public.fittings
  add column expected_grade text not null default '';

alter table public.flanges
  add column expected_grade text not null default '';

alter table public.valves
  add column expected_grade text not null default '',
  add column actuator_type text not null default '',
  add column actuator_manufacturer text not null default '',
  add column actuator_model text not null default '',
  add column actuator_serial text not null default '';

comment on column public.fittings.expected_grade is
  'Grade the order or specification called for. A mismatch with grade is a review flag, not an acceptance.';

comment on column public.pipe_joints.expected_length_ft is
  'Length from the shipping or mill tally. Blank means it was not provided.';

comment on column public.valves.actuator_serial is
  'Actuator linked to this valve. Blank means no actuator was recorded.';
