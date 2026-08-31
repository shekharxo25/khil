/**
 * Khil design tokens.
 *
 * Three audiences share one system:
 *  - parent  : warm paper, calm, plain-language. Never alarm styling (wireframe 03, note 2).
 *  - child   : high-contrast, oversized targets, playful. No text is load-bearing (wireframe 02, note 1).
 *  - clinician: cooler, denser, tablet-friendly (wireframe 05/06).
 *
 * "Khil" (खिल) — to bloom. The bloom mark and the petal palette come from that.
 */

export const color = {
  // Surfaces
  paper: '#FBF7F1',
  paperDeep: '#F3ECE1',
  surface: '#FFFFFF',
  surfaceSunk: '#F6F1E9',

  // Ink
  ink: '#1B2420',
  inkSoft: '#4B5854',
  inkFaint: '#8A9691',
  hairline: '#E4DDD1',
  hairlineStrong: '#D3C9B8',

  // Brand — deep leaf green
  brand: '#2E6B58',
  brandDeep: '#1F4C3F',
  brandSoft: '#DCEBE4',
  brandTint: '#EFF6F2',

  // Marigold accent (progress, celebration)
  accent: '#E39A2E',
  accentSoft: '#FBEBD1',

  // Notice — the flag tone. Deliberately sand, never red. (wireframe 03, note 2)
  notice: '#8A5A20',
  noticeSurface: '#FCF3E3',
  noticeEdge: '#EBD6AE',

  // Child palette — saturated but soft, colour-blind-legible pairings only
  play: {
    sky: '#4C9BE8',
    grape: '#8A6BD1',
    coral: '#EF7A6A',
    leaf: '#48A97C',
    sun: '#F0B537',
    plum: '#B45B8F',
    slate: '#5C7A8A',
  },
  childBgTop: '#EAF3FB',
  childBgBottom: '#F7F0E4',

  // Clinician
  clinic: '#1F3D4F',
  clinicSurface: '#F4F7F9',
  clinicEdge: '#DCE5EB',

  positive: '#2E7D5B',
  positiveSoft: '#E3F1EA',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const font = {
  /** Display sizes are used sparingly — one per screen at most. */
  display: 30,
  title: 23,
  heading: 18,
  body: 15.5,
  small: 13.5,
  micro: 11.5,
} as const;

export const shadow = {
  card: {
    shadowColor: '#3A2E1C',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  lifted: {
    shadowColor: '#3A2E1C',
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

/** Minimum tap target for ages 2–6 (wireframe 02, note 2: no fine-motor precision below age 4). */
export const HIT_TARGET_MIN = 88;
