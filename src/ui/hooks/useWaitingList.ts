import { useEffect, useRef, useState } from 'react';
import {
  WaitingList,
  type Snapshot,
  type LogEntry,
  type Op,
  InvalidCapacityError,
  InvalidCountError,
  NonIntegerCountError,
} from '../../core';
import { isStorageAvailable, load, save } from '../../storage/persist';

const LOG_LIMIT = 20;

type State =
  | { kind: 'uninitialized' }
  | { kind: 'ready'; snapshot: Snapshot; log: LogEntry[] };

function rebuildFromSnapshot(snapshot: Snapshot): WaitingList {
  const wl = new WaitingList(snapshot.capacity);
  // Add oldest-first so the final order (newest at index 0) matches the snapshot.
  for (const cohort of [...snapshot.cohorts].reverse()) {
    wl.add(cohort.count);
  }
  return wl;
}

export function useWaitingList() {
  const ref = useRef<WaitingList | null>(null);
  const persisting = useRef<boolean>(isStorageAvailable()).current;

  const [state, setState] = useState<State>(() => {
    if (!persisting) return { kind: 'uninitialized' };
    const restored = load();
    if (!restored) return { kind: 'uninitialized' };
    return { kind: 'ready', snapshot: restored.snapshot, log: restored.log };
  });

  // Adopt a class instance for any restored state (state init is pure and can't touch the ref).
  useEffect(() => {
    if (state.kind === 'ready' && ref.current === null) {
      ref.current = rebuildFromSnapshot(state.snapshot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [lastError, setLastError] = useState<string | null>(null);

  function appendLog(op: Op, n: number, prevLog: readonly LogEntry[]): LogEntry[] {
    if (n <= 0) return [...prevLog];
    const entry: LogEntry = { op, n, at: Date.now() };
    return [entry, ...prevLog].slice(0, LOG_LIMIT);
  }

  function publish(op: Op, n: number) {
    if (ref.current === null) return;
    const snap = ref.current.snapshot();
    setState((prev) => {
      const prevLog = prev.kind === 'ready' ? prev.log : [];
      const log = appendLog(op, n, prevLog);
      if (persisting) save(snap, log);
      return { kind: 'ready', snapshot: snap, log };
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
      publish('create', capacity);
    });
  }

  function add(n: number) {
    if (ref.current === null) return;
    tryDo(() => {
      ref.current!.add(n);
      publish('add', n);
    });
  }

  function take(n: number): number {
    if (ref.current === null) return 0;
    const result = tryDo(() => {
      const taken = ref.current!.take(n);
      publish('take', taken);
      return taken;
    });
    return result ?? 0;
  }

  function reset(capacity?: number) {
    const cap = capacity ?? ref.current?.capacity ?? 10;
    tryDo(() => {
      ref.current = new WaitingList(cap);
      const snap = ref.current.snapshot();
      const log = appendLog('reset', cap, []);
      if (persisting) save(snap, log);
      setState({ kind: 'ready', snapshot: snap, log });
    });
  }

  return {
    state: state.kind,
    snapshot: state.kind === 'ready' ? state.snapshot : null,
    log: state.kind === 'ready' ? state.log : [],
    persisting,
    lastError,
    clearError: () => setLastError(null),
    ensure,
    add,
    take,
    reset,
  } as const;
}
