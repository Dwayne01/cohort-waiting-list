import { useEffect, useRef, useState } from 'react';
import {
  WaitingList,
  type Snapshot,
  type Op,
  type Cohort,
  type TakeResult,
  InvalidCapacityError,
  InvalidCountError,
  NonIntegerCountError,
} from '../../core';
import { isStorageAvailable, load, save } from '../../storage/persist';
import { colorFor, type CohortColor } from '../palette';

export type OnboardingEvent = {
  readonly id: string;
  readonly at: number;
  readonly taken: number;
  readonly groups: ReadonlyArray<{ readonly color: CohortColor; readonly count: number }>;
};

const ONBOARDING_LIMIT = 8;

type State =
  | { kind: 'uninitialized' }
  | {
      kind: 'ready';
      snapshot: Snapshot;
      ids: string[];
      colorSeqs: number[];     // parallel to cohorts; index into palette via colorFor()
    };

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  return `c${idCounter}`;
}

let colorCounter = 0;
function nextColorSeq(): number {
  const seq = colorCounter;
  colorCounter += 1;
  return seq;
}

function rebuildFromSnapshot(snapshot: Snapshot): WaitingList {
  const wl = new WaitingList(snapshot.capacity);
  for (const cohort of [...snapshot.cohorts].reverse()) {
    wl.add(cohort.count);
  }
  return wl;
}

/**
 * Compute the next per-cohort ID array given the operation and the snapshots
 * before and after. Same algorithm as before, also applied to color seqs.
 */
function diffPositions<T>(
  prev: T[],
  op: Op,
  prevCohorts: readonly Cohort[],
  newCohorts: readonly Cohort[],
  makeNew: () => T,
): T[] {
  if (op === 'create' || op === 'reset') return newCohorts.map(() => makeNew());
  if (op === 'add') {
    const prepended = Math.max(0, newCohorts.length - prevCohorts.length);
    const fresh = Array.from({ length: prepended }, () => makeNew());
    return [...fresh, ...prev];
  }
  if (op === 'take') {
    const popped = Math.max(0, prevCohorts.length - newCohorts.length);
    return prev.slice(0, prev.length - popped);
  }
  return prev;
}

export function useWaitingList() {
  const ref = useRef<WaitingList | null>(null);
  const persisting = useRef<boolean>(isStorageAvailable()).current;

  const [state, setState] = useState<State>(() => {
    if (!persisting) return { kind: 'uninitialized' };
    const restored = load();
    if (!restored) return { kind: 'uninitialized' };
    // Restore counters past the highest seen seq so new cohorts continue.
    const maxSeq = restored.colorSeqs.reduce((m, s) => Math.max(m, s), -1);
    colorCounter = Math.max(colorCounter, maxSeq + 1);
    return {
      kind: 'ready',
      snapshot: restored.snapshot,
      ids: restored.snapshot.cohorts.map(() => makeId()),
      colorSeqs: restored.colorSeqs.slice(),
    };
  });

  const [onboardings, setOnboardings] = useState<OnboardingEvent[]>(() => {
    if (!persisting) return [];
    const restored = load();
    return restored ? [...restored.onboardings] : [];
  });

  useEffect(() => {
    if (state.kind === 'ready' && ref.current === null) {
      ref.current = rebuildFromSnapshot(state.snapshot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [lastError, setLastError] = useState<string | null>(null);

  function publish(op: Op, takeBefore?: { snapshot: Snapshot; colorSeqs: number[] }) {
    if (ref.current === null) return;
    const snap = ref.current.snapshot();

    setState((prev) => {
      const prevCohorts = prev.kind === 'ready' ? prev.snapshot.cohorts : [];
      const prevIds = prev.kind === 'ready' ? prev.ids : [];
      const prevSeqs = prev.kind === 'ready' ? prev.colorSeqs : [];
      const ids = diffPositions(prevIds, op, prevCohorts, snap.cohorts, makeId);
      const colorSeqs = diffPositions(prevSeqs, op, prevCohorts, snap.cohorts, nextColorSeq);
      if (persisting) save({ snapshot: snap, colorSeqs, onboardings: latestOnboardingsRef.current });
      return { kind: 'ready', snapshot: snap, ids, colorSeqs };
    });

    // For take ops, also build the onboarding event from the diff.
    if (op === 'take' && takeBefore) {
      const prevCohorts = takeBefore.snapshot.cohorts;
      const prevSeqs = takeBefore.colorSeqs;
      const newCohorts = snap.cohorts;
      const popped = prevCohorts.length - newCohorts.length;

      const groups: { color: CohortColor; count: number }[] = [];

      // Onboarding order = service order. Front of line (rightmost cohort)
      // is served first, then leftward. Fully-popped cohorts are the
      // rightmost `popped` of prev; iterate them right-to-left so the
      // oldest cohort lands first in the event groups.
      for (let i = prevCohorts.length - 1; i >= prevCohorts.length - popped; i--) {
        groups.push({ color: colorFor(prevSeqs[i]!), count: prevCohorts[i]!.count });
      }

      // Then the partial drain on the new last (surviving) cohort, if any.
      const survivorIdx = newCohorts.length - 1;
      if (survivorIdx >= 0) {
        const drained = prevCohorts[survivorIdx]!.count - newCohorts[survivorIdx]!.count;
        if (drained > 0) {
          groups.push({ color: colorFor(prevSeqs[survivorIdx]!), count: drained });
        }
      }

      const totalTaken = groups.reduce((s, g) => s + g.count, 0);
      if (totalTaken > 0) {
        const event: OnboardingEvent = {
          id: `ob-${Date.now()}-${Math.floor(performance.now() * 1000) % 100000}`,
          at: Date.now(),
          taken: totalTaken,
          groups,
        };
        setOnboardings((prev) => {
          const next = [event, ...prev].slice(0, ONBOARDING_LIMIT);
          latestOnboardingsRef.current = next;
          if (persisting) save({ snapshot: snap, colorSeqs: nextColorSeqsAfter(snap, op, prevCohorts, prevSeqs), onboardings: next });
          return next;
        });
      }
    }
  }

  // Helpers for the snapshot we're about to persist alongside onboardings.
  const latestOnboardingsRef = useRef<OnboardingEvent[]>(onboardings);
  useEffect(() => { latestOnboardingsRef.current = onboardings; }, [onboardings]);

  function nextColorSeqsAfter(
    snap: Snapshot,
    op: Op,
    prevCohorts: readonly Cohort[],
    prevSeqs: number[],
  ): number[] {
    return diffPositions(prevSeqs, op, prevCohorts, snap.cohorts, nextColorSeq);
  }

  function tryDo<T>(fn: () => T): T | undefined {
    try {
      const out = fn();
      setLastError(null);
      return out;
    } catch (e) {
      if (
        e instanceof InvalidCapacityError ||
        e instanceof InvalidCountError ||
        e instanceof NonIntegerCountError
      ) {
        setLastError(e.message);
        return undefined;
      }
      throw e;
    }
  }

  function ensure(capacity: number) {
    tryDo(() => {
      ref.current = new WaitingList(capacity);
      setOnboardings([]);
      latestOnboardingsRef.current = [];
      publish('create');
    });
  }

  function add(n: number) {
    if (ref.current === null) return;
    tryDo(() => {
      ref.current!.add(n);
      publish('add');
    });
  }

  function take(n: number): TakeResult {
    if (ref.current === null) return { kind: 'noop' };
    const result = tryDo(() => {
      const before =
        state.kind === 'ready'
          ? { snapshot: state.snapshot, colorSeqs: state.colorSeqs }
          : undefined;
      const r = ref.current!.take(n);
      publish('take', before);
      return r;
    });
    return result ?? { kind: 'noop' };
  }

  function reset(capacity?: number) {
    const cap = capacity ?? ref.current?.capacity ?? 10;
    tryDo(() => {
      ref.current = new WaitingList(cap);
      const snap = ref.current.snapshot();
      setOnboardings([]);
      latestOnboardingsRef.current = [];
      if (persisting) save({ snapshot: snap, colorSeqs: [], onboardings: [] });
      setState({ kind: 'ready', snapshot: snap, ids: [], colorSeqs: [] });
    });
  }

  function clearOnboardings() {
    setOnboardings([]);
    latestOnboardingsRef.current = [];
    if (state.kind === 'ready' && persisting) {
      save({ snapshot: state.snapshot, colorSeqs: state.colorSeqs, onboardings: [] });
    }
  }

  return {
    state: state.kind,
    snapshot: state.kind === 'ready' ? state.snapshot : null,
    cohortIds: state.kind === 'ready' ? state.ids : [],
    cohortColors:
      state.kind === 'ready' ? state.colorSeqs.map((s) => colorFor(s)) : [],
    onboardings,
    persisting,
    lastError,
    clearError: () => setLastError(null),
    clearOnboardings,
    ensure,
    add,
    take,
    reset,
  } as const;
}
