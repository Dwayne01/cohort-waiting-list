import type { Snapshot } from '../core';
import { CohortBox } from './CohortBox';

export function ListView({ snapshot }: { snapshot: Snapshot }) {
  if (snapshot.cohorts.length === 0) {
    return (
      <section className="list-empty">
        <p>No cohorts yet — add creators to begin.</p>
      </section>
    );
  }

  const last = snapshot.cohorts.length - 1;

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
            isOldest={i === last}
            isNewest={i === 0}
          />
        ))}
      </div>
    </section>
  );
}
