import type { Snapshot } from '../core';

export const STORAGE_KEY = 'cohort-waitlist:v3';
export const SCHEMA_VERSION = 3 as const;

export type PersistedOnboardingGroup = {
  readonly color: { readonly base: string; readonly ring: string; readonly tint: string };
  readonly count: number;
};

export type PersistedOnboardingEvent = {
  readonly id: string;
  readonly at: number;
  readonly taken: number;
  readonly groups: readonly PersistedOnboardingGroup[];
};

export type Persisted = {
  readonly version: typeof SCHEMA_VERSION;
  readonly snapshot: Snapshot;
  readonly colorSeqs: readonly number[];
  readonly onboardings: readonly PersistedOnboardingEvent[];
};

function isColor(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return typeof c['base'] === 'string' && typeof c['ring'] === 'string' && typeof c['tint'] === 'string';
}

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

  if (!Array.isArray(v['colorSeqs'])) return false;
  if ((v['colorSeqs'] as unknown[]).length !== (snap['cohorts'] as unknown[]).length) return false;
  for (const s of v['colorSeqs'] as unknown[]) {
    if (typeof s !== 'number' || !Number.isInteger(s) || s < 0) return false;
  }

  if (!Array.isArray(v['onboardings'])) return false;
  for (const e of v['onboardings']) {
    if (typeof e !== 'object' || e === null) return false;
    const ev = e as Record<string, unknown>;
    if (typeof ev['id'] !== 'string') return false;
    if (typeof ev['at'] !== 'number') return false;
    if (typeof ev['taken'] !== 'number') return false;
    if (!Array.isArray(ev['groups'])) return false;
    for (const g of ev['groups']) {
      if (typeof g !== 'object' || g === null) return false;
      const gr = g as Record<string, unknown>;
      if (typeof gr['count'] !== 'number') return false;
      if (!isColor(gr['color'])) return false;
    }
  }

  return true;
}
