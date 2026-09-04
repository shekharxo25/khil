import { color } from '../theme/tokens';
import type { Flag } from '../domain/flagEngine';
import type { SessionRecord } from '../domain/telemetry';

/**
 * One account, several children.
 *
 * The original build assumed one child per install, which is wrong for the
 * actual user: a parent with two or three children wants to watch all of them,
 * and wants each one's history kept separate. So the account holds the things
 * that are shared — the PIN cluster, the matched specialist, the consent, the
 * plan — and each child profile holds its own name, date of birth and play
 * history. Sessions and flags are already keyed by `child_id`, so they simply
 * filter.
 */

export type PlanId = 'basic' | 'family' | 'familyPlus';

export type PlanMeta = {
  id: PlanId;
  name: string;
  /** The whole point of a plan here: how many children it covers. */
  profileLimit: number;
  price: string;
  cadence: string;
  blurb: string;
  perks: string[];
};

export const PLANS: Record<PlanId, PlanMeta> = {
  basic: {
    id: 'basic',
    name: 'Khil Basic',
    profileLimit: 1,
    price: 'Free',
    cadence: '',
    blurb: 'One child, the full set of games, and the same specialist match.',
    perks: ['1 child profile', 'All 8 games', 'Weekly progress', 'Specialist match'],
  },
  family: {
    id: 'family',
    name: 'Khil Family',
    profileLimit: 2,
    price: '₹199',
    cadence: '/month',
    blurb: 'Two children on one account, each with their own separate history.',
    perks: [
      '2 child profiles',
      'Separate history per child',
      'All 8 games',
      'Specialist match',
    ],
  },
  familyPlus: {
    id: 'familyPlus',
    name: 'Khil Family+',
    profileLimit: 4,
    price: '₹349',
    cadence: '/month',
    blurb: 'For larger families and home-based carers looking after several children.',
    perks: [
      '4 child profiles',
      'Separate history per child',
      'All 8 games',
      'Specialist match',
    ],
  },
};

export const DEFAULT_PLAN: PlanId = 'family';

export type Account = {
  account_id: string;
  /** Shared by every child on the account — one household, one cluster. */
  pin: string;
  specialist_id: string;
  plan: PlanId;
  created_at: number;
};

/** The colour and glyph a child picks for themselves at the profile gate. */
export type Avatar = { color: string; glyph: string };

export const AVATAR_COLORS: string[] = [
  color.kite.cobalt,
  color.kite.magenta,
  color.kite.parrot,
  color.kite.saffron,
  color.kite.violet,
  color.kite.teal,
  color.kite.coral,
  color.kite.lime,
];

export const AVATAR_GLYPHS: string[] = [
  '🪁', '🐘', '🦜', '🌻', '🐯', '🚂', '🦋', '⭐', '🐙', '🍉', '🦁', '🐢',
];

export type ChildProfile = {
  child_id: string;
  name: string;
  /** ISO date. Drives age-banded content — no manual age picker (wireframe 01, note 1). */
  dob_iso: string;
  avatar: Avatar;
  created_at: number;
  /**
   * Play a different age group's games than the date of birth implies.
   * Null means "use their actual age", which is the default and the norm.
   *
   * Sessions played under an override are recorded with `off_band: true` and
   * excluded from the flag engine — comparing a four-year-old's timings against
   * a two-year-old's reference range would be meaningless in both directions.
   */
  band_override: string | null;
};

export type ConsentRecord = {
  /** "only the flagged clip is shared, not raw/full footage" */
  flagged_clip_sharing: boolean;
  /** "this is a screening aid, not a diagnosis" */
  screening_not_diagnosis: boolean;
  accepted_at: number;
  copy_version: string;
};

export type Settings = {
  /** Spec §5 — restrict rotation to the two MVP games. */
  mvpOnly: boolean;
  voiceEnabled: boolean;
  /**
   * Render the spoken instruction as text. OFF by default — wireframe 02,
   * note 1 requires instructions to be spoken, never written.
   */
  showPromptText: boolean;
  showCaptureDebug: boolean;
};

/** Other families in the clinician's PIN cluster. Fictional, never flagged. */
export type ClusterPatient = {
  id: string;
  name: string;
  age_years: number;
  pin: string;
  status: 'clear' | 'booked';
  note: string;
};

export type AppState = {
  hydrated: boolean;
  schema_version: number;
  account: Account | null;
  consent: ConsentRecord | null;
  profiles: ChildProfile[];
  activeProfileId: string | null;
  sessions: SessionRecord[];
  flags: Flag[];
  settings: Settings;
  clusterPatients: ClusterPatient[];
};

export type PersistedState = Omit<AppState, 'hydrated'>;

export const CONSENT_COPY_VERSION = '2026-08-onboarding-v1';
/** Bumped for the account/profiles model; storage clears anything older. */
export const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  mvpOnly: false,
  voiceEnabled: true,
  showPromptText: false,
  showCaptureDebug: false,
};

export const INITIAL_STATE: AppState = {
  hydrated: false,
  schema_version: SCHEMA_VERSION,
  account: null,
  consent: null,
  profiles: [],
  activeProfileId: null,
  sessions: [],
  flags: [],
  settings: DEFAULT_SETTINGS,
  clusterPatients: [],
};

export function planFor(account: Account | null): PlanMeta {
  return PLANS[account?.plan ?? DEFAULT_PLAN];
}

export function profileLimitReached(
  account: Account | null,
  profiles: ChildProfile[],
): boolean {
  return profiles.length >= planFor(account).profileLimit;
}
