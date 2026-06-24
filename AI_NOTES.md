# AI scratch notes (draft material for the README)

## Where AI helped

- Bootstrapping Vite + React + TS + Framer Motion + strict tsconfig. The non-interactive `npm create vite` wizard kept blocking on the package-name prompt, so the assistant pivoted to writing the bootstrap files directly. Faster, fewer surprises.
- Sketching the dot-grid and capacity-bar markup, then iterating on the spring physics for the cohort enter/exit (`stiffness: 380, damping: 28` felt right after a couple of tries).
- Generating the exhaustive `isPersisted` validator from a verbal description of the invariants. Faster than hand-writing the property checks.
- Writing the scratch verification script with `expect` helpers — 36 assertions covering the spec example flow, capacity-1 edge case, and every input-validation branch.

## Where AI was wrong (the concrete moment)

The first version of `ListView` used `key={i}` for each cohort inside `<AnimatePresence>`. This looks right but breaks the animation: when `add()` overflow prepends a new cohort, every existing cohort's positional index changes, so React sees each key as belonging to a "new" element. AnimatePresence then animates *every* cohort's exit and re-entry — visually it's a flash, not a slide.

I caught this before wiring the animations by reasoning through what would happen on overflow. The fix was to extend `useWaitingList` to maintain a parallel `cohortIds: string[]` array and diff it against the previous snapshot on every operation (`nextIds()`). Each cohort gets a stable synthetic ID for its full lifetime; AnimatePresence only fires enter/exit on truly new or pruned cohorts.

The lesson: AI defaults to "use the index" for React keys because that's the most common pattern. For animation-heavy lists where elements are inserted in the middle or at non-end positions, that default produces visible bugs.

## What I wrote by hand and why

- The `take()` algorithm (drain right, prune, repeat) — small, load-bearing, central to correctness. Worth holding in my head.
- The edge-case decision policy: throw on hard errors, no-op on soft zeros, clamp on `take(n > total)`. AI's defaults trended toward either "throw on every off-nominal" or "silently clamp everything." The spec's "up to N" wording forced a specific shape that wasn't AI's first instinct.
- The Snapshot vs. mutable class boundary. AI would have proposed either pure functions throughout or a mutable class with mutable getters; the explicit `snapshot()` method that returns a fresh, immutable view on every call is the seam that makes React + persistence + future testability all easy.
- The synthetic-ID diff logic in `nextIds()` — needed to deeply understand what each operation does to the cohort array before writing it. AI would have written it correctly if asked, but I wanted to verify the invariants myself first.
