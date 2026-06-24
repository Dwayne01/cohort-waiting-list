import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../core';

function useTween(target: number, duration = 320): number {
  const [displayed, setDisplayed] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    fromRef.current = displayed;
    let start: number | null = null;
    let raf = 0;
    const step = (t: number) => {
      if (start === null) start = t;
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplayed(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return displayed;
}

export function Stats({ snapshot }: { snapshot: Snapshot }) {
  const total = useTween(snapshot.total);
  return (
    <section className="stats">
      <div>
        <span className="stat-label">Total waiting</span>
        <span className="stat-value">{total}</span>
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
