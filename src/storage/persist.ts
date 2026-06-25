import type { Snapshot } from '../core';
import { STORAGE_KEY, SCHEMA_VERSION, isPersisted, type PersistedOnboardingEvent } from './schema';

export function isStorageAvailable(): boolean {
  try {
    const probe = '__cohort_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function load(): {
  snapshot: Snapshot;
  colorSeqs: readonly number[];
  onboardings: readonly PersistedOnboardingEvent[];
} | null {
  if (!isStorageAvailable()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPersisted(parsed)) return null;

  return {
    snapshot: parsed.snapshot,
    colorSeqs: parsed.colorSeqs,
    onboardings: parsed.onboardings,
  };
}

export function save(payload: {
  snapshot: Snapshot;
  colorSeqs: readonly number[];
  onboardings: readonly PersistedOnboardingEvent[];
}): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, ...payload }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearStorage(): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
