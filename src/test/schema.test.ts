import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const sql = readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260926195914_initial_inspection_schema.sql'),
  'utf8',
);

const tables = [
  'profiles',
  'projects',
  'project_members',
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
  'daily_reports',
  'audit_logs',
];

describe('initial schema', () => {
  test('creates every requested table with a uuid primary key', () => {
    for (const table of tables) {
      expect(sql).toContain(`create table public.${table} (`);
    }
    expect(sql).toContain('id uuid primary key default gen_random_uuid()');
    expect(sql).toContain('id uuid primary key references auth.users (id) on delete cascade');
  });

  test('enables and forces row level security', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    for (const table of ['profiles', 'projects', 'project_members', 'audit_logs']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
    }
  });

  test('keeps audit logs append-only', () => {
    expect(sql).toContain("raise exception 'audit_logs is append-only'");
    expect(sql).toContain('before update on public.audit_logs');
    expect(sql).toContain('before delete on public.audit_logs');
    expect(sql).toContain('before truncate on public.audit_logs');
    expect(sql).toContain('grant select, insert on table public.audit_logs to authenticated');
    expect(sql).not.toContain('create policy audit_logs_update');
    expect(sql).not.toContain('create policy audit_logs_delete');
    expect(sql).not.toContain('grant update, delete on table public.audit_logs');
  });

  test('stores the MTR request and bill of materials labels', () => {
    expect(sql).toContain('atmos_project_number');
    expect(sql).toContain('shipment_number_mrc');
    expect(sql).toContain('sales_order_or_customer_po');
    expect(sql).toContain('construction_order_no');
    expect(sql).toContain('packing_slip_number');
    expect(sql).toContain('bol_number');
  });

  test('lists the verification vocabulary and does not default material to match', () => {
    for (const status of [
      'match',
      'difference_found',
      'review_required',
      'not_provided',
      'not_verified',
      'missing_documentation',
    ]) {
      expect(sql).toContain(`'${status}'`);
    }
    expect(sql).toContain("verification_status public.verification_status not null default 'not_verified'");
    expect(sql).not.toMatch(/default 'match'/);
    expect(sql).not.toMatch(/acceptable/i);
  });
});
