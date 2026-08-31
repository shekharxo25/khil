import type { GameId } from '../domain/games';
import type { MetricId } from '../domain/norms';
import { buildRoundEvent, type RoundEvent, type RoundExtra } from '../domain/telemetry';

/**
 * One recorder per session. Every game writes into the same recorder, which is
 * what makes `task_switch_time_ms` meaningful across a game change and keeps
 * the "one table" promise of spec §4.
 */

export type RecordInput = {
  game_id: GameId;
  round_number: number;
  prompt_end_timestamp: number;
  first_response_timestamp: number | null;
  response_correct: boolean;
  repeat_error_count: number;
  /** When the round finished on screen — the anchor for the next task switch. */
  round_end_timestamp: number;
  primary_metric?: MetricId;
  extra?: RoundExtra;
};

export type SessionRecorder = {
  readonly childId: string;
  readonly sessionId: string;
  readonly ageMonths: number;
  record: (input: RecordInput) => RoundEvent;
  rounds: () => RoundEvent[];
};

export function createRecorder(args: {
  childId: string;
  sessionId: string;
  ageMonths: number;
}): SessionRecorder {
  const rounds: RoundEvent[] = [];
  let previousRoundEnd: number | null = null;

  return {
    childId: args.childId,
    sessionId: args.sessionId,
    ageMonths: args.ageMonths,
    record(input) {
      const event = buildRoundEvent({
        child_id: args.childId,
        session_id: args.sessionId,
        game_id: input.game_id,
        round_number: input.round_number,
        age_months: args.ageMonths,
        prompt_end_timestamp: input.prompt_end_timestamp,
        first_response_timestamp: input.first_response_timestamp,
        response_correct: input.response_correct,
        repeat_error_count: input.repeat_error_count,
        previous_round_end: previousRoundEnd,
        primary_metric: input.primary_metric,
        extra: input.extra,
      });
      previousRoundEnd = input.round_end_timestamp;
      rounds.push(event);
      return event;
    },
    rounds: () => rounds.slice(),
  };
}
