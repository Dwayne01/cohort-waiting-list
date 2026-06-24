# Cohort Waiting List — Design

**Date:** 2026-06-24
**Status:** Approved for implementation
**Time budget:** 4–6 hours (per take-home brief)

## 1. Overview

A web-based system for managing a single waiting list of "creators" (modeled as the number `1`) organized into fixed-size cohorts. Creators are added in batches and served oldest-first (FIFO between cohorts; identity within a cohort is irrelevant).

The system supports four operations:

1. **Create** a waiting list with a configurable cohort capacity (default 10).
2. **Add** any number of creators in a single call. No cohort may exceed capacity; overflow opens new cohorts on the left.
3. **Take** up to N creators from the right (oldest first).
4. **Get the total** number of creators currently waiting.

It is delivered as a single TypeScript Vite + React app, with a layered codebase that isolates the core logic from React and from persistence.

## 2. Goals

- Demonstrate **TypeScript judgment** — the type system should prevent bugs, not decorate code.
- Demonstrate **edge-case handling** — a documented, deliberate policy on every off-nominal input.
- Produce a UI that is **engaging and fun to watch** as the queue fills and drains, without sliding into "look at my CSS."
- Keep total scope to a **clean partial** — ship the four features plus a reset button and an operation log; nothing more.

## 3. Non-Goals

The following are explicitly **out of scope**, called out in the README so reviewers see they were considered:

- Per-creator identity, names, or timestamps. A creator is the number `1`.
- Multiple named waiting lists. The UI manages exactly one.
- Server-side persistence, authentication, sharing, or multi-user sync.
- Undo / replay / operation history beyond a recent-activity log.
- Tests. Edge-case reasoning is documented in the README table rather than encoded in a test suite (a deliberate tradeoff — see Section 10).

## 4. Architecture

Single Vite + React + TypeScript project. Code is split into three layers:

```
src/
  core/         ← pure TS; no React, no DOM, no storage
    types.ts
    errors.ts
    WaitingList.ts
    index.ts
  storage/      ← localStorage codec; only depends on core
    schema.ts
    persist.ts
  ui/           ← React components; only depends on core types via Snapshot
    App.tsx
    SetupBar.tsx
    Stats.tsx
    Controls.tsx
    ListView.tsx
    CohortBox.tsx
    ServedFlash.tsx
    OperationLog.tsx
    hooks/useWaitingList.ts
```

The **load-bearing decision** is the boundary between `core` and `ui`: the core exposes a mutable `WaitingList` class, but the only data that crosses the boundary is an immutable `Snapshot`. This keeps mutation contained, lets React render predictably, and lets the type system express the invariants that matter.

## 5. Core types & API

```ts
// src/core/types.ts
export type Cohort = {
  readonly count: number;             // 1..capacity in published state
};

export type Snapshot = {
  readonly capacity: number;
  readonly cohorts: readonly Cohort[]; // newest at index 0, oldest at last
  readonly total: number;
};

// src/core/errors.ts
export class InvalidCapacityError extends RangeError {}
export class InvalidCountError    extends RangeError {}   // negative, NaN, Infinity, > MAX_N
export class NonIntegerCountError extends TypeError  {}   // floats

// src/core/WaitingList.ts
export class WaitingList {
  static readonly MAX_N = 1_000_000;

  constructor(capacity?: number);     // default 10; throws InvalidCapacityError
  add(n: number): void;               // validated; no-op on 0; throws on bad input
  take(n: number): number;            // returns count actually taken (clamped to total)
  get total(): number;
  get capacity(): number;
  snapshot(): Snapshot;               // immutable view for React & storage
}
```

### Rationale

- **`Cohort` is a record, not a bare number.** It costs nothing today and documents `1..capacity` at the type. Future extension (timestamps, ids) does not break the public API.
- **`Snapshot` is the wire format.** UI reads it, storage serializes it. The class itself never leaves the core module — only snapshots do.
- **`add` returns `void`; `take` returns `number`.** Asymmetric on purpose. `add` always succeeds for valid input; `take` reports how many it actually got (the clamp signal the caller needs).
- **Three distinct error classes** discriminate cleanly via `instanceof`. Better than a stringly-typed `error.code`.
- **`MAX_N`** lives on the class so the ceiling is visible at the type level.

## 6. Algorithm — `take(n)` walkthrough

`take` is the only operation with non-trivial logic. The algorithm is "drain the rightmost cohort, prune if empty, repeat until n is satisfied or the list is empty":

```
state: [8, 10, 10, 10]    take(4)
  drain right by 4   → [8, 10, 10, 6]
  done — return 4

state: [8, 10, 10, 6]    take(7)
  drain right by 6   → [8, 10, 10, 0]   (took 6, need 1)
  prune empty        → [8, 10, 10]
  drain right by 1   → [8, 10, 9]
  done — return 7

state: [7]               take(20)
  drain right by 7   → [0]              (took 7, need 13)
  prune empty        → []
  list empty → stop  — return 7
```

**Invariants preserved:**

- Order **between** cohorts is sacred — only the rightmost is decremented.
- A published `Snapshot.cohorts` never contains a zero. Empty cohorts are pruned in the same operation that empties them.
- `take` is best-effort — `n > total` clamps and returns the actual count taken.

`add(n)` is symmetric: fill the leftmost open cohort first (if any), then spawn full cohorts on the left for each remaining `capacity`-sized chunk, then a partial cohort if there's any remainder.

## 7. UI & animation

### Component tree

```
<App>
  <SetupBar />        ← initial capacity input + "Create list" (only on first ever load)
  <Stats />           ← total waiting, capacity, cohort count
  <Controls />        ← add N input + button, take N input + button, reset (with optional new capacity)
  <ListView>          ← horizontally scrolling row
    <CohortBox />     ← one per cohort, dots inside; the visual focal point
    <ServedFlash />   ← ephemeral "Served: 4" affordance
  </ListView>
  <OperationLog />    ← last 20 ops; collapsible
</App>
```

### State plumbing (the class-to-React boundary)

```ts
function useWaitingList() {
  const ref = useRef<WaitingList | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [log, setLog]           = useState<LogEntry[]>([]);

  function ensure(capacity: number) { ref.current = new WaitingList(capacity); commit('create', capacity); }
  function add(n: number)           { ref.current!.add(n);       commit('add', n); }
  function take(n: number)          { const t = ref.current!.take(n); commit('take', t); }
  function reset(capacity: number)  { ref.current = new WaitingList(capacity); commit('reset', capacity); }

  function commit(op: Op, n: number) {
    setSnapshot(ref.current!.snapshot());
    if (n > 0) appendLog({ op, n, at: Date.now() });
  }

  return { snapshot, log, add, take, reset, ensure };
}
```

The class is held in a `ref` so its identity persists across renders; every operation publishes a fresh immutable `Snapshot` into state. React renders from snapshots, never from the class directly.

### Animation library

**Framer Motion.** It is the de-facto choice for `<AnimatePresence>` + layout animations; exit animations are otherwise painful in React. Adds ~50KB gzipped, which is acceptable for the "fun" requirement.

### Motion choices

| Event | Animation |
|---|---|
| `add(n)` | Each new dot scale-pops `0 → 1.2 → 1`, staggered ~30ms apart. Reads as a stream filling in. |
| Cohort opens (overflow) | New `<CohortBox>` slides in from the left, width tweens from 0 to full, slight bounce. |
| `take(n)` | Rightmost dots slide right + fade, staggered ~40ms. |
| Cohort prunes (empty) | Box collapses width → 0; neighbors shift right via `layout` animation. |
| Served-flash | A floating `+4 served` chip rises and fades above the right edge over ~700ms. |
| Stats counter | `total` counts up/down with a brief tween, not a hard snap. |

### Visual treatment

- Cohorts: soft rounded rectangles, subtle drop shadow, capacity ratio bar at the bottom.
- Dots: filled = warm color (creator present); empty slot = light gray. Newest dots get a brief glow when added.
- Right edge: subtle exit-lane treatment (chevron + faint gradient) so FIFO direction is unmistakable.
- "Newest" / "Next to serve" labels pinned above the row.

### Capacity > 50 fallback

When `capacity > 50`, dot grids are replaced inside each `CohortBox` with a horizontal fill bar showing `count / capacity` plus numeric text. Animations apply to bar widths instead of dot grids. Core logic is unaffected; this is purely a rendering decision.

## 8. Persistence (localStorage)

State is serialized to `localStorage` on every snapshot change under a versioned key. The codec is symmetric and validates invariants on read.

```ts
const KEY     = 'cohort-waitlist:v1';
type Persisted = { version: 1; snapshot: Snapshot; log: LogEntry[] };
```

### Failure modes

| Condition | Behavior |
|---|---|
| Storage unavailable (private mode, disabled) | Run in-memory; show small "not persisting" badge in the UI |
| Corrupt JSON | Bail to fresh empty state silently; never crash, never loop |
| Version mismatch | Bail to fresh empty state |
| Stored data fails invariants (cohort exceeds capacity, etc.) | Bail to fresh empty state |
| Quota exceeded on write | Catch, surface non-blocking warning; keep running |
| Two tabs open simultaneously | Last write wins; **documented limitation**, no cross-tab sync |

## 9. Edge-case decision table

The canonical table. Also reproduced in the README so reviewers can scan it in 30 seconds.

| Case | Behavior | Why |
|---|---|---|
| `new WaitingList()` | Capacity 10 | Spec default |
| `new WaitingList(0)` or negative | `InvalidCapacityError` | Capacity-0 cohorts are meaningless |
| `new WaitingList(2.5)` / NaN / Infinity | `InvalidCapacityError` | Must be positive integer |
| `add(0)` | No-op, no log entry | Lenient on soft zeros; logging would be noise |
| `add(-1)` | `InvalidCountError` | Negatives are caller bugs |
| `add(2.5)` | `NonIntegerCountError` | Creators are discrete |
| `add(NaN)` / `add(Infinity)` | `InvalidCountError` | Defensive |
| `add(n > 1_000_000)` | `InvalidCountError` | Almost certainly a typo |
| `add(n)` exactly fills open cohort | Fills it, no new cohort spawned | No transient empty state |
| `add(n)` on empty list, `n = k·capacity` | Creates `k` full cohorts, no partial | Clean fill |
| `take(0)` | Returns 0, no log entry | Soft zero |
| `take(-1)` / floats / NaN / Infinity / > MAX_N | Throws (symmetric with `add`) | Caller bugs |
| `take(n)` on empty list | Returns 0 | "Up to N" — empty is one form of "less than N available" |
| `take(n > total)` | Returns `total`, list becomes empty | Spec: "up to N" |
| `take(n)` that empties a cohort | Cohort pruned in same operation | Public state never holds empty cohorts |
| Capacity = 1 | Works normally; each cohort holds one | No special case |
| Capacity > 50 | UI swaps dot grid for fill bar | Readability |
| Reset | New empty list, log cleared. Capacity defaults to current; a new capacity may be supplied | Single way to "start over"; SetupBar isn't shown again after first load |
| localStorage failure | See Section 8 | Graceful degradation |
| Rapid clicks during animations | New ops apply immediately; animations interrupt cleanly | State is the source of truth |
| Take/Add buttons | Disabled when their op would be a no-op | Clearer signal than silent click |

## 10. AI collaboration

The README will include a "Working with AI" section with three parts, per the brief:

1. **Where AI helped, where I overrode it.**
   - Expected helpful spots: Vite scaffolding, drafting the dots layout & Framer Motion variants, generating the edge-case table from a verbal brief, repetitive React props plumbing.
   - Expected override needs: the shape of core types (the `Snapshot` vs. mutable class boundary is a design call AI tends to flatten), the edge-case decisions (AI usually defaults to throwing or returning `null` instead of "up to N" semantics).

2. **One concrete moment where AI was wrong.** Will be captured verbatim during the build. Likely candidates:
   - AI proposing `cohorts: number[]` instead of `Cohort[]` (loses invariant doc, future-extension surface).
   - AI suggesting an event-emitter on the class (deliberately avoided — snapshots into React state instead).
   - AI clamping silently on negative `n` (we throw — caller bug).
   - AI mutating `cohorts` from inside the React component (the whole reason for the `Snapshot` boundary).

3. **What I wrote by hand and why.**
   - `take()` algorithm — drain-right + prune. Small, load-bearing, central to correctness.
   - Edge-case table & input-validation policy — judgment, not pattern-matching.
   - Type signatures of the public API — the thing being graded; not outsourced.
   - README "design notes" prose — must sound like me, not a generated artifact.

Material is captured in a scratch `AI_NOTES.md` as we build, then distilled into the README at the end.

### Tradeoff: no test suite

Skipping tests is a deliberate choice to spend the time budget on type design, animation polish, and the writeup. The cost is real: tests are the canonical place to *show* edge-case handling. The mitigation: the edge-case table in Section 9 is exhaustive, lives in the README, and the core's public API is small enough that reviewers can verify each row by inspection. If I had more time, the first thing I'd add is a `vitest` file with one assertion per row of the table.

## 11. Risks & open questions

- **Animation feel is hard to spec on paper.** The motion choices in Section 7 are a starting point; expect ~30 minutes of tweaking durations and easing during the build. If a particular animation distracts more than it informs, it will be cut without revisiting this spec.
- **Framer Motion bundle size** (~50KB gzipped) is acceptable for this take-home; it would warrant scrutiny in a production app.
- **Capacity-1 + dots** looks visually odd (a string of single-dot boxes). Considered, accepted — the alternative (special-case the rendering) is more code than the look is worth.
- **localStorage in dev mode**: Vite HMR will not clear it; if I change the schema mid-build I will either bump the version key or clear it manually. Noted so it does not surprise.
