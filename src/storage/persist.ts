import type { Snapshot, LogEntry } from '../core';
import { STORAGE_KEY, SCHEMA_VERSION, isPersisted } from './schema';

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

export function load(): { snapshot: Snapshot; log: LogEntry[] } | null {
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

  return { snapshot: parsed.snapshot, log: parsed.log };
}

export function save(snapshot: Snapshot, log: LogEntry[]): boolean {
  if (!isStorageAvailable()) return false;

  const payload: { version: typeof SCHEMA_VERSION; snapshot: Snapshot; log: LogEntry[] } = {
    version: SCHEMA_VERSION,
    snapshot,
    log,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
