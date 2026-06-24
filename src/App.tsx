import { useWaitingList } from './ui/hooks/useWaitingList';
import { SetupBar } from './ui/SetupBar';
import { Stats } from './ui/Stats';
import { Controls } from './ui/Controls';
import { ListView } from './ui/ListView';
import './styles.css';

export default function App() {
  const wl = useWaitingList();

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

      {wl.snapshot === null ? (
        <SetupBar onCreate={wl.ensure} />
      ) : (
        <>
          <Stats snapshot={wl.snapshot} />
          <Controls
            snapshot={wl.snapshot}
            onAdd={wl.add}
            onTake={wl.take}
            onReset={wl.reset}
          />
          <ListView snapshot={wl.snapshot} />
        </>
      )}
    </main>
  );
}
