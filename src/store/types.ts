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

/**
 * Voice locales offered in settings. Milestone spec §3: "Multi-language
 * toggle for game voice instructions... worth stubbing the setting now even
 * before content exists." So the setting is real and does change the
 * text-to-speech locale passed to `expo-speech`, but every string in the app
 * is still written in English — a locale change here changes the accent/
 * pronunciation engine used to read that English text aloud, not the words.
 * Swapping in real translated content per language is future work, and the
 * setting's own copy says so.
 */
export type VoiceLocale = 'en-IN' | 'en-US' | 'en-GB' | 'hi-IN';

export const VOICE_LOCALES: { id: VoiceLocale; label: string; stub?: boolean }[] = [
  { id: 'en-IN', label: 'English (India)' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'hi-IN', label: 'Hindi — voice only, text stays English', stub: true },
];

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
  /** Locale passed to expo-speech. See VoiceLocale doc comment. */
  voiceLocale: VoiceLocale;
  /**
   * Local, on-device session reminders. Milestone spec §3: "gentle nudges for
   * session streaks and flag follow-ups (not guilt-trippy)". There is no push
   * server behind this — see `lib/reminders.ts` — so it only works while the
   * app can schedule an on-device notification, which excludes web.
   */
  remindersEnabled: boolean;
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

/**
 * A message thread between a household and its matched specialist.
 *
 * Milestone spec §3: "Secure messaging thread between parent and mapped
 * pediatrician, so booking/follow-up doesn't need to leave the app." Honest
 * scope note, because the word "secure" is doing real work in that sentence:
 * this is a same-device, local-storage thread — there is no server, so
 * nothing is actually transmitted to a pediatrician's own device anywhere in
 * this build. It demonstrates the exact UI and data shape a real
 * implementation would use; wiring it to a backend is what would make the
 * word "secure" true rather than aspirational. See README.
 */
export type Message = {
  id: string;
  child_id: string;
  from: 'parent' | 'clinician';
  body: string;
  sent_at: number;
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
  messages: Message[];
  settings: Settings;
  clusterPatients: ClusterPatient[];
};

export type PersistedState = Omit<AppState, 'hydrated'>;

export const CONSENT_COPY_VERSION = '2026-08-onboarding-v1';
/** Bumped for messaging + settings additions; storage clears anything older. */
export const SCHEMA_VERSION = 3;

export const DEFAULT_SETTINGS: Settings = {
  mvpOnly: false,
  voiceEnabled: true,
  showPromptText: false,
  showCaptureDebug: false,
  voiceLocale: 'en-IN',
  remindersEnabled: false,
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
  messages: [],
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
