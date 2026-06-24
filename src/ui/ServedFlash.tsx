import { AnimatePresence, motion } from 'framer-motion';

export function ServedFlash({ value, nonce }: { value: number; nonce: number }) {
  return (
    <div className="flash-anchor">
      <AnimatePresence>
        {value > 0 && (
          <motion.div
            key={nonce}
            className="flash"
            initial={{ opacity: 0, y: 12, scale: 0.85 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: -42, scale: 0.9 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            +{value} served
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
