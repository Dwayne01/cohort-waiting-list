import type { Cohort, Snapshot, TakeResult } from './types';
import { validateCapacity, validateCount } from './validate';

export class WaitingList {
  static readonly MAX_N = 1_000_000;

  readonly #capacity: number;
  #cohorts: Cohort[] = [];
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

  add(n: number): void {
    validateCount(n, WaitingList.MAX_N);
    if (n === 0) return;

    let remaining = n;

    const first = this.#cohorts[0];
    if (first && first.count < this.#capacity) {
      const room = this.#capacity - first.count;
      const fill = Math.min(room, remaining);
      this.#cohorts[0] = { count: first.count + fill };
      remaining -= fill;
    }

    while (remaining >= this.#capacity) {
      this.#cohorts.unshift({ count: this.#capacity });
      remaining -= this.#capacity;
    }

    if (remaining > 0) {
      this.#cohorts.unshift({ count: remaining });
    }

    this.#total += n;
  }

  take(n: number): TakeResult {
    validateCount(n, WaitingList.MAX_N);
    if (n === 0) return { kind: 'noop' };

    let taken = 0;
    let remaining = n;

    while (remaining > 0 && this.#cohorts.length > 0) {
      const lastIndex = this.#cohorts.length - 1;
      const last = this.#cohorts[lastIndex]!;
      const drain = Math.min(last.count, remaining);

      if (drain === last.count) {
        this.#cohorts.pop();
      } else {
        this.#cohorts[lastIndex] = { count: last.count - drain };
      }

      taken += drain;
      remaining -= drain;
    }

    this.#total -= taken;
    return taken === n
      ? { kind: 'served', taken }
      : { kind: 'partial', requested: n, taken };
  }

  snapshot(): Snapshot {
    return {
      capacity: this.#capacity,
      cohorts: this.#cohorts.map((c) => ({ count: c.count })),
      total: this.#total,
    };
  }
}
