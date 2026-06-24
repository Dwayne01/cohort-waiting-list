import type { Snapshot } from '../core';
import { PresetPicker } from './PresetPicker';

type Props = {
  snapshot: Snapshot;
  onAdd: (n: number) => void;
  onTake: (n: number) => void;
  onReset: (capacity?: number) => void;
};

const ADD_PRESETS = [1, 3, 5, 10] as const;
const TAKE_PRESETS = [1, 3, 5, 10] as const;
const RESET_PRESETS = [1, 3, 5, 10] as const;

export function Controls({ snapshot, onAdd, onTake, onReset }: Props) {
  const canTake = snapshot.total > 0;

  return (
    <section className="controls">
      <div className="control">
        <label className="control-label">Add creators</label>
        <PresetPicker
          label="Add"
          presets={ADD_PRESETS}
          onPick={onAdd}
        />
      </div>

      <div className="control">
        <label className="control-label">Take (oldest first)</label>
        <PresetPicker
          label="Take"
          presets={TAKE_PRESETS}
          onPick={onTake}
          disabled={!canTake}
        />
      </div>

      <div className="control">
        <label className="control-label">Reset with capacity</label>
        <PresetPicker
          label={`Reset (currently ${snapshot.capacity})`}
          presets={RESET_PRESETS}
          onPick={onReset}
          variant="secondary"
        />
      </div>
    </section>
  );
}
