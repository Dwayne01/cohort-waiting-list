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
