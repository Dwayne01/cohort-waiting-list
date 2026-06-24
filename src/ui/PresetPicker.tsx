import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Props = {
  label: string;
  presets: readonly number[];
  onPick: (n: number) => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  customMin?: number;
  customMax?: number;
};

export function PresetPicker({
  label,
  presets,
  onPick,
  disabled = false,
  variant = 'primary',
  customMin = 1,
  customMax = 1_000_000,
}: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(n: number) {
    onPick(n);
    setOpen(false);
    setCustom('');
  }

  function submitCustom() {
    const n = Number(custom);
    if (!Number.isInteger(n) || n < customMin || n > customMax) return;
    pick(n);
  }

  const customN = Number(custom);
  const customValid = custom !== '' && Number.isInteger(customN) && customN >= customMin && customN <= customMax;

  return (
    <div className="picker" ref={wrapRef}>
      <button
        type="button"
        className={variant === 'primary' ? 'picker-btn' : 'picker-btn picker-btn--secondary'}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
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
            <div className="picker-presets">
              {presets.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="picker-chip"
                  onClick={() => pick(n)}
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
                submitCustom();
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
