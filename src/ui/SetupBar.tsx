import { useState } from 'react';

export function SetupBar({ onCreate }: { onCreate: (capacity: number) => void }) {
  const [value, setValue] = useState('10');
  const capacity = Number(value);
  const valid = Number.isInteger(capacity) && capacity >= 1;

  return (
    <section className="card">
      <h2>Create a waiting list</h2>
      <p className="muted">Cohort capacity (default 10):</p>
      <div className="row">
        <input
          type="number"
          min={1}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Cohort capacity"
        />
        <button disabled={!valid} onClick={() => onCreate(capacity)}>
          Create list
        </button>
      </div>
    </section>
  );
}
