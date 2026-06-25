import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type PickerConfirm = {
  title: (n: number) => string;
  detail?: string;
  confirmLabel?: string;
};

type Props = {
  label: string;
  presets: readonly number[];
  onPick: (n: number) => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  customMin?: number;
  customMax?: number;
  confirm?: PickerConfirm;
};

export function PresetPicker({
  label,
  presets,
  onPick,
  disabled = false,
  variant = 'primary',
  customMin = 1,
  customMax = 1_000_000,
  confirm,
}: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [pending, setPending] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setPending(null);
    setCustom('');
  }

  function chose(n: number) {
    if (confirm) {
      setPending(n);
    } else {
      onPick(n);
      close();
    }
  }

  function confirmPending() {
    if (pending === null) return;
    onPick(pending);
    close();
  }

  const customN = Number(custom);
  const customValid =
    custom !== '' &&
    Number.isInteger(customN) &&
    customN >= customMin &&
    customN <= customMax;

  return (
    <div className="picker" ref={wrapRef}>
      <button
        type="button"
        className={variant === 'primary' ? 'picker-btn' : 'picker-btn picker-btn--secondary'}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span>{label}</span>
        <span className="picker-chev" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="picker-pop"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            {pending === null ? (
              <>
                <div className="picker-presets">
                  {presets.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="picker-chip"
                      onClick={() => chose(n)}
                      role="menuitem"
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <form
                  className="picker-custom"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customValid) chose(customN);
                  }}
                >
                  <input
                    type="number"
                    min={customMin}
                    step={1}
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="custom"
                    aria-label={`Custom ${label} value`}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="picker-go"
                    disabled={!customValid}
                    aria-label="Apply custom value"
                  >
                    ↵
                  </button>
                </form>
              </>
            ) : (
              <div className="picker-confirm">
                <p className="picker-confirm-title">{confirm!.title(pending)}</p>
                {confirm!.detail && (
                  <p className="picker-confirm-detail">{confirm!.detail}</p>
                )}
                <div className="picker-confirm-actions">
                  <button
                    type="button"
                    className="picker-cancel"
                    onClick={() => setPending(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="picker-go picker-confirm-go"
                    onClick={confirmPending}
                    autoFocus
                  >
                    {confirm!.confirmLabel ?? 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
