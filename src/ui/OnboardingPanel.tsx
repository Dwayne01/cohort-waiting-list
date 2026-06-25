import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { OnboardingEvent } from './hooks/useWaitingList';

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

type Props = {
  events: readonly OnboardingEvent[];
  onClear: () => void;
};

export function OnboardingPanel({ events, onClear }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="ob">
      <header className="ob-head">
        <div>
          <h2 className="ob-title">Currently onboarding</h2>
          <p className="ob-sub">
            {events.length === 0
              ? 'No one has been onboarded yet.'
              : `${events.length} recent session${events.length === 1 ? '' : 's'}.`}
          </p>
        </div>
        {events.length > 0 && (
          <button type="button" className="ob-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </header>

      <div className="ob-list">
        <AnimatePresence initial={false}>
          {events.length === 0 && (
            <motion.p
              key="empty"
              className="ob-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              When you onboard cohorts they'll appear here, color-matched to where they sat in the queue.
            </motion.p>
          )}
          {events.map((e) => (
            <motion.article
              key={e.id}
              className="ob-card"
              layout
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            >
              <div className="ob-card-head">
                <span className="ob-card-count">+{e.taken}</span>
                <span className="ob-card-label">onboarded</span>
                <span className="ob-card-time">{formatRelative(e.at, now)}</span>
              </div>
              <div className="ob-card-groups">
                {e.groups.map((g, i) => (
                  <span
                    key={i}
                    className="ob-group"
                    style={{ '--ob-color': g.color.base, '--ob-ring': g.color.ring } as React.CSSProperties}
                    title={`${g.count} creator${g.count === 1 ? '' : 's'} from one cohort`}
                  >
                    <span className="ob-dots">
                      {Array.from({ length: Math.min(g.count, 10) }, (_, j) => (
                        <span key={j} className="ob-dot" />
                      ))}
                      {g.count > 10 && <span className="ob-overflow">+{g.count - 10}</span>}
                    </span>
                    <span className="ob-group-count">{g.count}</span>
                  </span>
                ))}
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
