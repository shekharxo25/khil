import { createRng, seedFromString, type Rng } from '../lib/random';
import { DAY_MS } from '../lib/time';
import { ageInMonths } from '../lib/time';
import { GAMES, type GameId } from '../domain/games';
import { bandForAge } from '../domain/norms';
import { tierSchedule } from '../domain/tiers';
import { buildRoundEvent, type RoundEvent, type SessionRecord, type TapMark } from '../domain/telemetry';
import type { ClusterPatient } from './types';

/**
 * Demo history generator.
 *
 * The important property here: seeded sessions are *real* telemetry rows run
 * through the same `buildRoundEvent` the live games use. No flag is ever
 * hard-coded. If the demo shows a flag, the flag engine genuinely produced it
 * from these numbers, and turning the numbers down makes the flag disappear.
 * A rigged demo would undercut the entire honesty argument of the product.
 */

export type SeedMode = 'typical' | 'cluster';

type Range = [number, number];

function between(rng: Rng, [lo, hi]: Range): number {
  return lo + rng() * (hi - lo);
}

type GameProfile = {
  /** Latency on a round whose rule matches the previous round. */
  baseLatency: Range;
  /** Extra latency on a round where the rule just changed — the switch cost. */
  switchPenalty: Range;
  /** Exact share of rounds answered correctly on the first tap. */
  accuracy: number;
  /** Share of the incorrect rounds that also contain a repeated wrong selection. */
  repeatShare: number;
  rhythmDeviation?: Range;
};

/** Comfortably inside every reference band for the age. */
function typicalProfile(ageMonths: number): GameProfile {
  const band = bandForAge(ageMonths).metrics;
  const lat = band.responseLatencyMs;
  return {
    baseLatency: [lat.low + 150, lat.high - 450],
    switchPenalty: [60, 240],
    accuracy: 0.875,
    repeatShare: 0,
    rhythmDeviation: [90, band.rhythmDeviationMs.high - 90],
  };
}

/**
 * The shape the flag engine is built to notice: ordinary speed when the task
 * stays the same, a large cost when the rule changes, and more repeated
 * selections of an option that already did not work.
 *
 * Note what this profile does NOT do — it does not make the child globally
 * slow or globally wrong. A profile that failed at everything would trip the
 * engine trivially and prove nothing about whether the clustering rule works.
 */
function clusterProfile(ageMonths: number): GameProfile {
  const band = bandForAge(ageMonths).metrics;
  const lat = band.responseLatencyMs;
  return {
    baseLatency: [lat.low + 150, lat.high - 450],
    switchPenalty: [950, 1450],
    accuracy: 0.625,
    repeatShare: 1,
    rhythmDeviation: [90, band.rhythmDeviationMs.high - 90],
  };
}

/** `count` indices spread as evenly as possible across `total` positions. */
function spreadIndices(total: number, count: number): Set<number> {
  const out = new Set<number>();
  if (count <= 0 || total <= 0) return out;
  for (let k = 0; k < count; k += 1) {
    out.add(Math.min(total - 1, Math.floor(((k + 0.5) * total) / count)));
  }
  return out;
}

function makeRounds(
  rng: Rng,
  args: {
    childId: string;
    sessionId: string;
    gameId: GameId;
    ageMonths: number;
    count: number;
    startedAt: number;
    profile: GameProfile;
  },
): { rounds: RoundEvent[]; endedAt: number } {
  const rounds: RoundEvent[] = [];
  let cursor = args.startedAt;
  let previousRoundEnd: number | null = null;

  // The same schedule the live games use, so seeded and played data are
  // structurally identical as far as the switch-cost probe is concerned.
  const tiers = tierSchedule(args.count);

  // Which rounds go wrong is scheduled, not sampled. With visits this short,
  // sampling would make a demo's flag depend on a coin toss — and a screening
  // demo that only sometimes reproduces is not a demo of anything.
  const wrongRounds = spreadIndices(args.count, Math.round(args.count * (1 - args.profile.accuracy)));
  const repeatRounds = new Set(
    Array.from(wrongRounds).slice(0, Math.round(wrongRounds.size * args.profile.repeatShare)),
  );

  for (let i = 0; i < args.count; i += 1) {
    const rule = args.gameId === 'beat' ? 2 + Math.floor(i / 2) : tiers[i];
    const previousRule =
      i === 0 ? null : args.gameId === 'beat' ? 2 + Math.floor((i - 1) / 2) : tiers[i - 1];
    const switched = previousRule !== null && rule !== previousRule;

    const promptMs = 1600 + rng() * 900;
    const promptEnd = cursor + promptMs;
    const latency =
      Math.round(between(rng, args.profile.baseLatency)) +
      (switched ? Math.round(between(rng, args.profile.switchPenalty)) : 0);
    const firstResponse: number = promptEnd + latency;

    const correct = !wrongRounds.has(i);
    const repeats = !correct && repeatRounds.has(i) ? 1 + (i % 2) : 0;

    const taps: TapMark[] = [];
    for (let t = 0; t < repeats; t += 1) {
      taps.push({ at: latency + t * 700, target: 1, correct: false });
    }
    taps.push({ at: latency + repeats * 700, target: correct ? 0 : 2, correct });

    const roundEnd: number = firstResponse + repeats * 700 + 900;

    rounds.push(
      buildRoundEvent({
        child_id: args.childId,
        session_id: args.sessionId,
        game_id: args.gameId,
        round_number: i + 1,
        age_months: args.ageMonths,
        prompt_end_timestamp: promptEnd,
        first_response_timestamp: firstResponse,
        response_correct: correct,
        repeat_error_count: repeats,
        previous_round_end: previousRoundEnd,
        extra: {
          taps,
          error_type: correct ? 'none' : 'wrong_target',
          ...(args.gameId === 'beat'
            ? {
                rhythm_deviation_ms: Math.round(
                  between(rng, args.profile.rhythmDeviation ?? [100, 220]),
                ),
                sequence_length: rule,
              }
            : {}),
          ...(args.gameId === 'pattern' ? { difficulty_tier: rule } : {}),
          ...(args.gameId === 'language' ? { word_tier: rule } : {}),
        },
      }),
    );

    previousRoundEnd = roundEnd;
    cursor = roundEnd + 1_200;
  }

  return { rounds, endedAt: cursor };
}

export type SeedOptions = {
  childId: string;
  dobIso: string;
  mode: SeedMode;
  now?: number;
};

/**
 * Twelve days of play. In 'cluster' mode the last three sessions carry the
 * unusual pattern — which is exactly the "more than one session, more than one
 * kind of signal" shape the engine requires before it will say anything.
 */
export function seedSessions(options: SeedOptions): SessionRecord[] {
  const now = options.now ?? Date.now();
  const rng = createRng(seedFromString(`${options.childId}:${options.mode}`));

  const daysAgo = [11, 9, 7, 5, 3, 1];
  const rotation: GameId[][] = [
    ['pattern', 'language'],
    ['beat', 'sequence'],
    ['language', 'pattern'],
    ['pattern', 'beat'],
    ['language', 'sequence'],
    ['pattern', 'language'],
  ];

  const sessions: SessionRecord[] = [];

  daysAgo.forEach((offset, index) => {
    const startedAt = now - offset * DAY_MS + 9 * 60 * 60 * 1000;
    const ageMonths = ageInMonths(options.dobIso, new Date(startedAt));
    const sessionId = `seed_${options.mode}_${index}`;
    const gameIds = rotation[index].filter(
      id => ageMonths >= GAMES[id].minAgeMonths && ageMonths <= GAMES[id].maxAgeMonths,
    );
    if (gameIds.length === 0) return;

    // Only the last three sessions carry the cluster, and only in the games
    // whose primary domain is the one being clustered on.
    const carriesCluster = options.mode === 'cluster' && offset <= 5;

    let cursor = startedAt;
    const rounds: RoundEvent[] = [];

    for (const gameId of gameIds) {
      const useCluster = carriesCluster && (gameId === 'pattern' || gameId === 'language');
      const profile = useCluster ? clusterProfile(ageMonths) : typicalProfile(ageMonths);
      const result = makeRounds(rng, {
        childId: options.childId,
        sessionId,
        gameId,
        ageMonths,
        count: 8,
        startedAt: cursor,
        profile,
      });
      rounds.push(...result.rounds);
      cursor = result.endedAt + 3_000;
    }

    sessions.push({
      session_id: sessionId,
      child_id: options.childId,
      started_at: startedAt,
      ended_at: cursor,
      game_ids: gameIds,
      age_months: ageMonths,
      seed: Math.floor(rng() * 1e9),
      rounds,
      abandoned: false,
    });
  });

  return sessions;
}

/** The other families in the clinician's cluster (wireframe 05). Static, fictional. */
export function clusterPatientsFor(pin: string): ClusterPatient[] {
  const roster: Record<string, ClusterPatient[]> = {
    '380015': [
      { id: 'p_diya', name: 'Diya', age_years: 3, pin, status: 'clear', note: 'no flags this month' },
      { id: 'p_kabir', name: 'Kabir', age_years: 5, pin, status: 'booked', note: 'consultation booked' },
      { id: 'p_ira', name: 'Ira', age_years: 4, pin, status: 'clear', note: 'no flags this month' },
    ],
    '380009': [
      { id: 'p_veer', name: 'Veer', age_years: 4, pin, status: 'clear', note: 'no flags this month' },
      { id: 'p_anaya', name: 'Anaya', age_years: 2, pin, status: 'clear', note: 'no flags this month' },
    ],
    '560034': [
      { id: 'p_rehan', name: 'Rehan', age_years: 5, pin, status: 'booked', note: 'consultation booked' },
      { id: 'p_meher', name: 'Meher', age_years: 3, pin, status: 'clear', note: 'no flags this month' },
    ],
    '400050': [
      { id: 'p_zoya', name: 'Zoya', age_years: 4, pin, status: 'clear', note: 'no flags this month' },
      { id: 'p_arjun', name: 'Arjun', age_years: 6, pin, status: 'booked', note: 'consultation booked' },
    ],
  };
  return roster[pin] ?? [];
}
