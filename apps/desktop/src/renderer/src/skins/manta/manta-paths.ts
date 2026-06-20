/**
 * Shared manta-ray silhouette geometry (top-down view, head at -y, tail at +y).
 * Abstracted from the Planetz "Manta" device: a swept-wing ray with two
 * cephalic horns at the head and a whip tail. viewBox is "-22 -16 44 32".
 * Wings are separate paths so they can flap independently of the body.
 */
export const MANTA_BODY =
  'M 0 -10 C 3.2 -10 4.6 -6 4.6 -1 C 4.6 4 3 8 0 9 C -3 8 -4.6 4 -4.6 -1 C -4.6 -6 -3.2 -10 0 -10 Z'
export const MANTA_WING_L = 'M -1 -6 C -8 -6.5 -16 -4 -21 0.5 C -15 2.5 -8 4 -1 5 Z'
export const MANTA_WING_R = 'M 1 -6 C 8 -6.5 16 -4 21 0.5 C 15 2.5 8 4 1 5 Z'
export const MANTA_HORN_L = 'M -1.6 -9 C -2.6 -11 -2.6 -12.5 -1.9 -13.6'
export const MANTA_HORN_R = 'M 1.6 -9 C 2.6 -11 2.6 -12.5 1.9 -13.6'
export const MANTA_TAIL = 'M 0 8 C 0.7 11 0.4 13.5 0 15.5'

/** Starfield speckle positions on the body (galaxy finish). */
export const MANTA_STARS: Array<{ cx: number; cy: number; r: number; o: number }> = [
  { cx: -1.5, cy: -3, r: 0.42, o: 0.9 },
  { cx: 1.4, cy: -5, r: 0.32, o: 0.7 },
  { cx: 0.6, cy: 1, r: 0.46, o: 0.85 },
  { cx: -1.2, cy: 3.5, r: 0.3, o: 0.6 },
  { cx: 1.8, cy: 2.5, r: 0.3, o: 0.65 },
]
