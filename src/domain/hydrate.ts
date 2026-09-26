import { buildDemoData } from './demo-data';
import { localIsoDate } from './dates';
import { normalizeSettings } from './empty';
import type { AppSnapshot } from './types';

function hasPhase2(snapshot: AppSnapshot): boolean {
  const raw = snapshot as Partial<AppSnapshot>;
  return (
    Array.isArray(raw.pipeJoints) &&
    Array.isArray(raw.fittings) &&
    Array.isArray(raw.flanges) &&
    Array.isArray(raw.valves)
  );
}

function mergeById<T extends { id: string }>(current: readonly T[], extras: readonly T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...extras.filter((item) => !seen.has(item.id))];
}

export function ensurePhase2(snapshot: AppSnapshot, today = localIsoDate()): AppSnapshot {
  if (hasPhase2(snapshot) && snapshot.settings.sample !== undefined && snapshot.settings.accountEmail !== undefined) {
    return snapshot;
  }
  const withSettings = { ...snapshot, settings: normalizeSettings(snapshot.settings) };
  if (hasPhase2(withSettings)) return withSettings;
  const raw = withSettings as Partial<AppSnapshot>;
  const demo = buildDemoData(today);
  if (withSettings.project.id !== demo.project.id) {
    return {
      ...withSettings,
      pipeJoints: raw.pipeJoints ?? [],
      fittings: raw.fittings ?? [],
      flanges: raw.flanges ?? [],
      valves: raw.valves ?? [],
    };
  }
  return {
    ...withSettings,
    materials: mergeById(snapshot.materials, demo.materials),
    pipeJoints: raw.pipeJoints ?? demo.pipeJoints,
    fittings: raw.fittings ?? demo.fittings,
    flanges: raw.flanges ?? demo.flanges,
    valves: raw.valves ?? demo.valves,
    discrepancies: mergeById(snapshot.discrepancies, demo.discrepancies),
    auditLogs: mergeById(snapshot.auditLogs, demo.auditLogs),
  };
}
