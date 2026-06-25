// A small palette tuned for adjacent-color discrimination.
// Each entry pairs a "base" color (dot fill) with a darker "ring" for the
// 1px inset on filled dots. Cohorts cycle through these in creation order.
export type CohortColor = {
  readonly base: string;
  readonly ring: string;
  readonly tint: string;   // very light background tint for the cohort card
};

export const PALETTE: readonly CohortColor[] = [
  { base: '#f97316', ring: '#ea580c', tint: '#fff7ed' }, // orange
  { base: '#3b82f6', ring: '#2563eb', tint: '#eff6ff' }, // blue
  { base: '#10b981', ring: '#059669', tint: '#ecfdf5' }, // emerald
  { base: '#a855f7', ring: '#9333ea', tint: '#faf5ff' }, // purple
  { base: '#ec4899', ring: '#db2777', tint: '#fdf2f8' }, // pink
  { base: '#eab308', ring: '#ca8a04', tint: '#fefce8' }, // amber
  { base: '#14b8a6', ring: '#0d9488', tint: '#f0fdfa' }, // teal
  { base: '#6366f1', ring: '#4f46e5', tint: '#eef2ff' }, // indigo
  { base: '#ef4444', ring: '#dc2626', tint: '#fef2f2' }, // red
  { base: '#84cc16', ring: '#65a30d', tint: '#f7fee7' }, // lime
];

export function colorFor(seq: number): CohortColor {
  // seq increases monotonically across the session; modulo the palette length.
  const i = ((seq % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return PALETTE[i]!;
}
