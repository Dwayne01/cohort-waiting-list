import type { Snapshot } from '../core';

export function Stats({ snapshot }: { snapshot: Snapshot }) {
  return (
    <section className="stats">
      <div>
        <span className="stat-label">Total waiting</span>
        <span className="stat-value">{snapshot.total}</span>
      </div>
      <div>
        <span className="stat-label">Cohorts</span>
        <span className="stat-value">{snapshot.cohorts.length}</span>
      </div>
      <div>
        <span className="stat-label">Capacity</span>
        <span className="stat-value">{snapshot.capacity}</span>
      </div>
    </section>
  );
}
