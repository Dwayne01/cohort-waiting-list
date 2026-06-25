# AI scratch notes

Raw journal kept while building, fed the README's "Working with AI" section. Less polished, more chronological.

## Who typed what

The model typed every line of source. I drove. That sentence is the honest one-liner — the rest of this file is the texture behind it.

## Moments where the model helped (raw)

- **Bootstrap pivot.** I tried `npm create vite@^6 . --template react-ts` first. It blocked on the interactive package-name prompt. Two attempts, two timeouts. Switched to writing `package.json`, `vite.config.ts`, both `tsconfig`s, and the entry files directly. Faster than fighting the wizard.
- **Strict tsconfig.** Named the flags I wanted (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`) and got a clean tsconfig.app.json on the first try. The model also nudged me toward `moduleDetection: "force"` which I hadn't planned to set.
- **Validator.** Described the persisted-state invariants in plain English (capacity ≥ 1, every cohort count in `[1, capacity]`, total equals sum, color-seq parallel to cohorts). Got an exhaustive `isPersisted()` on the first try. Read it carefully; it was right.
- **Verification harness.** Wanted a scratch script that exercised the spec walkthrough + every input-validation branch. The model produced 36 assertions with a tiny `expect()` helper. All passed. Deleted before the final commit because no tests was a deliberate scope decision.
- **Playwright on demand.** Mid-build I asked it to install Playwright in `/tmp/cohort-verify`, drive the app headless, and screenshot key states. Each verification was a single self-contained script. Caught real visual issues I'd have missed by squinting at HMR.
- **Spring physics.** I had a verbal target ("a stream filling in, not a flash"). Got a starting point of `stiffness: 380, damping: 28`. Watched the browser, dialed in.

## Moments where I overrode

- **Per-batch vs per-cohort color.** The model's first proposal for color-coding was per-batch — each add operation gets a color that travels with the individual creators. Plausible. But the Ops mental model is *a cohort at a time*, not "track this batch's individual creators across cohort boundaries." I asked for per-cohort instead. Simpler code, simpler UI, semantically right.
- **No tests.** The model was happy to scaffold vitest + fast-check. I cut it for time and called it a tradeoff in the writeup. The first thing I'd add with another hour.
- **Number inputs.** First UI cut had three `<input type=number>` fields with submit buttons. I asked for a single picker button per action that reveals a popover with preset chips. Then trimmed the preset list from `[1, 3, 5, 10, 25, 100]` to `[1, 3, 5, 10]` on a second pass.
- **Spec-default labels.** Model used "Take" (spec language). I renamed throughout to "Start onboarding" because the brief is about Ops onboarding creators, not about a generic queue. Same instinct drove "next in line", "+N onboarded", and the "Currently onboarding" panel — the words have to match the work.
- **Dot fill direction.** First render filled dots from the left. I asked for right-to-left to match the queue metaphor (front of line near the door). Model added the swap. Then I noticed the stagger animated left-to-right, which read wrong — asked for the stagger order to reverse too. Both fixes were small, but neither happened without me looking at the rendered output.
- **Cohort packing.** First version had cohorts left-justified inside the row. When the rightmost cohort emptied, the rest stayed pinned left and a gap opened on the right. Asked for right-justify so cohorts shuffle toward the door as the queue advances. That created an overflow-scroll issue — model used `justify-content: flex-end` which clipped overflowing left content. Refactored to a `.list-scroll` wrapper with `margin-left: auto` on the first child. Horizontal scroll works now.

## Two sloppy moments worth keeping

1. **`key={i}` on cohorts inside `<AnimatePresence>`.** The React-default reflex. Looks right; it's not. When `add()` overflows and prepends a new cohort, every existing cohort's positional index shifts by one. React reconciles by key, so each existing cohort is seen as a new element under a new key — and AnimatePresence dutifully animates the exit of each "removed" key plus the entry of each "new" one. On every overflow, the whole row flashes instead of cleanly sliding. I caught it before wiring the animations by walking the overflow case in my head. Fix: parallel `cohortIds: string[]` array maintained in the hook via a `diffPositions()` function that updates IDs based on the operation. Each cohort gets a stable synthetic ID for its lifetime. The same primitive is reused for the per-cohort color-seq array — `diffPositions<T>` ended up generic.

2. **The door emoji.** Adding the door indicator on the right of the queue, the model produced 🚪. The project rule is no emojis unless requested. Caught it the same diff, reverted to a glowing yellow bar. Trivial in itself, but the kind of thing that survives if you're not reading every change before commit.

## Things I had to choose, not type

- `Snapshot` vs leaking the mutable class to consumers. Either pure functions throughout or a class with mutable getters would have been plausible defaults from the model. The third option — keep the class mutable internally, expose only `snapshot()` returning a fresh immutable view — is the seam that lets React render predictably, lets storage serialize trivially, and would let a test suite assert on pure data.
- `TakeResult` discriminated union. The model would have left `take(): number` because that's what the spec implies. Replacing it with `{ kind: 'served' | 'partial' | 'noop' }` puts the clamp case in the type system. The notice banner branches on `result.kind` instead of `taken < requested`.
- Edge-case policy. Throw on hard input errors, no-op on soft zeros, clamp on `take(n > total)`. AI defaults: "throw on everything" or "silently clamp everything." Neither matched the spec's "up to N" wording. Had to articulate the third path and ask for it.
- Storage schema versioning. v1 → v2 (removed log) → v3 (added colorSeqs + onboardings). Each bump silently drops older payloads rather than migrating. For a take-home that's fine; for a real product I'd add a per-version parser chain.

## Writing the writeup

The first draft of the README's "Working with AI" section was a generic version the model produced from a template. It read like the spec's example prompts back at the reviewer. Rewrote it from scratch using these notes as raw material. The version in `README.md` is the result of that rewrite; this file is what fed it.
