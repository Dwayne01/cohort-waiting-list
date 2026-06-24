import { useEffect, useState } from 'react';
import type { LogEntry } from '../core';

const VERB: Record<LogEntry['op'], string> = {
  create: 'Created list, capacity',
  add: 'Added',
  take: 'Took',
  reset: 'Reset, capacity',
};

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

export function OperationLog({ log }: { log: readonly LogEntry[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="log">
      <button
        className="log-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        Operation log ({log.length}){' '}
        <span className="log-chev">{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && (
        <ul className="log-list">
          {log.length === 0 && <li className="muted">No operations yet.</li>}
          {log.map((entry, i) => (
            <li key={`${entry.at}-${i}`}>
              <span className="log-verb">{VERB[entry.op]}</span>{' '}
              <span className="log-n">{entry.n}</span>
              <span className="log-time">{formatRelative(entry.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
