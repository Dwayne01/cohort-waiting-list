# Cohort Waiting List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page TypeScript app that manages one FIFO cohort waiting list with add / take / total / reset, persisted to localStorage, with engaging Framer Motion animations.

**Architecture:** Layered single-package Vite project: `src/core/` (pure TS class + types, the centerpiece for grading), `src/storage/` (localStorage codec with graceful failure), `src/ui/` (React + Framer Motion components consuming an immutable `Snapshot`). The mutable class lives in a `ref`; React renders from snapshots only.

**Tech Stack:** Node 22.11.0 (via nvm), Vite 6, React 18, TypeScript (strict + `noUncheckedIndexedAccess`), Framer Motion, plain CSS (no Tailwind). No test framework — edge cases documented in README per spec.

## Global Constraints

- **Node version:** 22.11.0 (pinned via `.nvmrc`). All `npm`/`node` commands must run after `source ~/.nvm/nvm.sh && nvm use`.
- **TypeScript strict** plus `noUncheckedIndexedAccess: true` — array index access returns `T | undefined`.
- **Public surface of `core/`** never leaks the mutable class to the UI — only `Snapshot`. UI/storage never `import { WaitingList }` for read paths; they consume `Snapshot`. (`useWaitingList` is the one exception that holds the class in a ref.)
- **No test suite.** Manual verification through the running app + a one-time `node --import tsx` scratch script for the core (deleted before final commit).
- **Cohort capacity max for dot rendering:** 50. Above that, the UI swaps to a fill bar.
- **`WaitingList.MAX_N` = 1_000_000.**
- **Operation log:** keep exactly the most recent 20 entries.
- **localStorage key:** `cohort-waitlist:v1`. Bump the version suffix on any schema change.
- **Working directory:** `/Users/dwayne/Documents/Dev/elective-cohort-waitlist` (already created, `git init`-ed, with spec committed).
- **Commit messages:** Imperative mood, scope-prefixed (`core:`, `ui:`, `storage:`, `docs:`, `chore:`). Include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.

---

## Task 1: Bootstrap Vite + React + TS project

**Files:**
- Create: `.nvmrc`
- Create: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: a runnable `npm run dev` that serves a near-empty App at http://localhost:5173

- [ ] **Step 1: Pin Node version**

```bash
cd /Users/dwayne/Documents/Dev/elective-cohort-waitlist
echo "22.11.0" > .nvmrc
source ~/.nvm/nvm.sh && nvm use
node --version  # expect v22.11.0
```

- [ ] **Step 2: Scaffold Vite project in-place**

```bash
cd /Users/dwayne/Documents/Dev/elective-cohort-waitlist
source ~/.nvm/nvm.sh && nvm use
npm create vite@^6 . -- --template react-ts
# Accept overwrite prompts? There should be none — directory only has docs/ and .git/.
# When asked about non-empty directory, choose "Ignore files and continue" if prompted.
```

Expected: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/` populated.

- [ ] **Step 3: Install deps**

```bash
source ~/.nvm/nvm.sh && nvm use
npm install
npm install framer-motion@^11
```

- [ ] **Step 4: Tighten tsconfig**

Replace `tsconfig.json` content with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Replace template App and CSS with a placeholder**

`src/App.tsx`:
```tsx
import './styles.css';

export default function App() {
  return (
    <main className="app">
      <h1>Cohort Waiting List</h1>
      <p>Bootstrapping…</p>
    </main>
  );
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/styles.css`:
```css
:root {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  color-scheme: light;
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { background: #f6f7fb; color: #1d2330; }

.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px 64px;
}

h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: -0.01em; }
```

Delete: `src/App.css`, `src/index.css`, `src/assets/react.svg`, `public/vite.svg` (if present).

- [ ] **Step 6: Verify dev server**

```bash
source ~/.nvm/nvm.sh && nvm use
npm run dev
```

Expected: server starts on http://localhost:5173 showing "Cohort Waiting List / Bootstrapping…". Stop with Ctrl-C.

- [ ] **Step 7: Type-check**

```bash
source ~/.nvm/nvm.sh && nvm use
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Vite + React + TS + Framer Motion

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Core types and error classes

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/errors.ts`
- Create: `src/core/index.ts` (barrel)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `Cohort = { readonly count: number }`
  - `Snapshot = { readonly capacity: number; readonly cohorts: readonly Cohort[]; readonly total: number }`
  - `Op = 'create' | 'add' | 'take' | 'reset'`
  - `LogEntry = { readonly op: Op; readonly n: number; readonly at: number }`
  - `InvalidCapacityError`, `InvalidCountError`, `NonIntegerCountError`

- [ ] **Step 1: Write `src/core/types.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/core/errors.ts`**

```ts
export class InvalidCapacityError extends RangeError {
  constructor(value: unknown) {
    super(`Invalid capacity: ${String(value)}. Capacity must be a positive integer.`);
    this.name = 'InvalidCapacityError';
  }
}

export class InvalidCountError extends RangeError {
  constructor(value: unknown, max: number) {
    super(
      `Invalid count: ${String(value)}. Count must be a finite integer in [0, ${max}].`,
    );
    this.name = 'InvalidCountError';
  }
}

export class NonIntegerCountError extends TypeError {
  constructor(value: unknown) {
    super(`Non-integer count: ${String(value)}. Creators are discrete.`);
    this.name = 'NonIntegerCountError';
  }
}
```

- [ ] **Step 3: Write `src/core/index.ts`**

```ts
export type { Cohort, Snapshot, Op, LogEntry } from './types';
export {
  InvalidCapacityError,
  InvalidCountError,
  NonIntegerCountError,
} from './errors';
export { WaitingList } from './WaitingList';
```

(`WaitingList` is added in Task 3; this barrel will fail to type-check until then. That's expected and noted.)

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts src/core/errors.ts src/core/index.ts
git commit -m "core: add Snapshot/Cohort/LogEntry types and typed error classes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `WaitingList` class — validation, constructor, getters, snapshot

**Files:**
- Create: `src/core/validate.ts`
- Create: `src/core/WaitingList.ts`

**Interfaces:**
- Consumes: `Cohort`, `Snapshot` from `./types`; error classes from `./errors`
- Produces:
  - `validateCapacity(c: unknown): number` — throws `InvalidCapacityError` on bad input, returns the validated integer
  - `validateCount(n: unknown, max: number): number` — throws `InvalidCountError` or `NonIntegerCountError`
  - `class WaitingList` with:
    - `static readonly MAX_N: 1_000_000`
    - `constructor(capacity?: number)` (default 10)
    - `get total(): number`
    - `get capacity(): number`
    - `snapshot(): Snapshot`
    - (`add`/`take` come in Tasks 4 and 5)

- [ ] **Step 1: Write `src/core/validate.ts`**

```ts
import {
  InvalidCapacityError,
  InvalidCountError,
  NonIntegerCountError,
} from './errors';

export function validateCapacity(c: unknown): number {
  if (typeof c !== 'number' || !Number.isFinite(c)) {
    throw new InvalidCapacityError(c);
  }
  if (!Number.isInteger(c)) {
    throw new InvalidCapacityError(c);
  }
  if (c < 1) {
    throw new InvalidCapacityError(c);
  }
  return c;
}

export function validateCount(n: unknown, max: number): number {
  if (typeof n !== 'number' || Number.isNaN(n) || !Number.isFinite(n)) {
    throw new InvalidCountError(n, max);
  }
  if (!Number.isInteger(n)) {
    throw new NonIntegerCountError(n);
  }
  if (n < 0 || n > max) {
    throw new InvalidCountError(n, max);
  }
  return n;
}
```

Note: `InvalidCapacityError` is thrown for non-integer capacity too (no separate `NonIntegerCapacityError` — the constructor takes one shape of input from the UI; the edge-case table groups them).

- [ ] **Step 2: Write `src/core/WaitingList.ts` (constructor + getters + snapshot only)**

```ts
import type { Cohort, Snapshot } from './types';
import { validateCapacity } from './validate';

export class WaitingList {
  static readonly MAX_N = 1_000_000;

  readonly #capacity: number;
  #cohorts: Cohort[] = [];     // newest at index 0; oldest at last
  #total = 0;

  constructor(capacity: number = 10) {
    this.#capacity = validateCapacity(capacity);
  }

  get total(): number {
    return this.#total;
  }

  get capacity(): number {
    return this.#capacity;
  }

  snapshot(): Snapshot {
    return {
      capacity: this.#capacity,
      cohorts: this.#cohorts.map((c) => ({ count: c.count })),
      total: this.#total,
    };
  }

  // add() — Task 4
  // take() — Task 5
}
```

Note: `snapshot()` returns a freshly mapped array of fresh `Cohort` objects. This guarantees React sees a new reference on every change and that consumers can't mutate the internal state through the returned snapshot.

- [ ] **Step 3: Type-check**

```bash
source ~/.nvm/nvm.sh && nvm use
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke-verify with a scratch script**

Create `scratch.mjs` at the project root (temporary; deleted at end of Task 5):

```js
import { WaitingList, InvalidCapacityError } from './src/core/index.ts';

const wl = new WaitingList();
console.log('default capacity:', wl.capacity, '== 10');
console.log('total:', wl.total, '== 0');
console.log('snapshot:', wl.snapshot());

try {
  new WaitingList(0);
} catch (e) {
  console.log('expected throw on 0:', e instanceof InvalidCapacityError, e.message);
}
try {
  new WaitingList(2.5);
} catch (e) {
  console.log('expected throw on 2.5:', e instanceof InvalidCapacityError, e.message);
}
```

Run:
```bash
source ~/.nvm/nvm.sh && nvm use
npx tsx scratch.mjs
```

Expected:
```
default capacity: 10 == 10
total: 0 == 0
snapshot: { capacity: 10, cohorts: [], total: 0 }
expected throw on 0: true Invalid capacity: 0. Capacity must be a positive integer.
expected throw on 2.5: true Invalid capacity: 2.5. Capacity must be a positive integer.
```

- [ ] **Step 5: Commit**

```bash
git add src/core/validate.ts src/core/WaitingList.ts
git commit -m "core: WaitingList constructor + validation + snapshot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `WaitingList.add(n)`

**Files:**
- Modify: `src/core/WaitingList.ts`

**Interfaces:**
- Consumes: `validateCount` from `./validate`; `MAX_N` static
- Produces: `add(n: number): void`. Mutates internal state; no return.

Algorithm: `n=0` is a validated no-op. Otherwise: fill the leftmost cohort (index 0) up to capacity, then prepend full cohorts for each `capacity`-sized chunk, then prepend a partial cohort for any remainder.

- [ ] **Step 1: Add `add()` to `WaitingList.ts`**

In `src/core/WaitingList.ts`, replace the `// add() — Task 4` comment with:

```ts
  add(n: number): void {
    validateCount(n, WaitingList.MAX_N);
    if (n === 0) return;

    let remaining = n;

    // Fill the leftmost (newest) cohort first, if it has room.
    const first = this.#cohorts[0];
    if (first && first.count < this.#capacity) {
      const room = this.#capacity - first.count;
      const fill = Math.min(room, remaining);
      this.#cohorts[0] = { count: first.count + fill };
      remaining -= fill;
    }

    // Prepend full cohorts.
    while (remaining >= this.#capacity) {
      this.#cohorts.unshift({ count: this.#capacity });
      remaining -= this.#capacity;
    }

    // Prepend a partial cohort for any leftover.
    if (remaining > 0) {
      this.#cohorts.unshift({ count: remaining });
    }

    this.#total += n;
  }
```

Add `import { validateCount } from './validate';` at the top (next to the existing `validateCapacity` import).

- [ ] **Step 2: Type-check**

```bash
source ~/.nvm/nvm.sh && nvm use
npx tsc --noEmit
```

- [ ] **Step 3: Smoke-verify with the spec's example flow**

Replace `scratch.mjs` with:

```js
import { WaitingList } from './src/core/index.ts';

const wl = new WaitingList(10);
console.log('start:', wl.snapshot().cohorts.map((c) => c.count), '== []');

wl.add(3);
console.log('add(3):', wl.snapshot().cohorts.map((c) => c.count), '== [3]');

wl.add(13);
console.log('add(13):', wl.snapshot().cohorts.map((c) => c.count), '== [6, 10]');

wl.add(22);
console.log('add(22):', wl.snapshot().cohorts.map((c) => c.count), '== [8, 10, 10, 10]');

console.log('total:', wl.total, '== 38');

// Boundary checks
const a = new WaitingList(10);
a.add(0);
console.log('add(0) no-op:', a.total, '== 0', a.snapshot().cohorts.length, '== 0');

a.add(10);
console.log('add(10) exact fill:', a.snapshot().cohorts.map((c) => c.count), '== [10]');

const b = new WaitingList(10);
b.add(30);
console.log('add(30) on empty:', b.snapshot().cohorts.map((c) => c.count), '== [10, 10, 10]');

try { new WaitingList(10).add(-1); } catch (e) { console.log('add(-1) threw:', e.name); }
try { new WaitingList(10).add(2.5); } catch (e) { console.log('add(2.5) threw:', e.name); }
try { new WaitingList(10).add(Number.MAX_SAFE_INTEGER); } catch (e) { console.log('add(huge) threw:', e.name); }
try { new WaitingList(10).add(NaN); } catch (e) { console.log('add(NaN) threw:', e.name); }
```

Run:
```bash
source ~/.nvm/nvm.sh && nvm use
npx tsx scratch.mjs
```

Expected output matches the prompt's example: `[3]`, `[6, 10]`, `[8, 10, 10, 10]`. Errors thrown as `InvalidCountError` / `NonIntegerCountError` / `InvalidCountError` / `InvalidCountError`.

- [ ] **Step 4: Commit**

```bash
git add src/core/WaitingList.ts
git commit -m "core: implement WaitingList.add with overflow into new cohorts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `WaitingList.take(n)`

**Files:**
- Modify: `src/core/WaitingList.ts`

**Interfaces:**
- Consumes: `validateCount`
- Produces: `take(n: number): number` — returns the count actually taken (clamped to `total`).

Algorithm: validate; `n=0` returns 0; otherwise drain the rightmost cohort by min(remaining, cohort.count), prune if empty, loop until done or list empty.

- [ ] **Step 1: Add `take()` to `WaitingList.ts`**

Replace the `// take() — Task 5` comment with:

```ts
  take(n: number): number {
    validateCount(n, WaitingList.MAX_N);
    if (n === 0) return 0;

    let taken = 0;
    let remaining = n;

    while (remaining > 0 && this.#cohorts.length > 0) {
      const lastIndex = this.#cohorts.length - 1;
      const last = this.#cohorts[lastIndex]!;     // length > 0 guarantees defined
      const drain = Math.min(last.count, remaining);

      if (drain === last.count) {
        this.#cohorts.pop();                       // prune empty
      } else {
        this.#cohorts[lastIndex] = { count: last.count - drain };
      }

      taken += drain;
      remaining -= drain;
    }

    this.#total -= taken;
    return taken;
  }
```

The `!` non-null assertion is safe here because we just checked `length > 0`. With `noUncheckedIndexedAccess`, TS otherwise can't tell.

- [ ] **Step 2: Type-check**

```bash
source ~/.nvm/nvm.sh && nvm use
npx tsc --noEmit
```

- [ ] **Step 3: Smoke-verify with the spec's example flow**

Update `scratch.mjs` to:

```js
import { WaitingList } from './src/core/index.ts';

const wl = new WaitingList(10);
wl.add(3);
wl.add(13);
wl.add(22);   // → [8, 10, 10, 10]

console.log('start:', wl.snapshot().cohorts.map((c) => c.count), '== [8, 10, 10, 10]');

console.log('take(4):', wl.take(4), '== 4');
console.log('after:', wl.snapshot().cohorts.map((c) => c.count), '== [8, 10, 10, 6]');

console.log('take(7):', wl.take(7), '== 7');
console.log('after:', wl.snapshot().cohorts.map((c) => c.count), '== [8, 10, 9]');

console.log('total:', wl.total, '== 27');

console.log('take(20):', wl.take(20), '== 20');
console.log('after:', wl.snapshot().cohorts.map((c) => c.count), '== [7]');

console.log('total:', wl.total, '== 7');

// Boundary: take more than available
console.log('take(99):', wl.take(99), '== 7');
console.log('after:', wl.snapshot().cohorts.map((c) => c.count), '== []');
console.log('total:', wl.total, '== 0');

// take(0) is a no-op
console.log('take(0):', wl.take(0), '== 0');

// take on empty list
console.log('take(5) on empty:', wl.take(5), '== 0');

// Capacity = 1
const c1 = new WaitingList(1);
c1.add(5);
console.log('cap1 add(5):', c1.snapshot().cohorts.map((c) => c.count), '== [1,1,1,1,1]');
console.log('cap1 take(3):', c1.take(3), '== 3');
console.log('cap1 after:', c1.snapshot().cohorts.map((c) => c.count), '== [1,1]');
```

Run:
```bash
source ~/.nvm/nvm.sh && nvm use
npx tsx scratch.mjs
```

Expected: every line matches the `==` annotation.

- [ ] **Step 4: Delete scratch script**

```bash
rm scratch.mjs
```

- [ ] **Step 5: Commit**

```bash
git add src/core/WaitingList.ts
git commit -m "core: implement WaitingList.take with drain-right + prune

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: localStorage persistence

**Files:**
- Create: `src/storage/schema.ts`
- Create: `src/storage/persist.ts`

**Interfaces:**
- Consumes: `Snapshot`, `LogEntry` from `../core`
- Produces:
  - `STORAGE_KEY = 'cohort-waitlist:v1'`
  - `type Persisted = { version: 1; snapshot: Snapshot; log: LogEntry[] }`
  - `isStorageAvailable(): boolean`
  - `load(): { snapshot: Snapshot; log: LogEntry[] } | null` — returns null on absent / corrupt / invalid / version-mismatched data
  - `save(snapshot: Snapshot, log: LogEntry[]): boolean` — returns false on quota / unavailable

- [ ] **Step 1: Write `src/storage/schema.ts`**

```ts
import type { Snapshot, LogEntry } from '../core';

export const STORAGE_KEY = 'cohort-waitlist:v1';
export const SCHEMA_VERSION = 1 as const;

export type Persisted = {
  version: typeof SCHEMA_VERSION;
  snapshot: Snapshot;
  log: LogEntry[];
};

export function isPersisted(value: unknown): value is Persisted {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v['version'] !== SCHEMA_VERSION) return false;

  const snap = v['snapshot'] as Record<string, unknown> | undefined;
  if (!snap) return false;
  if (typeof snap['capacity'] !== 'number' || !Number.isInteger(snap['capacity']) || snap['capacity'] < 1) return false;
  if (typeof snap['total'] !== 'number' || !Number.isInteger(snap['total']) || snap['total'] < 0) return false;
  if (!Array.isArray(snap['cohorts'])) return false;

  const capacity = snap['capacity'] as number;
  let total = 0;
  for (const c of snap['cohorts'] as unknown[]) {
    if (typeof c !== 'object' || c === null) return false;
    const count = (c as Record<string, unknown>)['count'];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > capacity) return false;
    total += count;
  }
  if (total !== snap['total']) return false;

  if (!Array.isArray(v['log'])) return false;
  for (const e of v['log']) {
    if (typeof e !== 'object' || e === null) return false;
    const entry = e as Record<string, unknown>;
    if (!['create','add','take','reset'].includes(entry['op'] as string)) return false;
    if (typeof entry['n'] !== 'number') return false;
    if (typeof entry['at'] !== 'number') return false;
  }

  return true;
}
```

This validator is intentionally exhaustive — it's how we make "bail to fresh state on corrupt data" actually safe.

- [ ] **Step 2: Write `src/storage/persist.ts`**

```ts
import type { Snapshot, LogEntry } from '../core';
import { STORAGE_KEY, SCHEMA_VERSION, isPersisted } from './schema';

export function isStorageAvailable(): boolean {
  try {
    const probe = '__cohort_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function load(): { snapshot: Snapshot; log: LogEntry[] } | null {
  if (!isStorageAvailable()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPersisted(parsed)) return null;

  return { snapshot: parsed.snapshot, log: parsed.log };
}

export function save(snapshot: Snapshot, log: LogEntry[]): boolean {
  if (!isStorageAvailable()) return false;

  const payload: { version: typeof SCHEMA_VERSION; snapshot: Snapshot; log: LogEntry[] } = {
    version: SCHEMA_VERSION,
    snapshot,
    log,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearStorage(): void {
  if (!isStorageAvailable()) return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
}
```

- [ ] **Step 3: Type-check**

```bash
source ~/.nvm/nvm.sh && nvm use
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/storage
git commit -m "storage: add localStorage codec with invariant validation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `useWaitingList` hook (the class-to-React boundary)

**Files:**
- Create: `src/ui/hooks/useWaitingList.ts`

**Interfaces:**
- Consumes: `WaitingList`, `Snapshot`, `LogEntry`, `Op`, error classes from `../../core`; `load`, `save`, `isStorageAvailable` from `../../storage/persist`
- Produces: `useWaitingList()` returning:
  - `state: 'uninitialized' | 'ready'`
  - `snapshot: Snapshot | null`
  - `log: readonly LogEntry[]`
  - `persisting: boolean` — false when localStorage is unavailable
  - `lastError: string | null` — for surfacing input errors to the UI
  - `ensure(capacity: number): void` — first-time create; called from `SetupBar`
  - `add(n: number): void`
  - `take(n: number): number` — returns count actually taken (for ServedFlash)
  - `reset(capacity?: number): void` — defaults to current capacity
  - `clearError(): void`

- [ ] **Step 1: Write `src/ui/hooks/useWaitingList.ts`**

```ts
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

export function useWaitingList() {
  const ref = useRef<WaitingList | null>(null);
  const persisting = useRef<boolean>(isStorageAvailable()).current;
  const [state, setState] = useState<State>(() => {
    if (!persisting) return { kind: 'uninitialized' };
    const restored = load();
    if (!restored) return { kind: 'uninitialized' };

    const wl = new WaitingList(restored.snapshot.capacity);
    // Rebuild internal cohorts by replaying the snapshot's totals. The validator
    // guarantees each cohort is within [1, capacity], so adding by capacity-sized
    // chunks reconstructs the same shape without needing a private mutator.
    for (const cohort of [...restored.snapshot.cohorts].reverse()) {
      // Reverse so we add the oldest first; add() prepends new cohorts, so the
      // resulting array preserves newest-on-left ordering.
      wl.add(cohort.count);
    }
    return { kind: 'ready', snapshot: wl.snapshot(), log: restored.log };
  });

  // Adopt the restored class instance on first render.
  useEffect(() => {
    if (state.kind === 'ready' && ref.current === null) {
      const wl = new WaitingList(state.snapshot.capacity);
      for (const cohort of [...state.snapshot.cohorts].reverse()) {
        wl.add(cohort.count);
      }
      ref.current = wl;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [lastError, setLastError] = useState<string | null>(null);

  function emit(op: Op, n: number, prevLog: readonly LogEntry[]): LogEntry[] {
    if (n <= 0) return [...prevLog];
    const entry: LogEntry = { op, n, at: Date.now() };
    return [entry, ...prevLog].slice(0, LOG_LIMIT);
  }

  function commit(op: Op, n: number) {
    if (ref.current === null) return;
    const snap = ref.current.snapshot();
    setState((prev) => {
      const prevLog = prev.kind === 'ready' ? prev.log : [];
      const log = emit(op, n, prevLog);
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
      commit('create', capacity);
    });
  }

  function add(n: number) {
    if (ref.current === null) return;
    tryDo(() => {
      ref.current!.add(n);
      commit('add', n);
    });
  }

  function take(n: number): number {
    if (ref.current === null) return 0;
    const result = tryDo(() => {
      const taken = ref.current!.take(n);
      commit('take', taken);
      return taken;
    });
    return result ?? 0;
  }

  function reset(capacity?: number) {
    const cap = capacity ?? ref.current?.capacity ?? 10;
    tryDo(() => {
      ref.current = new WaitingList(cap);
      // Reset clears the log too.
      const snap = ref.current.snapshot();
      const log = emit('reset', cap, []);
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
```

Note on the restore loop: because we don't expose a private `setCohorts` mutator, restoring is done by replaying `add()` from oldest to newest. This preserves the invariants and means there's no "trusted" path into the class — every cohort that exists has gone through validation. The tradeoff is restore is O(n) in `total`, which for our scale is fine.

- [ ] **Step 2: Type-check**

```bash
source ~/.nvm/nvm.sh && nvm use
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useWaitingList.ts
git commit -m "ui: useWaitingList hook bridging mutable class to React + persistence

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Static UI shell — `App`, `SetupBar`, `Stats`, `Controls`

**Files:**
- Modify: `src/App.tsx`
- Create: `src/ui/SetupBar.tsx`
- Create: `src/ui/Stats.tsx`
- Create: `src/ui/Controls.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `useWaitingList` from `./hooks/useWaitingList`
- Produces: a working page where you can create a list, add, take, and see total and cohort counts as raw text (no animations yet).

- [ ] **Step 1: Write `src/ui/SetupBar.tsx`**

```tsx
import { useState } from 'react';

export function SetupBar({ onCreate }: { onCreate: (capacity: number) => void }) {
  const [value, setValue] = useState('10');
  const capacity = Number(value);
  const valid = Number.isInteger(capacity) && capacity >= 1;

  return (
    <section className="card">
      <h2>Create a waiting list</h2>
      <p className="muted">Cohort capacity (default 10):</p>
      <div className="row">
        <input
          type="number"
          min={1}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Cohort capacity"
        />
        <button
          disabled={!valid}
          onClick={() => onCreate(capacity)}
        >
          Create list
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `src/ui/Stats.tsx`**

```tsx
import type { Snapshot } from '../core';

export function Stats({ snapshot }: { snapshot: Snapshot }) {
  return (
    <section className="stats">
      <div><span className="stat-label">Total waiting</span><span className="stat-value">{snapshot.total}</span></div>
      <div><span className="stat-label">Cohorts</span><span className="stat-value">{snapshot.cohorts.length}</span></div>
      <div><span className="stat-label">Capacity</span><span className="stat-value">{snapshot.capacity}</span></div>
    </section>
  );
}
```

- [ ] **Step 3: Write `src/ui/Controls.tsx`**

```tsx
import { useState } from 'react';
import type { Snapshot } from '../core';

type Props = {
  snapshot: Snapshot;
  onAdd: (n: number) => void;
  onTake: (n: number) => void;
  onReset: (capacity?: number) => void;
};

export function Controls({ snapshot, onAdd, onTake, onReset }: Props) {
  const [addText, setAddText] = useState('1');
  const [takeText, setTakeText] = useState('1');
  const [resetText, setResetText] = useState(String(snapshot.capacity));

  const addN = Number(addText);
  const takeN = Number(takeText);
  const resetCap = Number(resetText);

  const canAdd = Number.isInteger(addN) && addN > 0;
  const canTake = Number.isInteger(takeN) && takeN > 0 && snapshot.total > 0;
  const canReset = Number.isInteger(resetCap) && resetCap >= 1;

  return (
    <section className="controls">
      <div className="row">
        <input
          type="number" min={0} step={1}
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          aria-label="Add count"
        />
        <button disabled={!canAdd} onClick={() => onAdd(addN)}>Add</button>
      </div>
      <div className="row">
        <input
          type="number" min={0} step={1}
          value={takeText}
          onChange={(e) => setTakeText(e.target.value)}
          aria-label="Take count"
        />
        <button disabled={!canTake} onClick={() => onTake(takeN)}>Take</button>
      </div>
      <div className="row">
        <input
          type="number" min={1} step={1}
          value={resetText}
          onChange={(e) => setResetText(e.target.value)}
          aria-label="Reset capacity"
        />
        <button disabled={!canReset} onClick={() => onReset(resetCap)}>Reset</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Rewrite `src/App.tsx`**

```tsx
import { useWaitingList } from './ui/hooks/useWaitingList';
import { SetupBar } from './ui/SetupBar';
import { Stats } from './ui/Stats';
import { Controls } from './ui/Controls';
import './styles.css';

export default function App() {
  const wl = useWaitingList();

  return (
    <main className="app">
      <header>
        <h1>Cohort Waiting List</h1>
        {!wl.persisting && (
          <span className="badge">Not persisting (localStorage unavailable)</span>
        )}
      </header>

      {wl.lastError && (
        <div className="error" role="alert" onClick={wl.clearError}>
          {wl.lastError} <span className="muted">(click to dismiss)</span>
        </div>
      )}

      {wl.snapshot === null ? (
        <SetupBar onCreate={wl.ensure} />
      ) : (
        <>
          <Stats snapshot={wl.snapshot} />
          <Controls
            snapshot={wl.snapshot}
            onAdd={wl.add}
            onTake={wl.take}
            onReset={wl.reset}
          />
          <section className="raw">
            <p className="muted">Raw cohorts (newest → oldest):</p>
            <code>[{wl.snapshot.cohorts.map((c) => c.count).join(', ')}]</code>
          </section>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Extend `src/styles.css`**

Append:

```css
header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }

.badge {
  display: inline-block; padding: 4px 10px; border-radius: 999px;
  background: #fff5d6; color: #7a5a00; font-size: 12px; font-weight: 600;
}

.error {
  margin: 12px 0; padding: 12px 14px; border-radius: 10px;
  background: #fde7e7; color: #8a1a1a; cursor: pointer;
}

.muted { color: #6b7280; font-size: 13px; }

.card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 20px; max-width: 480px;
}
.card h2 { margin: 0 0 6px; font-size: 18px; }

.stats {
  display: flex; gap: 24px; padding: 14px 18px; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 14px;
}
.stats > div { display: flex; flex-direction: column; gap: 2px; }
.stat-label { font-size: 12px; color: #6b7280; }
.stat-value { font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }

.controls {
  display: grid; grid-template-columns: repeat(3, minmax(180px, 1fr));
  gap: 12px; margin-bottom: 18px;
}
.row { display: flex; gap: 8px; }
input[type="number"] { flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; }
button {
  padding: 8px 14px; border: none; border-radius: 8px; background: #1f2937;
  color: #fff; font: inherit; cursor: pointer;
}
button:disabled { background: #9ca3af; cursor: not-allowed; }

.raw { margin-top: 18px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.raw code { background: #fff; padding: 8px 12px; border-radius: 8px; border: 1px solid #e5e7eb; }
```

- [ ] **Step 6: Verify in browser**

```bash
source ~/.nvm/nvm.sh && nvm use
npm run dev
```

Open http://localhost:5173. Manual checks:
- Create with capacity 10 → SetupBar disappears, Stats shows 0/0/10
- Add 3 → raw shows `[3]`, total = 3
- Add 13 → raw shows `[6, 10]`, total = 16
- Add 22 → raw shows `[8, 10, 10, 10]`
- Take 4 → `[8, 10, 10, 6]`
- Take 7 → `[8, 10, 9]`
- Take 20 → `[7]`, total = 7
- Reset with new capacity 5 → list clears, capacity becomes 5
- Reload page → state persists (if localStorage works)
- Try take with empty list → button disabled

Stop server. Type-check:

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "ui: static shell (SetupBar, Stats, Controls, App layout)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `ListView` + `CohortBox` (dot grid + capacity > 50 fallback)

**Files:**
- Create: `src/ui/ListView.tsx`
- Create: `src/ui/CohortBox.tsx`
- Modify: `src/App.tsx` (replace the `.raw` section)
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Snapshot`, `Cohort`
- Produces: visible cohort boxes with dot grids; capacity > 50 → fill bar fallback. No animations yet.

- [ ] **Step 1: Write `src/ui/CohortBox.tsx`**

```tsx
import type { Cohort } from '../core';

const DOT_THRESHOLD = 50;

export function CohortBox({
  cohort,
  capacity,
  index,
  isOldest,
}: {
  cohort: Cohort;
  capacity: number;
  index: number;
  isOldest: boolean;
}) {
  const useDots = capacity <= DOT_THRESHOLD;
  return (
    <div className={`cohort ${isOldest ? 'cohort--oldest' : ''}`} data-index={index}>
      <div className="cohort-header">
        <span className="cohort-count">{cohort.count} / {capacity}</span>
        {isOldest && <span className="cohort-tag">next to serve</span>}
      </div>
      {useDots ? <Dots count={cohort.count} capacity={capacity} /> : <Bar count={cohort.count} capacity={capacity} />}
    </div>
  );
}

function Dots({ count, capacity }: { count: number; capacity: number }) {
  const cols = Math.min(capacity, 10);
  return (
    <div className="dots" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: capacity }, (_, i) => (
        <span key={i} className={`dot ${i < count ? 'dot--filled' : ''}`} />
      ))}
    </div>
  );
}

function Bar({ count, capacity }: { count: number; capacity: number }) {
  const pct = (count / capacity) * 100;
  return (
    <div className="bar">
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
```

- [ ] **Step 2: Write `src/ui/ListView.tsx`**

```tsx
import type { Snapshot } from '../core';
import { CohortBox } from './CohortBox';

export function ListView({ snapshot }: { snapshot: Snapshot }) {
  if (snapshot.cohorts.length === 0) {
    return <p className="empty">No cohorts yet — add creators to begin.</p>;
  }

  return (
    <section className="list">
      <div className="list-labels">
        <span>← newest</span>
        <span>oldest →</span>
      </div>
      <div className="list-row">
        {snapshot.cohorts.map((cohort, i) => (
          <CohortBox
            key={i}
            cohort={cohort}
            capacity={snapshot.capacity}
            index={i}
            isOldest={i === snapshot.cohorts.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
```

Note: using `i` as the key is acceptable here because the order of cohorts is *positional* (newest-first), and animations in Task 11 will use `layout` + `AnimatePresence` to animate position changes. We'll revisit if reordering glitches appear during the animation pass.

- [ ] **Step 3: Update `src/App.tsx`**

Replace the `<section className="raw">…</section>` block with:

```tsx
          <ListView snapshot={wl.snapshot} />
```

And add the import: `import { ListView } from './ui/ListView';`

- [ ] **Step 4: Extend `src/styles.css`**

Append:

```css
.list { margin-bottom: 18px; }
.list-labels {
  display: flex; justify-content: space-between; font-size: 12px;
  color: #6b7280; margin-bottom: 6px;
}
.list-row {
  display: flex; gap: 12px; overflow-x: auto; padding: 14px;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  min-height: 140px; align-items: center;
}

.cohort {
  flex-shrink: 0; padding: 10px 12px; border: 1px solid #e5e7eb;
  border-radius: 10px; background: #fafbff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.cohort--oldest { border-color: #f59e0b; background: #fffaf0; }

.cohort-header {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; margin-bottom: 8px;
}
.cohort-count { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cohort-tag {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
  color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 999px;
}

.dots { display: grid; gap: 4px; min-width: 120px; }
.dot { width: 12px; height: 12px; border-radius: 50%; background: #e5e7eb; }
.dot--filled { background: #f97316; box-shadow: 0 0 0 1px #ea580c inset; }

.bar { width: 240px; height: 24px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, #fb923c, #f97316); }

.empty { color: #6b7280; padding: 28px; text-align: center; background: #fff; border: 1px dashed #d1d5db; border-radius: 12px; }
```

- [ ] **Step 5: Verify in browser**

```bash
source ~/.nvm/nvm.sh && nvm use
npm run dev
```

Check:
- Empty list shows the empty-state copy.
- Add 3 → one cohort box with 3 filled dots, "next to serve" tag.
- Add 22 (after a reset) → multiple cohort boxes left-to-right, oldest highlighted.
- Reset with capacity 60 → cohort boxes render as fill bars.

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "ui: ListView + CohortBox with dot grid and >50 capacity bar fallback

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `OperationLog`

**Files:**
- Create: `src/ui/OperationLog.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `LogEntry`
- Produces: a collapsible panel showing the 20 most recent operations.

- [ ] **Step 1: Write `src/ui/OperationLog.tsx`**

```tsx
import { useState } from 'react';
import type { LogEntry } from '../core';

const VERB: Record<LogEntry['op'], string> = {
  create: 'Created list, capacity',
  add: 'Added',
  take: 'Took',
  reset: 'Reset, capacity',
};

function formatRelative(at: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(at).toLocaleString();
}

export function OperationLog({ log }: { log: readonly LogEntry[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const now = Date.now();

  return (
    <section className="log">
      <button className="log-toggle" onClick={() => setCollapsed((c) => !c)}>
        Operation log ({log.length}) {collapsed ? '▸' : '▾'}
      </button>
      {!collapsed && (
        <ul className="log-list">
          {log.length === 0 && <li className="muted">No operations yet.</li>}
          {log.map((entry, i) => (
            <li key={`${entry.at}-${i}`}>
              <span className="log-verb">{VERB[entry.op]}</span>{' '}
              <span className="log-n">{entry.n}</span>
              <span className="log-time">{formatRelative(entry.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Update `src/App.tsx`**

Add import: `import { OperationLog } from './ui/OperationLog';`

After `<ListView />`, add: `<OperationLog log={wl.log} />`

- [ ] **Step 3: Extend `src/styles.css`**

Append:

```css
.log { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
.log-toggle {
  width: 100%; text-align: left; background: transparent; color: #1f2937;
  padding: 12px 16px; font-weight: 600; font-size: 14px;
}
.log-toggle:hover { background: #f9fafb; }
.log-list {
  list-style: none; padding: 0 16px 14px; margin: 0;
  max-height: 240px; overflow-y: auto;
}
.log-list li { padding: 6px 0; font-size: 13px; border-bottom: 1px dashed #f3f4f6; display: flex; gap: 8px; align-items: baseline; }
.log-list li:last-child { border-bottom: none; }
.log-verb { color: #4b5563; }
.log-n { font-weight: 600; font-variant-numeric: tabular-nums; }
.log-time { margin-left: auto; color: #9ca3af; font-size: 12px; }
```

- [ ] **Step 4: Verify**

```bash
source ~/.nvm/nvm.sh && nvm use
npm run dev
```

- Add, take, reset → entries appear in the log.
- `add(0)` (via temporarily allowing an empty input — skip if buttons are disabled).
- Collapse / expand works.
- Reload → log restored from localStorage.

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "ui: collapsible OperationLog with last 20 entries

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Framer Motion animations

**Files:**
- Modify: `src/ui/CohortBox.tsx` — animate dots in/out, animate cohort box width and presence
- Modify: `src/ui/ListView.tsx` — wrap cohorts in `<AnimatePresence>` and use `layout`
- Modify: `src/ui/Stats.tsx` — counter tween for `total`
- Create: `src/ui/ServedFlash.tsx`
- Modify: `src/App.tsx` — wire `ServedFlash` to `take()` return value
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Snapshot`, `Cohort`, return value of `wl.take(n)`
- Produces: animated UI per the spec's motion table.

- [ ] **Step 1: Rewrite `src/ui/CohortBox.tsx` with motion**

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import type { Cohort } from '../core';

const DOT_THRESHOLD = 50;

export function CohortBox({
  cohort, capacity, index, isOldest,
}: {
  cohort: Cohort; capacity: number; index: number; isOldest: boolean;
}) {
  const useDots = capacity <= DOT_THRESHOLD;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -30, width: 0 }}
      animate={{ opacity: 1, x: 0, width: 'auto' }}
      exit={{ opacity: 0, width: 0, paddingLeft: 0, paddingRight: 0, marginLeft: 0, marginRight: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={`cohort ${isOldest ? 'cohort--oldest' : ''}`}
      data-index={index}
    >
      <div className="cohort-header">
        <span className="cohort-count">{cohort.count} / {capacity}</span>
        {isOldest && <span className="cohort-tag">next to serve</span>}
      </div>
      {useDots ? <Dots count={cohort.count} capacity={capacity} /> : <Bar count={cohort.count} capacity={capacity} />}
    </motion.div>
  );
}

function Dots({ count, capacity }: { count: number; capacity: number }) {
  const cols = Math.min(capacity, 10);
  return (
    <div className="dots" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      <AnimatePresence initial={false}>
        {Array.from({ length: capacity }, (_, i) => {
          const filled = i < count;
          return (
            <motion.span
              key={i}
              className={`dot ${filled ? 'dot--filled' : ''}`}
              initial={false}
              animate={
                filled
                  ? { scale: [0, 1.25, 1], opacity: 1 }
                  : { scale: 1, opacity: 1 }
              }
              transition={{
                duration: 0.32,
                delay: filled ? (i % 10) * 0.03 : 0,
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function Bar({ count, capacity }: { count: number; capacity: number }) {
  const pct = (count / capacity) * 100;
  return (
    <div className="bar">
      <motion.div
        className="bar-fill"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Wrap cohorts in `AnimatePresence` (modify `src/ui/ListView.tsx`)**

```tsx
import { AnimatePresence, motion } from 'framer-motion';
import type { Snapshot } from '../core';
import { CohortBox } from './CohortBox';

export function ListView({ snapshot }: { snapshot: Snapshot }) {
  if (snapshot.cohorts.length === 0) {
    return <p className="empty">No cohorts yet — add creators to begin.</p>;
  }

  const last = snapshot.cohorts.length - 1;

  return (
    <section className="list">
      <div className="list-labels">
        <span>← newest</span>
        <span>oldest →</span>
      </div>
      <motion.div className="list-row" layout>
        <AnimatePresence initial={false}>
          {snapshot.cohorts.map((cohort, i) => (
            <CohortBox
              key={`${snapshot.capacity}-${i}-${cohort.count}`}
              cohort={cohort}
              capacity={snapshot.capacity}
              index={i}
              isOldest={i === last}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
```

Note on the composite key: combining capacity + position + count gives Framer Motion enough information to animate dot-level changes within a stable cohort, while still letting `AnimatePresence` fire enter/exit for cohorts that genuinely appear or disappear. If this causes visual jitter during take operations, fall back to `key={i}` and lean on `layout`.

- [ ] **Step 3: Tween the `Stats` total (`src/ui/Stats.tsx`)**

```tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Snapshot } from '../core';

function useTween(target: number, duration = 300) {
  const [displayed, setDisplayed] = useState(target);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(target);

  useEffect(() => {
    fromRef.current = displayed;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const k = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplayed(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return displayed;
}

export function Stats({ snapshot }: { snapshot: Snapshot }) {
  const total = useTween(snapshot.total);
  return (
    <section className="stats">
      <div>
        <span className="stat-label">Total waiting</span>
        <motion.span className="stat-value" key={total}>{total}</motion.span>
      </div>
      <div><span className="stat-label">Cohorts</span><span className="stat-value">{snapshot.cohorts.length}</span></div>
      <div><span className="stat-label">Capacity</span><span className="stat-value">{snapshot.capacity}</span></div>
    </section>
  );
}
```

- [ ] **Step 4: Write `src/ui/ServedFlash.tsx`**

```tsx
import { AnimatePresence, motion } from 'framer-motion';

export function ServedFlash({ value, nonce }: { value: number; nonce: number }) {
  return (
    <div className="flash-anchor">
      <AnimatePresence>
        {value > 0 && (
          <motion.div
            key={nonce}
            className="flash"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: -20 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.7 }}
          >
            +{value} served
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 5: Wire `ServedFlash` into `App.tsx`**

```tsx
import { useState } from 'react';
import { useWaitingList } from './ui/hooks/useWaitingList';
import { SetupBar } from './ui/SetupBar';
import { Stats } from './ui/Stats';
import { Controls } from './ui/Controls';
import { ListView } from './ui/ListView';
import { OperationLog } from './ui/OperationLog';
import { ServedFlash } from './ui/ServedFlash';
import './styles.css';

export default function App() {
  const wl = useWaitingList();
  const [served, setServed] = useState<{ n: number; nonce: number }>({ n: 0, nonce: 0 });

  function handleTake(n: number) {
    const taken = wl.take(n);
    if (taken > 0) setServed((s) => ({ n: taken, nonce: s.nonce + 1 }));
  }

  return (
    <main className="app">
      <header>
        <h1>Cohort Waiting List</h1>
        {!wl.persisting && (
          <span className="badge">Not persisting (localStorage unavailable)</span>
        )}
      </header>

      {wl.lastError && (
        <div className="error" role="alert" onClick={wl.clearError}>
          {wl.lastError} <span className="muted">(click to dismiss)</span>
        </div>
      )}

      {wl.snapshot === null ? (
        <SetupBar onCreate={wl.ensure} />
      ) : (
        <>
          <Stats snapshot={wl.snapshot} />
          <Controls
            snapshot={wl.snapshot}
            onAdd={wl.add}
            onTake={handleTake}
            onReset={wl.reset}
          />
          <ListView snapshot={wl.snapshot} />
          <ServedFlash value={served.n} nonce={served.nonce} />
          <OperationLog log={wl.log} />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Extend `src/styles.css`**

Append:

```css
.flash-anchor { position: relative; height: 0; }
.flash {
  position: absolute; right: 8px; top: -28px;
  background: #16a34a; color: white; padding: 6px 12px; border-radius: 999px;
  font-size: 13px; font-weight: 600; pointer-events: none;
  box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);
}
```

- [ ] **Step 7: Verify**

```bash
source ~/.nvm/nvm.sh && nvm use
npm run dev
```

- Add 13 → dots pop in staggered, new cohort slides in from left.
- Take 4 → dots disappear from rightmost cohort; "+4 served" floats and fades.
- Take 7 (continuing) → oldest cohort collapses to nothing, neighbors shift right.
- Total counter tweens.
- Capacity 60 → fill bar animates width smoothly.

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "ui: wire Framer Motion animations for add/take/cohort transitions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Visual polish + AI scratch notes

**Files:**
- Modify: `src/styles.css` (exit-lane chevron, fonts, page header tweaks)
- Create: `AI_NOTES.md` (scratch — captured as we built; distilled in Task 13)

**Interfaces:**
- Consumes: nothing
- Produces: tightened visual presentation; AI-collaboration material captured for the README

- [ ] **Step 1: Add exit-lane treatment to the list**

Append to `src/styles.css`:

```css
.list-row {
  position: relative;
  background:
    linear-gradient(to right, transparent calc(100% - 60px), rgba(245,158,11,0.08) 100%),
    #fff;
}
.list-row::after {
  content: '→'; position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  font-size: 18px; color: #b45309; pointer-events: none;
}
```

- [ ] **Step 2: Tighten typography and spacing**

Append to `src/styles.css`:

```css
body { font-feature-settings: 'cv11', 'ss01', 'tnum'; }
h1 { font-weight: 700; }
.stat-value { letter-spacing: -0.02em; }

@media (max-width: 720px) {
  .controls { grid-template-columns: 1fr; }
  .stats { flex-wrap: wrap; }
}
```

- [ ] **Step 3: Verify in browser**

Quick visual pass: list now has a subtle warm gradient + chevron on the right edge. Responsive on narrow widths.

- [ ] **Step 4: Create `AI_NOTES.md`**

This is a scratch file. As you implement, jot down moments where AI was helpful, wrong, or where you wrote by hand. A minimum content seed:

```markdown
# AI scratch notes (drafts for the README)

## Where AI helped
- (fill in)

## Where AI was wrong
- (fill in — at least one concrete example)

## Wrote by hand
- (fill in)
```

If you reach this task with nothing logged, do a 5-minute retrospective scrub of the git history and your own memory and write at least three bullets per section. Be specific — name files, name methods, name the wrong suggestion.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "ui: visual polish (exit-lane gradient, typography, responsive)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: README — design notes, edge cases, AI writeup

**Files:**
- Create: `README.md`
- Modify: `.gitignore` (add `AI_NOTES.md` if you want to keep it private; otherwise keep it tracked)

**Interfaces:**
- Consumes: the spec, the git history, `AI_NOTES.md`
- Produces: a single README that reviewers can read in 5 minutes and understand the design, edge cases, and AI collaboration.

- [ ] **Step 1: Write `README.md`**

```markdown
# Cohort Waiting List

A small TypeScript app for managing one FIFO cohort waiting list. Built as a take-home.

## Run

```bash
nvm use         # Node 22.11.0
npm install
npm run dev     # http://localhost:5173
```

## What it does

- **Create** a waiting list with a configurable cohort capacity (default 10).
- **Add** any number of creators in a single call; overflow opens new cohorts on the left.
- **Take** up to N creators, oldest first.
- **Get the total** number of creators waiting.

State persists to `localStorage`. The Reset button starts over with an optional new capacity.

## Design notes

### Layers

```
src/
  core/      ← TS class + types, zero React/DOM/storage dependencies
  storage/   ← localStorage codec with invariant validation
  ui/        ← React components, consume immutable Snapshots
```

The load-bearing boundary is `core/`: it exposes a mutable `WaitingList` class, but the only data that crosses out is an immutable `Snapshot`. The UI never touches the class except through `useWaitingList`, which holds it in a ref and publishes a fresh snapshot on every operation.

### Why a mutable class with an immutable wire format?

It's the cleanest separation. The class is small and easy to reason about with imperative state; React doesn't have to know it exists. `Snapshot` is what gets typed, serialized, and rendered. If you wanted to swap the class for pure functions later, the signatures on the React side wouldn't move.

### Types pulling weight

Three deliberate choices:

- `Cohort = { readonly count: number }` instead of `number` — costs nothing now, documents the `1..capacity` invariant near the type, leaves room for ids/timestamps later.
- Three error classes (`InvalidCapacityError`, `InvalidCountError`, `NonIntegerCountError`) — `instanceof` discriminates cleanly. Better than a stringly-typed `error.code`.
- `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` in tsconfig — array access returns `T | undefined`, forcing the algorithm in `take()` to assert intentionally.

### Algorithm

`take(n)`: drain the rightmost cohort by `min(remaining, cohort.count)`, prune if empty, repeat until `n` is satisfied or the list is empty. Returns the count actually taken (clamped to `total`).

`add(n)`: fill the leftmost open cohort first, then prepend full cohorts for each capacity-sized chunk, then a partial cohort for any remainder.

Invariants that never break: `Snapshot.cohorts` never contains a zero. `0 ≤ count ≤ capacity` for every cohort. Order between cohorts is sacred — only the rightmost is decremented.

## Edge cases

| Case | Behavior |
|---|---|
| `new WaitingList(0)`, negative, non-integer, NaN, Infinity | `InvalidCapacityError` |
| `add(0)` / `take(0)` | No-op, no log entry |
| `add(-1)` / floats / NaN / Infinity / > 1_000_000 | Throws (caller bug) |
| `add(n)` exactly fills open cohort | No new cohort spawned |
| `add(n)` on empty list, `n = k·capacity` | `k` full cohorts |
| `take(n)` on empty list | Returns 0 |
| `take(n > total)` | Returns `total`, list becomes empty |
| `take(n)` that empties a cohort | Pruned in the same operation |
| Capacity = 1 | Each cohort holds one |
| Capacity > 50 | UI swaps dot grid for fill bar |
| localStorage unavailable / corrupt / version mismatch / quota | Run in-memory, show "Not persisting" badge or bail to fresh state |
| Two tabs open | Last write wins (documented limitation) |
| Rapid clicks during animation | State is the source of truth; animations interrupt |
| Take/Add buttons | Disabled when their op would be a no-op |

## Out of scope (deliberately)

- Per-creator identity / names / timestamps
- Multiple named waiting lists
- Server persistence, auth, sharing
- Undo / replay
- Test suite (see "Tradeoffs" below)

## Tradeoffs

**No test suite.** Spent the time on type design, animation, and the writeup. The edge-case table above is the canonical reference for behavior — every row is reachable from the running UI, and the public API is small enough that reviewers can verify each row by inspection. If I had another hour, I'd add a `vitest` file with one assertion per row.

**Framer Motion (~50KB gzipped).** Earns its inclusion through `AnimatePresence` and `layout` animations, which are otherwise painful in React. A production app would weigh this more carefully.

**Restore via `add()` replay.** When rehydrating from `localStorage`, I add cohorts back through the public API rather than poking private state directly. O(n) in `total`, but it keeps the class with one trusted entry point.

## Working with AI

I used Claude through the entire build — design, scaffolding, motion, the writeup. Here's the honest accounting.

### Where AI helped

- (fill in from `AI_NOTES.md`)

### Where AI was wrong

- (at least one concrete example)

### What I wrote by hand and why

- (fill in)

## Project layout

```
src/
  main.tsx
  App.tsx
  styles.css
  core/
    index.ts
    types.ts
    errors.ts
    validate.ts
    WaitingList.ts
  storage/
    schema.ts
    persist.ts
  ui/
    SetupBar.tsx
    Stats.tsx
    Controls.tsx
    ListView.tsx
    CohortBox.tsx
    OperationLog.tsx
    ServedFlash.tsx
    hooks/
      useWaitingList.ts
```
```

- [ ] **Step 2: Distill `AI_NOTES.md` into the README**

Open `AI_NOTES.md` and copy the most concrete, specific bullets into the three placeholder sections in `README.md`. Each section needs at least three bullets; the "wrong" section needs one named example.

If there's nothing in `AI_NOTES.md`, spend 10 minutes scrubbing git history (`git log --all --oneline`) and journaling: every commit corresponds to a place AI suggested something. Identify which suggestions you accepted as-is, which you redirected, and which you wrote from scratch.

- [ ] **Step 3: Final type-check + dev run**

```bash
source ~/.nvm/nvm.sh && nvm use
npx tsc --noEmit
npm run dev
```

End-to-end manual pass:
- Reset, fresh state.
- Add 3 → `[3]`, total 3
- Add 13 → `[6, 10]`, total 16
- Add 22 → `[8, 10, 10, 10]`, total 38
- Take 4 → `[8, 10, 10, 6]`, total 34
- Take 7 → `[8, 10, 9]`, total 27
- Take 20 → `[7]`, total 7
- Take 99 → `[]`, total 0
- Reload — state persists
- Capacity 1 → dots render as one each
- Capacity 60 → fill bars
- `+4 served` flash visible on take

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit and final review**

```bash
git add README.md AI_NOTES.md
git commit -m "docs: README with design notes, edge cases, and AI collaboration writeup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git log --oneline
```

You should see ~13 commits, each one a coherent unit.

---

## Self-review pass on this plan

- **Spec coverage:** All four features (create/add/take/total) → Tasks 3, 4, 5, plus `total` getter in Task 3. Reset → Task 7's hook and Task 8's Controls. Operation log → Task 10. Animations → Task 11. localStorage with failure handling → Task 6 + Task 7. Edge cases → enforced by validation in Task 3, surfaced in Task 7's error handling, documented in Task 13's README. AI writeup → Task 12 + Task 13.
- **Placeholders:** None — every code step has the full code or the full command. Two intentional fill-ins exist in `AI_NOTES.md` and the README's "Working with AI" section; these are content that must be authored from real build experience, not generated.
- **Type consistency:** `Snapshot`, `Cohort`, `Op`, `LogEntry`, error classes — all defined once in Task 2 and referenced under the same names everywhere. `ensure`, `add`, `take`, `reset` on the hook — defined in Task 7 with the signatures Task 8+ consume.
