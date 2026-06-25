import { motion } from 'framer-motion';
import type { Cohort } from '../core';
import type { CohortColor } from './palette';

const DOT_THRESHOLD = 50;

type Props = {
  cohort: Cohort;
  capacity: number;
  index: number;
  isOldest: boolean;
  isNewest: boolean;
  color: CohortColor;
};

export function CohortBox({ cohort, capacity, index, isOldest, isNewest, color }: Props) {
  const useDots = capacity <= DOT_THRESHOLD;
  // CSS custom-property style cast — Framer Motion's style type rejects
  // React.CSSProperties under exactOptionalPropertyTypes.
  const cssVars = {
    ['--cohort-base' as string]: color.base,
    ['--cohort-ring' as string]: color.ring,
    ['--cohort-tint' as string]: color.tint,
  } as Record<string, string>;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.6, x: -40 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={`cohort ${isOldest ? 'cohort--oldest' : ''} ${isNewest ? 'cohort--newest' : ''}`}
      style={cssVars}
      data-index={index}
    >
      <div className="cohort-header">
        <span className="cohort-count">
          {cohort.count} <span className="cohort-cap">/ {capacity}</span>
        </span>
        {isOldest && <span className="cohort-tag tag-served">next in line</span>}
        {isNewest && !isOldest && <span className="cohort-tag tag-newest">newest</span>}
      </div>
      {useDots ? (
        <Dots count={cohort.count} capacity={capacity} />
      ) : (
        <Bar count={cohort.count} capacity={capacity} />
      )}
    </motion.div>
  );
}

function Dots({ count, capacity }: { count: number; capacity: number }) {
  const cols = Math.min(capacity, 10);
  const firstFilled = capacity - count;
  return (
    <div className="dots" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: capacity }, (_, i) => {
        const filled = i >= firstFilled;
        const fromRight = capacity - 1 - i;
        return (
          <motion.span
            key={i}
            className={`dot ${filled ? 'dot--filled' : ''}`}
            initial={false}
            animate={
              filled
                ? { scale: [0.4, 1.25, 1], opacity: 1 }
                : { scale: [1, 0.4, 0.92, 1], opacity: 1 }
            }
            transition={{
              duration: 0.34,
              delay: (fromRight % 10) * 0.025,
              times: filled ? [0, 0.5, 1] : [0, 0.4, 0.7, 1],
            }}
          />
        );
      })}
    </div>
  );
}

function Bar({ count, capacity }: { count: number; capacity: number }) {
  const pct = (count / capacity) * 100;
  return (
    <div className="bar" aria-label={`${count} of ${capacity}`}>
      <motion.div
        className="bar-fill"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 220, damping: 30 }}
      />
    </div>
  );
}
