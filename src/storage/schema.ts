import type { Snapshot } from '../core';

export const STORAGE_KEY = 'cohort-waitlist:v2';
export const SCHEMA_VERSION = 2 as const;

export type Persisted = {
  version: typeof SCHEMA_VERSION;
  snapshot: Snapshot;
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

  return true;
}
