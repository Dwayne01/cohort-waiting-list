import type { Cohort } from '../core';

const DOT_THRESHOLD = 50;

type Props = {
  cohort: Cohort;
  capacity: number;
  index: number;
  isOldest: boolean;
  isNewest: boolean;
};

export function CohortBox({ cohort, capacity, index, isOldest, isNewest }: Props) {
  const useDots = capacity <= DOT_THRESHOLD;
  return (
    <div
      className={`cohort ${isOldest ? 'cohort--oldest' : ''} ${isNewest ? 'cohort--newest' : ''}`}
      data-index={index}
    >
      <div className="cohort-header">
        <span className="cohort-count">
          {cohort.count} <span className="cohort-cap">/ {capacity}</span>
        </span>
        {isOldest && <span className="cohort-tag tag-served">next to serve</span>}
        {isNewest && !isOldest && <span className="cohort-tag tag-newest">newest</span>}
      </div>
      {useDots ? (
        <Dots count={cohort.count} capacity={capacity} />
      ) : (
        <Bar count={cohort.count} capacity={capacity} />
      )}
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
    <div className="bar" aria-label={`${count} of ${capacity}`}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
