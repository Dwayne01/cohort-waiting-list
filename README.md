# Cohort Waiting List

Elective take-home. Single-page TypeScript app for managing one FIFO cohort waiting list.

## Run it

```bash
nvm use            # Node 22.11.0 (pinned via .nvmrc)
npm install
npm run dev        # http://localhost:5173
```

## What it does

The four spec features:

- Create a list with a configurable cohort capacity (default 10).
- Add any number of creators in one call. Overflow opens new cohorts on the left.
- Onboard up to N creators ("take") from the oldest cohort first.
- Read the total currently waiting.

Plus a few things that made it feel like a tool instead of a demo: state persists to `localStorage`, Reset asks before it nukes, each cohort gets a stable color so you can see where a batch sits as it moves through the queue, and a "Currently onboarding" panel logs the last few onboarding sessions with their colors preserved.

## How it's organized

```
src/
  core/      TypeScript class + types. No React, no DOM, no storage.
  storage/   localStorage codec with an invariant-checking validator.
  ui/        React + Framer Motion. Consumes immutable snapshots only.
```

The seam that does the work is `Snapshot`. The `WaitingList` class is mutable internally (a private `cohorts` array, a `total` field). The only thing that crosses out to React or storage is the value returned by `snapshot()` — a fresh, immutable view rebuilt on every call. Nothing in `ui/` or `storage/` ever sees the class itself.

The hook (`useWaitingList`) holds the class in a `ref` and publishes a new snapshot after each operation. On the React side everything is data, not methods.

### Why this shape

If you went pure-functional, the React glue would be cleaner but the imperative tests in your head ("add fills the leftmost, then prepends") read worse. If you went all-mutable-class-in-React, you'd be fighting render-on-mutation. Splitting at `snapshot()` gives you imperative state where it's easy to think about and immutable values where React expects them.

### Types

A few choices that matter:

- `Cohort = { readonly count: number }` rather than a bare `number`. Costs nothing now and leaves a door open for `id`, `createdAt`, etc. without breaking the public API.
- Three error classes (`InvalidCapacityError`, `InvalidCountError`, `NonIntegerCountError`) so callers `instanceof`-discriminate at the boundary.
- `take()` returns a discriminated union, not a number:

  ```ts
  type TakeResult =
    | { kind: 'served';  taken: number }
    | { kind: 'partial'; requested: number; taken: number }
    | { kind: 'noop' };
  ```

  The clamp case is in the type, so callers don't have to compare `taken < requested` to figure out what happened.

- `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax` in `tsconfig.app.json`. Array index access returns `T | undefined`, which means the algorithm in `take()` has to assert a single time after a length check — the only `!` in the codebase.

### Algorithms

`add(n)` — validate, no-op on 0, otherwise fill the leftmost cohort up to capacity, prepend full cohorts for each capacity-sized chunk, then prepend one partial cohort for the remainder.

`take(n)` — validate, no-op on 0, otherwise drain the rightmost cohort by `min(remaining, cohort.count)`. Pop if it hits 0. Loop until satisfied or the list is empty. Return the count actually taken.

Invariants the public API maintains:

- `Snapshot.cohorts` never holds a zero (empty cohorts are pruned in the same operation).
- Every `cohort.count` is in `[1, capacity]`.
- Only the rightmost cohort is ever decremented.

### React keys

The hook keeps a synthetic `cohortIds: string[]` parallel to `snapshot.cohorts`. When a cohort persists across operations its ID stays put; new IDs are prepended on `add`, dropped from the right on `take`. `<AnimatePresence>` keys off these IDs so it only fires enter/exit on cohorts that actually appeared or disappeared. The same diff primitive (a generic `diffPositions<T>`) is reused for the per-cohort color sequence — both share the "stable identity through operations" requirement.

## Edge cases

| Case | Behavior |
|---|---|
| `new WaitingList(0)`, negative, non-integer, NaN, Infinity | `InvalidCapacityError` |
| `add(0)` / `take(0)` | No-op |
| `add(-1)`, non-integer, NaN, Infinity, > 1,000,000 | Throws |
| `add(n)` exactly fills the leftmost open cohort | No new cohort spawned |
| `add(n)` on empty list with `n` a multiple of capacity | `k` full cohorts, no partial |
| `take(n)` on empty list | Returns 0 |
| `take(n > total)` | Returns `total`, list goes empty, UI shows an amber notice |
| `take(n)` that empties a cohort | Pruned in the same operation |
| Capacity = 1 | Works — each cohort holds one dot |
| Capacity > 50 | UI swaps the dot grid for a fill bar inside the same box |
| localStorage unavailable | Runs in-memory, "Not persisting" badge appears |
| localStorage JSON corrupt / version mismatch / invariants fail | Bail to fresh state silently |
| localStorage quota exceeded on write | Caught; UI keeps running, state stays in memory until next successful write |
| Two browser tabs open | Last write wins (known limitation, not handled) |
| Rapid clicks during animations | Data is the source of truth; animations interrupt |
| Add / Onboard buttons | Disabled when the operation would be a no-op |
| Reset | Two-step confirm (preset → "Reset list and set capacity to N?") before it clears the list |

## Not in scope

- Per-creator identity, names, or timestamps. A creator is the number 1.
- Multiple named lists.
- Server persistence, auth, multi-user.
- Undo / replay.
- Tests. See trade-offs below.

## Trade-offs I made

**No test suite.** The spec gives 4–6 hours. I picked type design, animations, and the writeup over test mechanics. The edge-case table is the canonical reference instead — every row is reachable from the UI, the public API is small enough to verify by inspection, and strict TS catches a useful subset of regressions for free. First thing I'd add with another hour is a `vitest` file with one assertion per row of that table plus a property test that round-trips `Persisted` through the validator.

**Framer Motion (~50 KB gzipped, most of the bundle).** Earns it through `<AnimatePresence>` and `layout` animations. Building those by hand in React is unpleasant. For a real product I'd weigh code-splitting it or moving to lighter primitives where I could.

**Rehydration replays `add()` calls.** When restoring from `localStorage`, I rebuild the class oldest-first via the public `add()` instead of a private `restore()` mutator. O(n) in `total`, irrelevant at our scale, and every cohort that exists in memory has gone through validation.

## Working with AI

Claude was on the keyboard for everything. I drove.

The pattern, repeatedly: I'd describe what I wanted; the model would produce a first cut; I'd push back on the parts that pattern-matched too easily to common defaults; we'd iterate. The PR is the result of a lot of small redirects more than any big rewrite.

### Where it helped

- The Vite bootstrap. I tried `npm create vite@^6 . --template react-ts` first. It blocked on the interactive package-name prompt twice. We switched to writing `package.json`, `vite.config.ts`, both `tsconfig`s, and the entry files directly. Faster than fighting the wizard. The strict tsconfig (every flag I named, plus `moduleDetection: "force"` which I hadn't planned to add) came together in one pass.
- The `isPersisted()` validator. I described the invariants verbally (capacity ≥ 1, every cohort count in `[1, capacity]`, total equals sum, color-seq array length matches cohorts). One try, no rework.
- A scratch verification script that exercised the full spec walkthrough plus the input-validation branches — 36 `expect()` calls, all passing. I deleted it before the final commit (no tests was a scope call), but it caught the edge cases in flight.
- Framer Motion physics. I said "stream filling in, not a flash." We landed on `stiffness: 380, damping: 28` after a few tries with me watching the browser.
- Mid-build verification. When I wanted to confirm a change actually worked, I'd have it spin up headless Chromium via Playwright, drive the page, screenshot. Cheap, repeatable, faster than reloading by hand.

### Where I overrode

- **Per-batch color.** First proposal for color-coding was to track every individual creator's add-batch through cohort boundaries. Plausible but the Ops mental model is one-cohort-at-a-time, not "follow this batch." Switched to per-cohort color. Less code, more legible.
- **Tests.** The model was happy to scaffold vitest. I cut it for time, called it out as a trade-off.
- **Input fields.** First UI cut was three `<input type=number>` fields with submit buttons. I asked for a single button per action that opens a preset-chip picker. Then trimmed the chip set from `[1, 3, 5, 10, 25, 100]` to `[1, 3, 5, 10]` after seeing it.
- **Spec-default labels.** "Take" became "Start onboarding" because the brief is about onboarding creators, not running a queue operation. "Oldest" became "next in line" on the rightmost cohort. The "+N served" chip became "+N onboarded." Same instinct on every word.
- **Dot fill direction.** Defaults put filled dots on the left. I asked for right-to-left so dots sit closer to the door. That swap left the stagger animating in the wrong direction — had to ask again to reverse it.
- **Cohort packing.** First version was left-justified, so when the oldest cohort got served the rest stayed pinned left and a gap opened on the right. Asked for right-justify (cohorts shuffle toward the door as the queue advances). That introduced an overflow-clipping issue — first fix was `justify-content: flex-end` which clipped left-side content; I asked for a `.list-scroll` wrapper with `margin-left: auto` on the first child instead. Horizontal scroll works now.

### The one wrong moment that would have shipped if I'd been on autopilot

The first version of `ListView` used `key={i}` for cohorts inside `<AnimatePresence>`. React-default reflex, looks right, isn't. When `add()` overflows and prepends a new cohort, every existing cohort's positional index shifts by one. React reconciles by key, so AnimatePresence sees each existing cohort as a *new* element under a different key and animates the exit of every "removed" key plus the entry of every "new" one. Result: a full-row flash on every overflow.

I caught it by walking the overflow case in my head before wiring the animations. Fix was a parallel `cohortIds: string[]` array updated via a small `diffPositions()` function — new IDs prepended on `add`, dropped from the right on `take`, full replace on `create`/`reset`. The same primitive is reused for the per-cohort color sequence.

Pattern-matchy AI defaults are invisible when you only read the code statically. Walking the operation sequence is what surfaces them.

### Smaller miss worth keeping

Adding the "door" indicator at the right of the queue, the model produced a 🚪 emoji. House rule is no emojis unless requested. I caught it the same diff and reverted to a glowing yellow bar. Trivial in itself, but the kind of thing that survives if you stop reading every change.

### What I wrote by hand

Nothing. The model typed every line of source. What I did was direct — describe what I wanted, push back on reflexive defaults, choose the shape (`Snapshot` over leaking the class, `TakeResult` over `number`, per-cohort over per-batch color, two-step confirm on Reset, no tests). I read every diff before it landed. The commits that survived are the ones I'd defend in review.

"Hand-written" with no model in the loop would be zero lines and pretending otherwise isn't the answer to this question. The skill on display is what to ask for and what to push back on.

## Things I considered (performance, structure, future)

- **Rehydration cost.** `add()` replay is O(n) in `total`. Fine for our scale. A `restore()` private mutator would be the obvious change at million-creator scale, but I'd want to keep its scope very narrow — every other path into the class is validated.
- **Storage write frequency.** Every operation writes to `localStorage`. Imperceptible to a human; wasteful on burst input. A debounced writer with a ~100ms tail flush kills the work without changing observable behavior.
- **Bundle size.** ~91 KB gzipped, dominated by Framer Motion. For a take-home, fine. For a real product, code-split the animations or drop to CSS transitions for the simple cases.
- **Schema versioning.** Storage went through v1 → v2 → v3 during this build (removed log; added colorSeqs + onboardings). Each bump drops older payloads silently. A real product would have per-version parsers chained for migration.
- **Cohort virtualization.** Unvirtualized today. Fine through a few hundred cohorts. North of that I'd switch to `react-window` and either freeze animations on scroll or only animate cohorts in view.
- **Type-system slack.** `Cohort = { readonly count: number }` leaves room for `id`/`createdAt`/`tags`. `TakeResult`'s discriminated union has room for new kinds (`'rate-limited'`, `'queue-frozen'`) without breaking exhaustive callers.
- **Cross-tab sync.** Today: last write wins. Fix is a `storage` event listener; documented as a known limitation in the edge-case table rather than built.
- **Accessibility.** ARIA labels on inputs, picker has `aria-expanded`, action buttons have visible labels. Still missing a full keyboard map (A/T/R shortcuts, arrow navigation on chips) which is what I'd add before calling it production-ready.

## Project layout

```
src/
  main.tsx
  App.tsx
  styles.css
  core/
    index.ts          public barrel
    types.ts          Cohort, Snapshot, Op, TakeResult
    errors.ts         three error classes
    validate.ts       validateCapacity, validateCount
    WaitingList.ts    the class
  storage/
    schema.ts         STORAGE_KEY, Persisted, isPersisted
    persist.ts        load, save, isStorageAvailable, clearStorage
  ui/
    App.tsx           wiring + notice/served-flash orchestration
    SetupBar.tsx
    Stats.tsx         total counter tweens via rAF
    Controls.tsx      Add / Start onboarding / Reset
    ListView.tsx      AnimatePresence + layout, horizontally scrollable
    CohortBox.tsx     dot grid + bar fallback, color from CSS vars
    PresetPicker.tsx  popover picker with optional confirm step
    OnboardingPanel.tsx  "Currently onboarding" card list
    ServedFlash.tsx   "+N onboarded" chip
    palette.ts        10-color cohort palette
    hooks/
      useWaitingList.ts  class-to-React boundary, per-cohort IDs + colors, persistence
docs/
  superpowers/
    specs/   the approved design spec
    plans/   the implementation plan
AI_NOTES.md            raw working notes that fed the "Working with AI" section
```
