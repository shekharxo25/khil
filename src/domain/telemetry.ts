import type { GameId } from './games';
import { bandForAge, formatBand, type MetricId } from './norms';

/**
 * Spec §4 — "Keep this consistent across all games so the flagging logic and
 * dashboard can read from one table."
 *
 * Field names below are snake_case on purpose: they are the wire/table names
 * from the spec, and keeping them identical means the schema in the doc and the
 * schema in the code cannot drift.
 *
 * Nothing in this record identifies a condition, and nothing here is media.
 * A round is a handful of numbers.
 */
export type RoundEvent = {
  child_id: string;
  session_id: string;
  game_id: GameId;
  round_number: number;

  /** ms epoch — when the instruction audio finished. */
  prompt_end_timestamp: number;
  /** ms epoch — the child's first touch of this round. Null if no response. */
  first_response_timestamp: number | null;
  /** Derived convenience: first_response_timestamp - prompt_end_timestamp. */
  response_latency_ms: number | null;

  response_correct: boolean;
  /** Same wrong answer picked twice or more within the round. */
  repeat_error_count: number;
  /** Gap between the previous round ending and this round's first tap. */
  task_switch_time_ms: number | null;

  /** Human-readable reference band this round is compared against. */
  age_band_expected_range: string;

  /** Game-specific measures that do not belong in the shared columns. */
  extra: RoundExtra;
};

export type RoundExtra = {
  /** Pattern game: difficulty tier of the round (1 = colour only, 3 = subtle). */
  difficulty_tier?: number;
  /** Language game: word difficulty tier, 1 = concrete noun, 3 = category. */
  word_tier?: number;
  /** Language game: did the child dwell on other options before choosing? */
  scanned_before_choosing?: boolean;
  /** Beat game: mean absolute deviation from the modelled inter-tap interval. */
  rhythm_deviation_ms?: number;
  /** Beat game: how long the reproduced sequence was. */
  sequence_length?: number;
  /** Beat game / sequence game: what kind of error, if any. */
  error_type?: 'none' | 'wrong_order' | 'wrong_target' | 'no_response';
  /** Sequence game: number of card swaps before the child settled. */
  swap_count?: number;
  /** Sequence game: did the child re-order after hearing audio feedback? */
  reordered_after_audio?: boolean;
  /**
   * Wait-and-tap game: whether this trial wanted a response or wanted the child
   * to hold back. Commission and omission errors are read off this plus
   * `first_response_timestamp`, which is why neither needs its own column.
   */
  trial_type?: 'respond' | 'withhold';
  /** Line tracing: mean distance from the path, as a share of the path's own scale. */
  trace_deviation_pct?: number;
  /** Line tracing: how many times the finger left the screen mid-path. */
  trace_lifts?: number;
  /** Line tracing: share of the path actually covered. */
  trace_completion?: number;
  /** Quantity game: 1 = obvious difference, 3 = the two groups are close. */
  ratio_tier?: number;
  /** Quantity game: the two group sizes, for the clinician's replay. */
  quantities?: [number, number];

  /** Every tap in the round, for the clinician's replay. No media, just taps. */
  taps?: TapMark[];
};

export type TapMark = {
  /** ms since prompt_end_timestamp. */
  at: number;
  /** Index of the tile/pad/card touched. */
  target: number;
  correct: boolean;
};

export type SessionRecord = {
  session_id: string;
  child_id: string;
  started_at: number;
  ended_at: number;
  /** Which games ran in this session (rotation picks 1–2, spec §3). */
  game_ids: GameId[];
  /** Age in months at the time of play — bands are age-relative. */
  age_months: number;
  /** Seed used to generate rounds, so the session can be replayed exactly. */
  seed: number;
  rounds: RoundEvent[];
  /** True when the child walked away mid-session. Excluded from flag maths. */
  abandoned: boolean;
  /**
   * True when a parent chose to play a different age group's games than this
   * child's date of birth implies. Also excluded from flag maths: comparing
   * these timings against the child's own age band would be meaningless.
   */
  off_band?: boolean;
};

export type RoundDraftInput = {
  child_id: string;
  session_id: string;
  game_id: GameId;
  round_number: number;
  age_months: number;
  prompt_end_timestamp: number;
  first_response_timestamp: number | null;
  response_correct: boolean;
  repeat_error_count: number;
  previous_round_end: number | null;
  primary_metric?: MetricId;
  extra?: RoundExtra;
};

export function buildRoundEvent(input: RoundDraftInput): RoundEvent {
  const band = bandForAge(input.age_months);
  const metric: MetricId = input.primary_metric ?? 'responseLatencyMs';

  // Every duration in the table is whole milliseconds. Sub-millisecond
  // precision here would be false precision — the underlying clock, the audio
  // end callback and a toddler's finger are all far coarser than that — and it
  // leaks into anything that renders a raw value.
  const latency =
    input.first_response_timestamp === null
      ? null
      : Math.max(0, Math.round(input.first_response_timestamp - input.prompt_end_timestamp));
  const taskSwitch =
    input.previous_round_end === null || input.first_response_timestamp === null
      ? null
      : Math.max(0, Math.round(input.first_response_timestamp - input.previous_round_end));

  return {
    child_id: input.child_id,
    session_id: input.session_id,
    game_id: input.game_id,
    round_number: input.round_number,
    prompt_end_timestamp: Math.round(input.prompt_end_timestamp),
    first_response_timestamp:
      input.first_response_timestamp === null
        ? null
        : Math.round(input.first_response_timestamp),
    response_latency_ms: latency,
    response_correct: input.response_correct,
    repeat_error_count: input.repeat_error_count,
    task_switch_time_ms: taskSwitch,
    age_band_expected_range: formatBand(metric, band.metrics[metric]),
    extra: input.extra ?? {},
  };
}

/** Median is used everywhere instead of mean: one distracted round shouldn't move it. */
export function median(values: number[]): number | null {
  const clean = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 1 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

export function mean(values: number[]): number | null {
  const clean = values.filter(v => Number.isFinite(v));
  if (clean.length === 0) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}
