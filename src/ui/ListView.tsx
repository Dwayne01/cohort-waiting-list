import { AnimatePresence, motion } from 'framer-motion';
import type { Snapshot } from '../core';
import { CohortBox } from './CohortBox';

type Props = {
  snapshot: Snapshot;
  cohortIds: readonly string[];
};

export function ListView({ snapshot, cohortIds }: Props) {
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
        <span>oldest (next to be served) →</span>
      </div>
      <motion.div className="list-row" layout>
        <AnimatePresence initial={false}>
          {snapshot.cohorts.map((cohort, i) => {
            const id = cohortIds[i] ?? `idx-${i}`;
            return (
              <CohortBox
                key={id}
                cohort={cohort}
                capacity={snapshot.capacity}
                index={i}
                isOldest={i === last}
                isNewest={i === 0}
              />
            );
          })}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
