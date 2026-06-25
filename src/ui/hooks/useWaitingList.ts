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

type State =
  | { kind: 'uninitialized' }
  | { kind: 'ready'; snapshot: Snapshot; ids: string[] };

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  return `c${idCounter}`;
}

function rebuildFromSnapshot(snapshot: Snapshot): WaitingList {
  const wl = new WaitingList(snapshot.capacity);
  for (const cohort of [...snapshot.cohorts].reverse()) {
    wl.add(cohort.count);
  }
  return wl;
}

function nextIds(
  prevIds: string[],
  op: Op,
  prevCohorts: readonly Cohort[],
  newCohorts: readonly Cohort[],
): string[] {
  if (op === 'create' || op === 'reset') {
    return newCohorts.map(() => makeId());
  }
  if (op === 'add') {
    const prepended = Math.max(0, newCohorts.length - prevCohorts.length);
    const newIds = Array.from({ length: prepended }, () => makeId());
    return [...newIds, ...prevIds];
  }
  if (op === 'take') {
    const popped = Math.max(0, prevCohorts.length - newCohorts.length);
    return prevIds.slice(0, prevIds.length - popped);
  }
  return prevIds;
}

export function useWaitingList() {
  const ref = useRef<WaitingList | null>(null);
  const persisting = useRef<boolean>(isStorageAvailable()).current;

  const [state, setState] = useState<State>(() => {
    if (!persisting) return { kind: 'uninitialized' };
    const restored = load();
    if (!restored) return { kind: 'uninitialized' };
    return {
      kind: 'ready',
      snapshot: restored.snapshot,
      ids: restored.snapshot.cohorts.map(() => makeId()),
    };
  });

  useEffect(() => {
    if (state.kind === 'ready' && ref.current === null) {
      ref.current = rebuildFromSnapshot(state.snapshot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [lastError, setLastError] = useState<string | null>(null);

  function publish(op: Op) {
    if (ref.current === null) return;
    const snap = ref.current.snapshot();
    setState((prev) => {
      const prevCohorts = prev.kind === 'ready' ? prev.snapshot.cohorts : [];
      const prevIds = prev.kind === 'ready' ? prev.ids : [];
      const ids = nextIds(prevIds, op, prevCohorts, snap.cohorts);
      if (persisting) save(snap);
      return { kind: 'ready', snapshot: snap, ids };
    });
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
      const r = ref.current!.take(n);
      publish('take');
      return r;
    });
    return result ?? { kind: 'noop' };
  }

  function reset(capacity?: number) {
    const cap = capacity ?? ref.current?.capacity ?? 10;
    tryDo(() => {
      ref.current = new WaitingList(cap);
      const snap = ref.current.snapshot();
      if (persisting) save(snap);
      setState({ kind: 'ready', snapshot: snap, ids: [] });
    });
  }

  return {
    state: state.kind,
    snapshot: state.kind === 'ready' ? state.snapshot : null,
    cohortIds: state.kind === 'ready' ? state.ids : [],
    persisting,
    lastError,
    clearError: () => setLastError(null),
    ensure,
    add,
    take,
    reset,
  } as const;
}
