import { PresetPicker } from './PresetPicker';

const SETUP_PRESETS = [1, 5, 10, 25, 50, 100] as const;

export function SetupBar({ onCreate }: { onCreate: (capacity: number) => void }) {
  return (
    <section className="card">
      <h2>Create a waiting list</h2>
      <p className="muted">Pick a cohort capacity to begin (default 10).</p>
      <div className="setup-row">
        <PresetPicker
          label="Set capacity & create"
          presets={SETUP_PRESETS}
          onPick={onCreate}
        />
      </div>
    </section>
  );
}
