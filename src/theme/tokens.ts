/**
 * Khil design tokens — "Slate & Kite".
 *
 * The product is Indian, its first cluster is Ahmedabad (PIN 380015), and its
 * users are children who are not yet reading. Two materials from that world
 * carry the whole system:
 *
 *   Slate — the school patti every Indian child learns on. It grounds the
 *   account shell and the child's play surface. Saturated targets read harder
 *   on a dark field than on pastel, which matters when the thing being measured
 *   is how fast a child finds the odd one out.
 *
 *   Kite paper — Uttarayan, which is Ahmedabad's festival. Thin, translucent,
 *   violently bright: magenta, parrot green, cobalt, saffron. These are the
 *   play colours and the profile colours.
 *
 * Parent and clinician surfaces are chalk-washed paper: cool, quiet, and
 * deliberately not the warm cream this kind of app defaults to.
 *
 * One decision worth stating outright. The flag tone is INDIGO, not amber and
 * not red. Wireframe 03 note 2 requires the flag to never read as alarm, and
 * every warm notice colour fights that requirement. Blue reads as "look at
 * this", not "something is wrong", which is exactly the register a screening
 * aid needs when it is right only some of the time.
 */

export const color = {
  // ── Slate ground: account shell, profile gate, child play ────────────────
  slate: '#132229',
  slateDeep: '#0B141A',
  slateRaise: '#1D3542',
  slateLine: '#2C4857',

  // Type on slate
  chalk: '#F5F7F3',
  chalkSoft: '#B4C6C2',
  chalkFaint: '#7C9199',

  // ── Chalk paper: parent + clinician ──────────────────────────────────────
  paper: '#E9EEE8',
  surface: '#F6F8F4',
  surfaceSunk: '#DFE7DE',
  hairline: '#C9D4C9',
  hairlineStrong: '#AFBFB0',

  // Type on paper
  ink: '#10201E',
  inkSoft: '#475A55',
  inkFaint: '#7A8B84',

  // ── Kite paper: play + profile colours ───────────────────────────────────
  kite: {
    magenta: '#D8256B',
    parrot: '#1F9E6B',
    cobalt: '#2B5BD7',
    saffron: '#EFA00B',
    violet: '#7A4BD4',
    teal: '#0E93A8',
    coral: '#EF5D48',
    lime: '#7FB223',
  },

  // ── Notice: the flag tone. Indigo on purpose — see the note above. ───────
  notice: '#27408B',
  noticeSurface: '#E7ECFA',
  noticeEdge: '#C3D0F1',
  noticeOnSlate: '#93AEF5',

  positive: '#1B7A55',
  positiveSoft: '#DDEFE4',

  brand: '#1F9E6B',
  brandDeep: '#136B48',
  brandSoft: '#D5EDE0',
  brandTint: '#E6F3EC',
} as const;

/** Ten skill areas, ten petals, ten kite colours. Order matches DOMAIN_IDS. */
export const PETAL_COLORS = [
  color.kite.cobalt,
  color.kite.teal,
  color.kite.magenta,
  color.kite.violet,
  color.kite.coral,
  color.kite.saffron,
  color.kite.parrot,
  color.kite.lime,
  '#C2417F',
  '#3C7BD4',
] as const;

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

/**
 * Type. Both faces are Ek Type (Mumbai) — a foundry that draws Latin and
 * Devanagari together. For a product built for Indian families that is a
 * reason, not a coincidence.
 *
 * Baloo 2 is the display face: rounded, high x-height, warm without being
 * cutesy. Used only for headlines and the wordmark.
 * Anek Latin carries everything else, including the clinician's tables.
 */
export const family = {
  display: 'Baloo2_800ExtraBold',
  displayBold: 'Baloo2_700Bold',
  body: 'AnekLatin_400Regular',
  medium: 'AnekLatin_500Medium',
  semibold: 'AnekLatin_600SemiBold',
  bold: 'AnekLatin_700Bold',
} as const;

export const font = {
  display: 34,
  title: 24,
  heading: 18,
  body: 15.5,
  small: 13.5,
  micro: 11.5,
} as const;

export const shadow = {
  card: {
    shadowColor: '#0B141A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  lifted: {
    shadowColor: '#0B141A',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

/** Minimum tap target for ages 2–6 (wireframe 02, note 2). */
export const HIT_TARGET_MIN = 88;
