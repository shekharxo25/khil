import type { RoundEvent } from '../domain/telemetry';
import type { SessionRecorder } from './recorder';

/**
 * The contract every game implements.
 *
 * Spec §3: "Screen 02 is your template frame for all four games — same
 * voice-first prompt bar, same passive-capture footer note, same progress bar
 * and 'Session X of 10' counter. Only the center content tile changes."
 *
 * That is encoded here: a game receives its slice of the session and renders
 * ONLY the centre tile. The frame, the voice bar, the progress and the counter
 * belong to <GameFrame> and are identical for all four.
 */
export type GameProps = {
  childName: string;
  ageMonths: number;
  /** Rounds this visit should run (rotation trims this when two games share a session). */
  rounds: number;
  /** Deterministic content seed — lets a flagged session be reproduced exactly. */
  seed: number;
  recorder: SessionRecorder;
  /** Position of this game inside the session, for the shared progress meter. */
  gameIndex: number;
  gameCount: number;
  sessionNumber: number;
  /** Reveal the spoken prompt as text — off by default (wireframe 02, note 1). */
  showPromptText: boolean;
  /** Presenter overlay: live telemetry strip. Off in real play. */
  showCaptureDebug: boolean;
  voiceEnabled: boolean;
  onRound: (event: RoundEvent) => void;
  onFinish: () => void;
  onExit: () => void;
};
