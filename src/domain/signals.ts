import type { DomainId } from './domains';
import { GAMES, type GameId } from './games';
import { bandForAge, deviation, formatBand, type MetricId } from './norms';
import { median, type RoundEvent, type SessionRecord } from './telemetry';

/**
 * Signals are per-(session × game) observations that sit outside the reference
 * band for the child's age. A signal is NOT a flag. A signal is one number,
 * from one game, on one day — the spec is explicit that this can never be
 * enough on its own.
 *
 * Signal names are behavioural descriptions of what happened on screen. There
 * is no signal in this file that names a condition, and none that can be
 * mapped one-to-one onto one, by design.
 */

export const SIGNAL_IDS = [
  'slow_response',
  'slow_task_switch',
  'repeated_selection',
  'low_match_rate',
  'uneven_timing',
] as const;

export type SignalId = (typeof SIGNAL_IDS)[number];

export type Signal = {
  id: SignalId;
  session_id: string;
  game_id: GameId;
  domain: DomainId;
  observed_at: number;
  metric: MetricId;
  value: number;
  expected_range: string;
  /** How far outside the band, in range-widths. See norms.deviation(). */
  strength: number;
  /** Rounds this observation was computed from. */
  round_count: number;
};

export type SignalMeta = {
  id: SignalId;
  /** Parent-facing clause. Reads as part of a sentence. */
  clause: string;
  /** Clinician-facing clause — same meaning, terser. */
  clinicalClause: string;
  /** The one-line "what we watched" line in the report. */
  measure: string;
};

export const SIGNAL_META: Record<SignalId, SignalMeta> = {
  slow_response: {
    id: 'slow_response',
    clause: 'longer pauses before responding after an instruction finished',
    clinicalClause: 'extended latency from prompt offset to first response',
    measure: 'Time from the end of the spoken instruction to the first tap',
  },
  slow_task_switch: {
    id: 'slow_task_switch',
    clause: 'slower-than-typical response switching between tasks',
    clinicalClause: 'increased switch cost when the task rule changed',
    measure: 'Extra time taken when the game changed what it was asking for',
  },
  repeated_selection: {
    id: 'repeated_selection',
    clause: 'more repeated selections than most children in this age range',
    clinicalClause: 'repeated selection of the same non-matching option',
    measure: 'How often the same non-matching option was chosen again',
  },
  low_match_rate: {
    id: 'low_match_rate',
    clause: 'fewer matches than is usual for this age range',
    clinicalClause: 'match rate below the age reference range',
    measure: 'How often the chosen option was the matching one',
  },
  uneven_timing: {
    id: 'uneven_timing',
    clause: 'less even timing when copying a rhythm',
    clinicalClause: 'increased inter-tap interval variability when copying rhythm',
    measure: 'How evenly spaced the taps were when copying a beat',
  },
};

/** Below this, a value outside the band is treated as ordinary day-to-day variation. */
export const SIGNAL_STRENGTH_GATE = 0.35;

/** A game visit with fewer rounds than this is too thin to read anything into. */
export const MIN_ROUNDS_FOR_SIGNAL = 4;

type MetricProbe = {
  signal: SignalId;
  metric: MetricId;
  compute: (rounds: RoundEvent[]) => number | null;
};

/**
 * The "rule" a round is playing under — the thing that changes when the task
 * switches. Pattern rounds change difficulty tier, language rounds change word
 * tier, beat rounds change sequence length. Picture-ordering rounds have no
 * within-visit rule change, so they contribute no switch-cost signal.
 */
function ruleOf(round: RoundEvent): number | null {
  const { difficulty_tier, word_tier, sequence_length } = round.extra;
  return difficulty_tier ?? word_tier ?? sequence_length ?? null;
}

/** Minimum rounds on each side of the comparison before a cost means anything. */
const MIN_PER_SWITCH_GROUP = 2;

/**
 * Task-switch cost: how much longer the child takes on a round whose rule just
 * changed, compared with a round whose rule stayed the same.
 *
 * This is a difference between two of the child's OWN timings in the SAME
 * visit, so every device-dependent constant — text-to-speech length, animation
 * timings, inter-round pause — cancels out. That is the whole reason it is used
 * in place of the raw `task_switch_time_ms` column, which does not cancel
 * anything and would end up measuring the phone's voice engine.
 */
export function switchCost(rounds: RoundEvent[]): number | null {
  const switched: number[] = [];
  const repeated: number[] = [];

  for (let i = 1; i < rounds.length; i += 1) {
    const latency = rounds[i].response_latency_ms;
    if (latency === null) continue;
    const previousRule = ruleOf(rounds[i - 1]);
    const currentRule = ruleOf(rounds[i]);
    if (previousRule === null || currentRule === null) continue;
    (currentRule === previousRule ? repeated : switched).push(latency);
  }

  if (switched.length < MIN_PER_SWITCH_GROUP || repeated.length < MIN_PER_SWITCH_GROUP) {
    return null;
  }
  const a = median(switched);
  const b = median(repeated);
  if (a === null || b === null) return null;
  return a - b;
}

const PROBES: MetricProbe[] = [
  {
    signal: 'slow_response',
    metric: 'responseLatencyMs',
    compute: rounds =>
      median(
        rounds
          .map(r => r.response_latency_ms)
          .filter((v): v is number => v !== null),
      ),
  },
  {
    signal: 'slow_task_switch',
    metric: 'taskSwitchCostMs',
    compute: switchCost,
  },
  {
    signal: 'repeated_selection',
    metric: 'repeatErrorRate',
    compute: rounds =>
      rounds.length === 0
        ? null
        : rounds.reduce((sum, r) => sum + Math.min(1, r.repeat_error_count), 0) / rounds.length,
  },
  {
    signal: 'low_match_rate',
    metric: 'accuracy',
    compute: rounds =>
      rounds.length === 0
        ? null
        : rounds.filter(r => r.response_correct).length / rounds.length,
  },
  {
    signal: 'uneven_timing',
    metric: 'rhythmDeviationMs',
    compute: rounds => {
      const values = rounds
        .map(r => r.extra.rhythm_deviation_ms)
        .filter((v): v is number => typeof v === 'number');
      return values.length === 0 ? null : median(values);
    },
  },
];

/** Derive every signal a single completed session produced. */
export function signalsForSession(session: SessionRecord): Signal[] {
  if (session.abandoned) return [];
  const band = bandForAge(session.age_months);
  const out: Signal[] = [];

  for (const gameId of session.game_ids) {
    const rounds = session.rounds.filter(r => r.game_id === gameId);
    if (rounds.length < MIN_ROUNDS_FOR_SIGNAL) continue;

    for (const probe of PROBES) {
      const value = probe.compute(rounds);
      if (value === null) continue;
      const metricBand = band.metrics[probe.metric];
      const strength = deviation(probe.metric, metricBand, value);
      if (strength < SIGNAL_STRENGTH_GATE) continue;

      out.push({
        id: probe.signal,
        session_id: session.session_id,
        game_id: gameId,
        domain: GAMES[gameId].domains[0],
        observed_at: session.ended_at,
        metric: probe.metric,
        value,
        expected_range: formatBand(probe.metric, metricBand),
        strength: Number(strength.toFixed(3)),
        round_count: rounds.length,
      });
    }
  }

  return out;
}

export function signalsForSessions(sessions: SessionRecord[]): Signal[] {
  return sessions.flatMap(signalsForSession);
}

export function formatSignalValue(signal: Signal): string {
  if (signal.metric === 'accuracy' || signal.metric === 'repeatErrorRate') {
    return `${Math.round(signal.value * 100)}%`;
  }
  if (signal.metric === 'taskSwitchCostMs') {
    return `${Math.round(signal.value)} ms extra`;
  }
  return `${Math.round(signal.value)} ms`;
}
