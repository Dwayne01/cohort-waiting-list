import type { Snapshot, LogEntry } from '../core';

export const STORAGE_KEY = 'cohort-waitlist:v1';
export const SCHEMA_VERSION = 1 as const;

export type Persisted = {
  version: typeof SCHEMA_VERSION;
  snapshot: Snapshot;
  log: LogEntry[];
};

export function isPersisted(value: unknown): value is Persisted {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v['version'] !== SCHEMA_VERSION) return false;

  const snap = v['snapshot'] as Record<string, unknown> | undefined;
  if (!snap) return false;

  const capacity = snap['capacity'];
  if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1) return false;

  const totalField = snap['total'];
  if (typeof totalField !== 'number' || !Number.isInteger(totalField) || totalField < 0) return false;

  if (!Array.isArray(snap['cohorts'])) return false;

  let total = 0;
  for (const c of snap['cohorts'] as unknown[]) {
    if (typeof c !== 'object' || c === null) return false;
    const count = (c as Record<string, unknown>)['count'];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > capacity) return false;
    total += count;
  }
  if (total !== totalField) return false;

  if (!Array.isArray(v['log'])) return false;
  for (const e of v['log']) {
    if (typeof e !== 'object' || e === null) return false;
    const entry = e as Record<string, unknown>;
    if (!['create', 'add', 'take', 'reset'].includes(entry['op'] as string)) return false;
    if (typeof entry['n'] !== 'number') return false;
    if (typeof entry['at'] !== 'number') return false;
  }

  return true;
}
