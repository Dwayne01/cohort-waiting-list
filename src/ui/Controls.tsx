import { useState } from 'react';
import type { Snapshot } from '../core';

type Props = {
  snapshot: Snapshot;
  onAdd: (n: number) => void;
  onTake: (n: number) => void;
  onReset: (capacity?: number) => void;
};

export function Controls({ snapshot, onAdd, onTake, onReset }: Props) {
  const [addText, setAddText] = useState('1');
  const [takeText, setTakeText] = useState('1');
  const [resetText, setResetText] = useState(String(snapshot.capacity));

  const addN = Number(addText);
  const takeN = Number(takeText);
  const resetCap = Number(resetText);

  const canAdd = Number.isInteger(addN) && addN > 0;
  const canTake = Number.isInteger(takeN) && takeN > 0 && snapshot.total > 0;
  const canReset = Number.isInteger(resetCap) && resetCap >= 1;

  return (
    <section className="controls">
      <div className="control">
        <label className="control-label">Add</label>
        <div className="row">
          <input
            type="number"
            min={0}
            step={1}
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            aria-label="Add count"
          />
          <button disabled={!canAdd} onClick={() => onAdd(addN)}>
            Add
          </button>
        </div>
      </div>

      <div className="control">
        <label className="control-label">Take</label>
        <div className="row">
          <input
            type="number"
            min={0}
            step={1}
            value={takeText}
            onChange={(e) => setTakeText(e.target.value)}
            aria-label="Take count"
          />
          <button disabled={!canTake} onClick={() => onTake(takeN)}>
            Take
          </button>
        </div>
      </div>

      <div className="control">
        <label className="control-label">Reset (capacity)</label>
        <div className="row">
          <input
            type="number"
            min={1}
            step={1}
            value={resetText}
            onChange={(e) => setResetText(e.target.value)}
            aria-label="Reset capacity"
          />
          <button
            disabled={!canReset}
            onClick={() => onReset(resetCap)}
            className="btn-secondary"
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
