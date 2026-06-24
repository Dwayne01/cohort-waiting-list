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
