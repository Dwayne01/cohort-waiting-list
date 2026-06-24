# Cohort Waiting List

A small TypeScript app for managing one FIFO cohort waiting list. Built as a take-home for Elective.

## Run

```bash
nvm use          # Node 22.11.0 (pinned via .nvmrc)
npm install
npm run dev      # http://localhost:5173
```

## What it does

- **Create** a waiting list with a configurable cohort capacity (default 10).
- **Add** any number of creators in a single call. Overflow opens new cohorts on the left.
- **Take** up to N creators, oldest first.
- **Get the total** number of creators currently waiting.

State persists to `localStorage`. The Reset button starts over and optionally sets a new capacity.

## Design notes

### Layers

```
src/
  core/      ← TS class + types, zero React/DOM/storage dependencies
  storage/   ← localStorage codec with exhaustive invariant validation
  ui/        ← React + Framer Motion, consumes immutable Snapshots
```

The load-bearing decision is the boundary between `core/` and the rest. The core exposes a mutable `WaitingList` class, but the only data that crosses out is an immutable `Snapshot`. The UI never touches the class directly — `useWaitingList` holds it in a `ref` and publishes a fresh snapshot on every operation.

### Why a mutable class with an immutable wire format?

It's the cleanest separation I could find. The class is small and easy to reason about with imperative state; React doesn't need to know it exists. `Snapshot` is what gets typed, serialized, rendered, and diffed. If I wanted to swap the class for pure functions later, the signatures on the React side wouldn't move.

### Types pulling weight

A few deliberate choices so the type system isn't decoration:

- `Cohort = { readonly count: number }` instead of a bare `number`. Costs nothing now, documents the `1..capacity` invariant near the type, leaves room for ids/timestamps later.
- Three error classes (`InvalidCapacityError`, `InvalidCountError`, `NonIntegerCountError`) so `instanceof` discriminates at the boundary instead of a stringly-typed `error.code`.
- `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax` in tsconfig. Array index access returns `T | undefined`, forcing the algorithm in `take()` to assert intentionally (one `!` after a length check — the only place in the codebase).

### Algorithms

**`add(n)`**: validate; `n === 0` is a no-op. Otherwise fill the leftmost cohort up to capacity, prepend full cohorts for each capacity-sized chunk, then prepend a partial cohort for the remainder.

**`take(n)`**: validate; `n === 0` returns 0. Otherwise drain the rightmost cohort by `min(remaining, cohort.count)`; if it hits 0, pop it; loop until `n` is satisfied or the list is empty. Returns the count actually taken (clamped to total).

Invariants the public API never breaks:

- `Snapshot.cohorts` never contains a zero. Empty cohorts are pruned in the same operation that empties them.
- For every cohort: `1 ≤ count ≤ capacity`.
- Order between cohorts is sacred — only the rightmost is decremented.

### React key strategy

`useWaitingList` maintains a parallel array of synthetic per-cohort IDs alongside the snapshot. When a cohort persists across operations its ID is stable; when one is prepended or pruned the ID array is updated accordingly. This is what makes `<AnimatePresence>` fire enter/exit only on truly new or removed cohorts, instead of flashing every cohort on every overflow. See the "Working with AI" section for why this got special attention.

## Edge cases

| Case | Behavior |
|---|---|
| `new WaitingList(0)`, negative, non-integer, NaN, Infinity | `InvalidCapacityError` |
| `add(0)` / `take(0)` | No-op, no log entry |
| `add(-1)` / non-integer / NaN / Infinity / > 1,000,000 | Throws |
| `add(n)` exactly fills the open cohort | No new cohort spawned |
| `add(n)` on empty list, `n` is a multiple of capacity | `k` full cohorts, no partial |
| `take(n)` on empty list | Returns 0 |
| `take(n > total)` | Returns `total`, list becomes empty |
| `take(n)` that empties a cohort | Pruned in the same operation |
| Capacity = 1 | Each cohort holds one creator |
| Capacity > 50 | UI swaps the dot grid for a fill bar |
| localStorage unavailable | Runs in-memory, "Not persisting" badge appears |
| localStorage corrupt JSON / version mismatch / invariant failure | Bail to fresh state |
| localStorage quota exceeded on write | Caught; UI keeps running, state stays in memory until next successful write |
| Two browser tabs open | Last write wins; no cross-tab sync (documented limitation) |
| Rapid clicks during animations | State is the source of truth; animations interrupt cleanly |
| Take / Add buttons | Disabled when the operation would be a no-op |

## Out of scope (deliberately)

- Per-creator identity, names, timestamps. A creator is the number `1`.
- Multiple named waiting lists. One list per page.
- Server persistence, auth, sharing.
- Undo / replay.
- Test suite (see "Tradeoffs").

## Tradeoffs

**No test suite.** Time was spent on type design, animation, and the writeup instead. The edge-case table above is the canonical reference — every row is reachable from the running UI, the public API is small enough that reviewers can verify each row by inspection, and `noUncheckedIndexedAccess` + strict TS catches a meaningful class of regressions at the type level. If I had another hour, the first thing I'd add is a `vitest` file with one assertion per row of the table, plus a property test that round-trips `Persisted` through the validator.

**Framer Motion (~50KB gzipped).** Earns its inclusion through `<AnimatePresence>` and `layout` animations, which are otherwise painful in React. A production app would weigh this more carefully against bundle size.

**Rehydration via `add()` replay.** When restoring from `localStorage`, I rebuild the class by replaying `add()` from oldest to newest rather than poking private state. O(n) in `total`, but every cohort that exists in memory has gone through validation — there's no "trusted" entry point. For our scale this is irrelevant.

## Working with AI

I used Claude throughout — design conversation, scaffolding, motion choices, the writeup. Here's the honest accounting.

### Where AI helped

- Bootstrapping Vite + React + TS + strict tsconfig + Framer Motion. The non-interactive `npm create vite` wizard kept blocking on prompts, so I pivoted to writing the config files directly. Faster path, fewer surprises.
- Drafting the dot-grid and capacity-bar markup, then iterating on the spring physics for cohort enter/exit (`stiffness: 380, damping: 28` after a couple of attempts).
- Generating the exhaustive `isPersisted` validator from a verbal description of the invariants.
- Writing the scratch verification script with `expect()` helpers — 36 assertions across the spec example, capacity-1 edge case, and every input-validation branch.

### Where AI was wrong (the concrete moment)

The first cut of `ListView` used `key={i}` for each cohort inside `<AnimatePresence>`. This looks right but breaks the animation: when `add()` overflow prepends a new cohort, every existing cohort's positional index changes, so React sees each key as belonging to a new element. AnimatePresence then animates *every* cohort's exit and re-entry — visually it's a flash, not a slide.

I caught this by reasoning through what would happen on overflow before wiring the animations. The fix was to extend `useWaitingList` with a parallel `cohortIds: string[]` array and a `nextIds()` function that diffs against the previous snapshot. Each cohort gets a stable synthetic ID for its full lifetime; `AnimatePresence` only fires enter/exit on truly new or pruned cohorts.

The lesson: AI defaults to `key={index}` for React keys because it's the most common pattern. For animation-heavy lists where elements are inserted in the middle or at non-end positions, that default produces visible bugs.

### What I wrote by hand and why

- The `take()` algorithm. Small, load-bearing, central to correctness. Worth holding in my head.
- The edge-case decision policy: throw on hard input errors, no-op on soft zeros, clamp on `take(n > total)`. AI defaults trended toward "throw on every off-nominal" or "silently clamp everything"; the spec's "up to N" forced a specific shape neither default matched.
- The Snapshot ↔ mutable class boundary. AI would have proposed either pure functions throughout or a class with mutable getters; the explicit `snapshot()` returning a fresh immutable view is the seam that keeps React, persistence, and future testability all simple.
- The synthetic-ID diff logic in `nextIds()`. I needed to deeply understand what each operation does to the cohort array before writing it, even though AI would have produced correct code if asked.

## Project layout

```
src/
  main.tsx
  App.tsx
  styles.css
  core/
    index.ts          // public barrel
    types.ts          // Cohort, Snapshot, Op, LogEntry
    errors.ts         // three error classes
    validate.ts       // validateCapacity, validateCount
    WaitingList.ts    // the class
  storage/
    schema.ts         // STORAGE_KEY, Persisted, isPersisted validator
    persist.ts        // load, save, isStorageAvailable, clearStorage
  ui/
    SetupBar.tsx
    Stats.tsx         // total counter tweens via rAF
    Controls.tsx      // add / take / reset
    ListView.tsx      // AnimatePresence + layout
    CohortBox.tsx     // dot grid + bar fallback
    OperationLog.tsx  // collapsible, live relative timestamps
    ServedFlash.tsx   // "+N served" chip
    hooks/
      useWaitingList.ts  // class-to-React boundary + per-cohort IDs + persistence
docs/
  superpowers/
    specs/ 2026-06-24-cohort-waiting-list-design.md
    plans/ 2026-06-24-cohort-waiting-list.md
AI_NOTES.md            // scratch material that fed the AI section above
```
