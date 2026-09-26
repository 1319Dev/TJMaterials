import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildDemoData } from '../domain/demo-data';
import { GRADE_MISMATCH_MESSAGE, gradeReview, normalizeGrade } from '../domain/grades';
import { ensurePhase2 } from '../domain/hydrate';
import { createReceipt, emptyReceiveLine, type ReceiveInput } from '../domain/receive';
import { saveFitting, saveFlange, saveValve, fittingInputFrom } from '../domain/specialty';
import { formatFeet, savePipeJoint, tallyToCsv, tallyToExcel, tallyTotals, blankPipeJointInput } from '../domain/tally';
import type { AppSnapshot } from '../domain/types';

const today = '2026-09-26';
const demo = buildDemoData(today);

function ids() {
  let n = 0;
  return () => `20000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

const ctx = () => ({ now: new Date(`${today}T18:00:00.000Z`), newId: ids() });

describe('pipe tally', () => {
  test('totals the demo joints and keeps expected footage separate', () => {
    const totals = tallyTotals(demo.pipeJoints);
    expect(totals.jointCount).toBe(4);
    expect(formatFeet(totals.totalFootage)).toBe('159.625');
    expect(formatFeet(totals.averageLength ?? 0)).toBe('39.906');
    expect(formatFeet(totals.expectedFootage)).toBe('200.000');
    expect(formatFeet(totals.receivedFootage)).toBe('159.625');
    expect(formatFeet(totals.footageDifference)).toBe('-40.375');
    expect(totals.byHeat.map((bucket) => [bucket.label, formatFeet(bucket.footage), bucket.jointCount])).toEqual([
      ['H52-18440', '80.000', 2],
      ['H52-18441', '41.125', 1],
      ['H52-19002', '38.500', 1],
    ]);
    expect(totals.byGrade).toEqual([{ label: 'X52', jointCount: 4, footage: 159.625 }]);
    expect(totals.byWall).toEqual([{ label: '0.500', jointCount: 4, footage: 159.625 }]);
    expect(demo.pipeJoints.find((joint) => joint.jointNumber === 'J-1110')?.lengthFt).toBeNull();
  });

  test('adds a joint as review required and rejects a duplicate or a blank length', () => {
    const added = savePipeJoint(
      demo,
      {
        ...blankPipeJointInput(),
        jointNumber: 'J-2000',
        heatNumber: 'H52-18440',
        lengthFt: '40',
        diameter: '36',
        wallThickness: '0.500',
        grade: 'X52',
      },
      ctx(),
    );
    expect(added.errors).toEqual([]);
    expect(added.materialCode).toBe('PMI-PIPE-000006');
    const joint = added.snapshot.pipeJoints.find((item) => item.jointNumber === 'J-2000');
    expect(joint?.verificationStatus).toBe('review_required');
    expect(joint?.heatNumber).toBe('H52-18440');
    expect(tallyTotals(added.snapshot.pipeJoints).jointCount).toBe(5);
    expect(formatFeet(tallyTotals(added.snapshot.pipeJoints).totalFootage)).toBe('199.625');
    expect(added.snapshot.materials.find((material) => material.materialCode === 'PMI-PIPE-000006')?.verificationStatus).toBe(
      'review_required',
    );

    const duplicate = savePipeJoint(demo, { ...blankPipeJointInput(), jointNumber: 'J-1041', lengthFt: '10' }, ctx());
    expect(duplicate.errors.join(' ')).toMatch(/already on the pipe tally/);
    expect(duplicate.snapshot).toBe(demo);

    const missing = savePipeJoint(demo, { ...blankPipeJointInput(), jointNumber: 'J-2001', lengthFt: ' ' }, ctx());
    expect(missing.errors.join(' ')).toMatch(/not estimated/);
    expect(missing.snapshot).toBe(demo);
  });

  test('exports csv and excel without treating the tally as acceptance', () => {
    const csv = tallyToCsv(demo.pipeJoints);
    const excel = tallyToExcel(demo.pipeJoints);
    expect(csv).toContain('J-1041');
    expect(csv).toContain('159.625');
    expect(csv).toContain('Footage by heat');
    expect(csv).toContain('REVIEW REQUIRED');
    expect(excel).toContain('ss:Name="Joints"');
    expect(excel).toContain('ss:Name="Totals"');
    expect(excel).toContain('J-1110');
    expect(excel).toContain('159.625');
    expect(`${csv}\n${excel}`).not.toMatch(/acceptable/i);
  });
});

describe('grades and component forms', () => {
  test('treats WPHY spacing as the same grade and flags 52 against 70', () => {
    expect(normalizeGrade('WPHY 52')).toBe('WPHY52');
    expect(gradeReview('WPHY 52', 'WPHY52')).toBeNull();
    expect(gradeReview('WPHY-52', 'wphy 52')).toBeNull();
    expect(gradeReview('WPHY 52', '')).toBeNull();
    expect(gradeReview('', 'WPHY 70')).toBeNull();
    expect(gradeReview('WPHY 52', 'WPHY 70')).toBe(GRADE_MISMATCH_MESSAGE);
    const fitting = demo.fittings.find((item) => item.materialCode === 'PMI-FIT-000004');
    expect(gradeReview(fitting?.expectedGrade ?? '', fitting?.grade ?? '')).toBe(GRADE_MISMATCH_MESSAGE);
    expect(demo.materials.some((material) => material.verificationStatus === 'match')).toBe(false);
    expect(demo.fittings.some((item) => item.verificationStatus === 'match')).toBe(false);
  });

  test('saves a cap, a class 1500 flange, and a linked actuator without matching them', () => {
    const deliveryId = demo.deliveries[0]?.id ?? null;
    const fitting = saveFitting(
      demo,
      {
        fittingType: 'cap',
        description: '36" cap',
        diameter: '36',
        wallThickness: '0.500',
        grade: 'WPHY 70',
        expectedGrade: 'WPHY 52',
        specification: 'ASTM A860 / MSS SP-75',
        manufacturer: 'Redcedar Fittings Co.',
        heatNumber: '',
        angleDeg: '',
        quantity: '2',
        custodyStatus: 'received',
        notes: '',
        deliveryId,
        purchaseOrderId: null,
      },
      ctx(),
    );
    expect(fitting.errors).toEqual([]);
    expect(fitting.materialCode).toBe('PMI-FIT-000005');
    const stored = fitting.snapshot.fittings.find((item) => item.id === fitting.id);
    expect(stored?.fittingType).toBe('cap');
    expect(stored?.verificationStatus).toBe('review_required');
    expect(gradeReview(stored?.expectedGrade ?? '', stored?.grade ?? '')).toBe(GRADE_MISMATCH_MESSAGE);
    expect(fitting.snapshot.auditLogs.at(-1)?.summary).toContain(GRADE_MISMATCH_MESSAGE);

    const blocked = saveFitting(
      demo,
      {
        fittingType: 'cap',
        description: '36" cap',
        diameter: '36',
        wallThickness: '',
        grade: '',
        expectedGrade: '',
        specification: '',
        manufacturer: '',
        heatNumber: '',
        angleDeg: '',
        quantity: '1',
        custodyStatus: 'received',
        notes: '',
        deliveryId: null,
        purchaseOrderId: null,
      },
      ctx(),
    );
    expect(blocked.errors.join(' ')).toMatch(/BOL/);
    expect(blocked.snapshot).toBe(demo);

    const tee = demo.fittings.find((item) => item.materialCode === 'PMI-FIT-000002');
    const kept = saveFitting(demo, fittingInputFrom(tee!), ctx());
    expect(kept.snapshot.fittings.find((item) => item.id === tee?.id)?.verificationStatus).toBe('missing_documentation');

    const flange = saveFlange(
      demo,
      {
        flangeType: 'blind',
        description: '24" blind flange',
        diameter: '24',
        classRating: '1500',
        grade: 'A694 F52',
        expectedGrade: 'A694 F52',
        facing: '',
        manufacturer: '',
        heatNumber: '',
        serialOrLot: '',
        quantity: '1',
        custodyStatus: 'received',
        notes: '',
        deliveryId,
        purchaseOrderId: null,
      },
      ctx(),
    );
    expect(flange.errors).toEqual([]);
    expect(flange.snapshot.flanges.find((item) => item.id === flange.id)?.classRating).toBe('1500');
    expect(flange.snapshot.flanges.find((item) => item.id === flange.id)?.verificationStatus).toBe('review_required');

    const rejected = saveFlange(
      demo,
      {
        flangeType: 'wn',
        description: 'Odd class',
        diameter: '36',
        classRating: '2500',
        grade: '',
        expectedGrade: '',
        facing: '',
        manufacturer: '',
        heatNumber: '',
        serialOrLot: '',
        quantity: '1',
        custodyStatus: 'received',
        notes: '',
        deliveryId,
        purchaseOrderId: null,
      },
      ctx(),
    );
    expect(rejected.errors.join(' ')).toMatch(/1500/);
    expect(rejected.snapshot).toBe(demo);

    const valve = saveValve(
      demo,
      {
        valveType: 'gate',
        description: '12" gate valve',
        diameter: '12',
        classRating: '300',
        grade: 'WCB',
        expectedGrade: 'WCB',
        manufacturer: 'Calder Valve Works',
        modelNumber: 'GV-12',
        heatNumber: '',
        serialNumber: 'GV-12-1',
        actuatorType: 'electric',
        actuatorManufacturer: 'Fieldline Actuators',
        actuatorModel: 'EA-12',
        actuatorSerial: 'ACT-100',
        quantity: '1',
        custodyStatus: 'received',
        notes: '',
        deliveryId,
        purchaseOrderId: null,
      },
      ctx(),
    );
    expect(valve.errors).toEqual([]);
    const storedValve = valve.snapshot.valves.find((item) => item.id === valve.id);
    expect(storedValve?.actuatorSerial).toBe('ACT-100');
    expect(storedValve?.verificationStatus).toBe('review_required');
    expect(valve.snapshot.materials.find((material) => material.materialCode === valve.materialCode)?.serialOrLot).toBe('GV-12-1');
  });
});

describe('phase 2 wiring', () => {
  test('a pipe line on a receipt becomes a tally joint without a guessed length', () => {
    const input: ReceiveInput = {
      receivedOn: today,
      vendor: 'Northline Pipe Supply',
      inspectorName: 'Alex Rivera',
      shipmentNumberMrc: '',
      salesOrderOrCustomerPo: '',
      packingSlipNumber: 'PS-TALLY-1',
      bolNumber: '',
      carrier: '',
      poNumber: '',
      notes: '',
      lines: [
        {
          ...emptyReceiveLine(),
          description: '36" line pipe',
          jointNumber: 'J-3001',
          heatNumber: 'H52-3001',
          quantity: '1',
        },
      ],
      photoStubs: [],
      gps: null,
      documents: [],
    };
    const result = createReceipt(demo, input, ctx());
    expect(result.errors).toEqual([]);
    const joint = result.snapshot.pipeJoints.find((item) => item.jointNumber === 'J-3001');
    expect(joint?.lengthFt).toBeNull();
    expect(joint?.expectedLengthFt).toBeNull();
    expect(joint?.heatNumber).toBe('H52-3001');
    expect(joint?.verificationStatus).toBe('review_required');
    expect(result.snapshot.queue.some((item) => item.entityType === 'pipe_joints')).toBe(true);

    const clash = createReceipt(result.snapshot, input, ctx());
    expect(clash.errors.join(' ')).toMatch(/already on the pipe tally/);
    expect(clash.snapshot).toBe(result.snapshot);
  });

  test('backfills detail rows onto a phase 1 guest snapshot and leaves a finished snapshot alone', () => {
    expect(ensurePhase2(demo, today)).toBe(demo);
    const legacy = {
      ...demo,
      materials: demo.materials.filter((material) => material.materialCode !== 'PMI-FIT-000004'),
    } as AppSnapshot;
    delete (legacy as Partial<AppSnapshot>).pipeJoints;
    delete (legacy as Partial<AppSnapshot>).fittings;
    delete (legacy as Partial<AppSnapshot>).flanges;
    delete (legacy as Partial<AppSnapshot>).valves;
    const filled = ensurePhase2(legacy, today);
    expect(filled.pipeJoints.map((joint) => joint.jointNumber).sort()).toEqual([
      'J-1041',
      'J-1042',
      'J-1043',
      'J-1108',
      'J-1110',
    ]);
    expect(filled.fittings.some((item) => item.expectedGrade === 'WPHY 52' && item.grade === 'WPHY 70')).toBe(true);
    expect(filled.valves.some((item) => item.actuatorSerial === 'ACT-88321')).toBe(true);
    expect(filled.flanges.every((item) => ['150', '300', '400', '600', '900', '1500'].includes(item.classRating))).toBe(
      true,
    );
  });

  test('migration stores expected grade, expected length, and actuator fields', () => {
    const sql = readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20260926210000_phase2_expected_and_actuators.sql'),
      'utf8',
    );
    expect(sql).toContain('expected_length_ft');
    expect(sql).toContain('expected_grade');
    expect(sql).toContain('actuator_serial');
    expect(sql).not.toMatch(/default 'match'/);
  });
});
