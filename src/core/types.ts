export type Cohort = {
  readonly count: number;
};

export type Snapshot = {
  readonly capacity: number;
  readonly cohorts: readonly Cohort[];
  readonly total: number;
};

export type Op = 'create' | 'add' | 'take' | 'reset';

export type LogEntry = {
  readonly op: Op;
  readonly n: number;
  readonly at: number;
};

/**
 * Result of a take operation. Discriminated so callers (UI, telemetry, callers
 * in tests) can handle the clamp case without re-deriving it from the input.
 *
 * - `served`  — every requested creator was taken.
 * - `partial` — fewer than requested were available; we took what was there
 *                (including the case where 0 were available — empty queue).
 * - `noop`    — caller requested 0; nothing was taken, nothing was wrong.
 */
export type TakeResult =
  | { readonly kind: 'served'; readonly taken: number }
  | { readonly kind: 'partial'; readonly requested: number; readonly taken: number }
  | { readonly kind: 'noop' };
