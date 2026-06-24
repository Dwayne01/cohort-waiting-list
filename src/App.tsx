import { useEffect, useRef, useState } from 'react';
import { useWaitingList } from './ui/hooks/useWaitingList';
import { SetupBar } from './ui/SetupBar';
import { Stats } from './ui/Stats';
import { Controls } from './ui/Controls';
import { ListView } from './ui/ListView';
import { OperationLog } from './ui/OperationLog';
import { ServedFlash } from './ui/ServedFlash';
import './styles.css';

export default function App() {
  const wl = useWaitingList();
  const [served, setServed] = useState<{ n: number; nonce: number }>({ n: 0, nonce: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const clearTimer = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);

  function handleTake(n: number) {
    const totalBefore = wl.snapshot?.total ?? 0;
    const taken = wl.take(n);
    if (taken > 0) {
      setServed((s) => ({ n: taken, nonce: s.nonce + 1 }));
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(() => {
        setServed((s) => ({ n: 0, nonce: s.nonce }));
      }, 900);
    }
    if (taken < n) {
      const msg =
        totalBefore === 0
          ? `The queue is empty — nothing to take. You requested ${n}.`
          : `Only ${taken} of ${n} requested could be served — that was all that was left in the queue.`;
      setNotice(msg);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
    }
  }

  useEffect(() => {
    return () => {
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  return (
    <main className="app">
      <header>
        <div>
          <h1>Cohort Waiting List</h1>
          <p className="muted">FIFO cohorts — newest on the left, served from the right.</p>
        </div>
        {!wl.persisting && (
          <span className="badge">Not persisting (localStorage unavailable)</span>
        )}
      </header>

      {wl.lastError && (
        <div className="error" role="alert" onClick={wl.clearError}>
          {wl.lastError} <span className="muted">(click to dismiss)</span>
        </div>
      )}

      {notice && (
        <div className="notice" role="status" onClick={() => setNotice(null)}>
          {notice} <span className="muted">(click to dismiss)</span>
        </div>
      )}

      {wl.snapshot === null ? (
        <SetupBar onCreate={wl.ensure} />
      ) : (
        <>
          <Stats snapshot={wl.snapshot} />
          <Controls
            snapshot={wl.snapshot}
            onAdd={wl.add}
            onTake={handleTake}
            onReset={wl.reset}
          />
          <ListView snapshot={wl.snapshot} cohortIds={wl.cohortIds} />
          <ServedFlash value={served.n} nonce={served.nonce} />
          <OperationLog log={wl.log} />
        </>
      )}
    </main>
  );
}
