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

State persists to `localStorage`. The Reset button (with a two-step confirm) starts over and optionally sets a new capacity.

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
| `add(0)` / `take(0)` | No-op |
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

Claude was on the keyboard throughout. I drove the design and the product decisions; I treated the model as a fast typist with strong reflexes that I had to redirect when those reflexes pointed at the wrong thing. Here's the honest accounting.

### Where AI helped, and where I overrode it

**Helped:**

- **Bootstrap.** I tried `npm create vite` first, got blocked twice on its interactive package-name prompt, and decided to write `package.json`, `vite.config.ts`, both `tsconfig`s, `index.html`, and the entry files directly. The model produced a clean strict-mode setup including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax` once I named the flags I wanted.
- **Edge-case validator.** I described the invariants on the persisted shape (capacity ≥ 1, every cohort count in `[1, capacity]`, `total` equals sum of counts, color-seq array parallel to cohorts). The model produced an exhaustive `isPersisted()` validator on the first try. I read it carefully and shipped it.
- **Verification harness.** I wanted a scratch script that exercised the spec walkthrough plus the input-validation branches. Generated 36 assertions; all passed. I deleted it before the final commit because the spec doesn't ask for tests, but the script paid for itself by catching the edge cases live.
- **Framer Motion physics.** I had a verbal target ("a stream filling in, not a flash"). The model produced spring values I tuned by feel until I landed on `stiffness: 380, damping: 28`. A handful of iterations, all driven by what I was seeing in the browser.
- **Playwright verification on demand.** When I wanted to confirm a change worked, I had the model spin up a headless Chromium, drive the page, and capture screenshots + DOM inspection in a single script. Cheap, repeatable, faster than reloading by hand.

**Overrode:**

- **Per-batch vs. per-cohort color.** The model's first proposal for color-coding was per-batch — track each add operation's color through individual creators. I considered it, decided the Ops mental model is *a cohort at a time*, and asked for per-cohort instead. Simpler code, more aligned with how the team actually thinks about onboarding.
- **The "skip tests" decision.** The model was happy to spin up vitest. I cut it because the spec said 4–6 hours and I'd rather have shipped polish than test mechanics. I called this out as a tradeoff in the writeup and listed it as the first thing I'd add with more time.
- **Number inputs everywhere.** The first cut had `<input type=number>` for Add/Take/Reset. I asked for a single button per action that reveals a preset picker, so the UI feels like a tool and not a form. Then trimmed presets from `[1, 3, 5, 10, 25, 100]` down to `[1, 3, 5, 10]` on a second pass.
- **Generic labels.** The model defaulted to "Take" (spec language). I renamed to **Start onboarding** because the case study is about Ops actually onboarding creators, not a generic queue operation. The same instinct drove labeling the right-hand cohort tag "next in line" and adding the "Currently onboarding" panel with a `+N onboarded` chip — the words match the work.

### One concrete moment where AI was sloppy

Two stand out; this is the one that would have shipped if I'd been on autopilot.

The first version of `ListView` used `key={i}` for each cohort inside `<AnimatePresence>`. This is the React-default reflex and it *looks* right. It is not right. When `add()` overflows and prepends a new cohort, every existing cohort's positional index shifts by one. React reconciles by key, so each existing cohort is seen as a *new* element under a different key — and AnimatePresence dutifully animates the exit of each "removed" key plus the entry of each "new" one. Visually it's a full-row flash on every overflow, not a clean slide-in.

I caught this by walking the overflow case in my head before wiring animations. The fix was to extend `useWaitingList` to maintain a parallel `cohortIds: string[]` array, with a small `diffPositions()` function that updates IDs based on the operation (prepend new IDs on `add`, drop from the right on `take`, replace all on `create`/`reset`). Each cohort gets one stable ID for its lifetime. The same function is reused for the per-cohort color sequence — the diff logic is the load-bearing primitive for both identity and color.

The lesson: AI's reflex is to type the common pattern. For *animated* lists where elements appear at non-end positions, the common pattern is wrong and the bug is invisible to a static read.

### The second wrong moment — small, but worth keeping

While adding the "door" indicator on the right of the list, the model produced a 🚪 emoji. I caught my own slip from the project's own house rules (no emojis unless requested) and reverted to a glowing yellow bar in the same commit. Small, fast, but it's the kind of thing that survives if you're not reading every diff.

### What I wrote by hand and why

- **The `take()` algorithm.** Drain the rightmost cohort, prune if empty, loop until satisfied or empty. Small, load-bearing, central to correctness. The kind of code I want in my own head so I can defend every line.
- **The edge-case policy.** Throw on hard input errors (negative, non-integer, NaN, Infinity, `> MAX_N`); no-op on soft zeros; clamp on `take(n > total)`. The spec's "up to N" wording matched none of the AI's defaults — it would have either thrown on every off-nominal case or silently clamped everything. The shape we landed on was a judgment call, not a pattern-match.
- **The `Snapshot` ↔ mutable class boundary.** The model would have proposed either pure functions throughout or a class with mutable getters. The explicit `snapshot()` returning a fresh, immutable view on every call is the seam that lets React render predictably, lets storage serialize trivially, and would let a test suite assert on pure data. I picked this shape, then asked the model to type it.
- **The `diffPositions()` algorithm.** Stable per-cohort identity and color across add/take operations required me to deeply understand what each operation does to the array order. I worked through it on paper (`add` prepends K new IDs; `take` drops K from the right; `create`/`reset` replaces all). Once I had it in my head, typing it was trivial.
- **`TakeResult` discriminated union.** The shape `{ kind: 'served' | 'partial' | 'noop' }` is mine. The model would have left `take(): number` because that's what the spec implies. Adding the union meant the clamp case lives in the type system instead of in `taken < requested` math at every call site.
- **This writeup.** The earlier passes through it sounded like a generated artifact. This version is mine.

## Considerations for performance, structure, and future change

Things I thought about and either decided against, deferred, or shipped a specific tradeoff on:

- **`add()` replay on rehydration.** Restoring from `localStorage` rebuilds the class by calling `add()` from oldest to newest. O(n) in `total`, which is irrelevant at our scale and guarantees every cohort in memory has gone through validation. For a hot path with millions of creators I'd add a private `restore()` mutator, but that introduces a second trusted entry point I'd want to keep narrow.
- **Persistence write frequency.** Every operation triggers a `localStorage.setItem`. Fine for an interactive UI but wasteful if operations come in bursts. I'd add a debounced writer with a 100ms tail flush; never observable to a human, kills the work on rapid-fire input.
- **Bundle size.** ~91KB gzipped, ~75% of which is Framer Motion. The library earns its inclusion through `<AnimatePresence>` and `layout` animations, which are otherwise painful in React. For a production app I'd weigh code-splitting the animation paths or moving to a lighter alternative (`motion/react` lazy, or just CSS transitions for the simpler cases).
- **Schema versioning.** Storage went through v1 → v2 → v3 during this build. Each bump drops older payloads silently rather than migrating. A more sophisticated path would have a per-version parser chain (`v1Parse → v2Migrate → v3Migrate`) so a returning user never loses state on a schema change. Overkill for a take-home; reasonable for a real product.
- **Cohort virtualization.** The list is unvirtualized; it renders every cohort to the DOM. With our default capacity and a "large" waiting list of, say, a few hundred cohorts, that's fine. North of a few thousand and the `<AnimatePresence>` reconciliation costs would start showing — I'd switch to `react-window` and either freeze animations during scroll or only animate the cohorts in view.
- **Future hooks the type system leaves open.** `Cohort = { readonly count: number }` (instead of a bare `number`) lets us add `id`, `createdAt`, `tags`, or any other per-cohort metadata without breaking the public API. Same for `TakeResult` — the discriminated union has room to grow new kinds (e.g. `'rate-limited'`, `'queue-frozen'`) without changing callers that already handle the existing kinds exhaustively.
- **Cross-tab sync.** Two tabs open today is last-write-wins. The clean fix is a `storage` event listener that re-loads the snapshot when another tab writes; documented as a known limitation in the edge-case table instead of building it.
- **Accessibility.** ARIA labels are present on inputs and toggles; the picker popover announces expanded/collapsed via `aria-expanded`. Beyond that, I'd add a full keyboard map (`A`/`T`/`R` shortcuts to open pickers, arrow keys to navigate chips) before calling it production-ready.

## Project layout

```
src/
  main.tsx
  App.tsx
  styles.css
  core/
    index.ts          // public barrel
    types.ts          // Cohort, Snapshot, Op, TakeResult
    errors.ts         // three error classes
    validate.ts       // validateCapacity, validateCount
    WaitingList.ts    // the class
  storage/
    schema.ts         // STORAGE_KEY, Persisted, isPersisted validator
    persist.ts        // load, save, isStorageAvailable, clearStorage
  ui/
    SetupBar.tsx
    Stats.tsx           // total counter tweens via rAF
    Controls.tsx        // add / start onboarding / reset
    ListView.tsx        // AnimatePresence + layout, horizontally scrollable
    CohortBox.tsx       // dot grid + bar fallback, color from CSS vars
    PresetPicker.tsx    // popover picker with optional confirm step
    OnboardingPanel.tsx // "Currently onboarding" card list
    ServedFlash.tsx     // "+N onboarded" chip
    palette.ts          // 10-color cohort palette
    hooks/
      useWaitingList.ts // class-to-React boundary, per-cohort IDs + colors, persistence
docs/
  superpowers/
    specs/ 2026-06-24-cohort-waiting-list-design.md
    plans/ 2026-06-24-cohort-waiting-list.md
AI_NOTES.md             // scratch material that fed the AI section above
```
