import type { Flag } from '../domain/flagEngine';
import type { SessionRecord } from '../domain/telemetry';

export type ChildProfile = {
  child_id: string;
  name: string;
  /** ISO date string. Drives age-banded content — no manual age picker (wireframe 01, note 1). */
  dob_iso: string;
  pin: string;
  specialist_id: string;
  created_at: number;
};

/**
 * Consent is stored as two separate, independently-recorded decisions because
 * wireframe 01 notes 3 and 4 give them different jobs: one is a data-sharing
 * permission, the other is an expectation-setting acknowledgement.
 */
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
  /** Mute the voice layer (for a silent room). */
  voiceEnabled: boolean;
  /**
   * Render the spoken instruction as text. OFF by default — wireframe 02,
   * note 1 requires instructions to be spoken, never written. This exists for
   * demoing on a muted laptop, not for real play.
   */
  showPromptText: boolean;
  /** Presenter overlay showing live telemetry during a session. */
  showCaptureDebug: boolean;
};

/** Other families in the clinician's PIN cluster. Fictional, and never flagged by the engine. */
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
  child: ChildProfile | null;
  consent: ConsentRecord | null;
  sessions: SessionRecord[];
  flags: Flag[];
  settings: Settings;
  clusterPatients: ClusterPatient[];
};

export type PersistedState = Omit<AppState, 'hydrated'>;

export const CONSENT_COPY_VERSION = '2026-08-onboarding-v1';
export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  mvpOnly: false,
  voiceEnabled: true,
  showPromptText: false,
  showCaptureDebug: false,
};

export const INITIAL_STATE: AppState = {
  hydrated: false,
  schema_version: SCHEMA_VERSION,
  child: null,
  consent: null,
  sessions: [],
  flags: [],
  settings: DEFAULT_SETTINGS,
  clusterPatients: [],
};
