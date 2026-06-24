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
