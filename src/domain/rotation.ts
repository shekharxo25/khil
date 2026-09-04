import { DOMAIN_IDS, type DomainId } from './domains';
import { GAMES, gamesForAge, type GameId, type GameMeta } from './games';
import type { SessionRecord } from './telemetry';
import { startOfWeek } from '../lib/time';

/**
 * Session rotation — spec §3.
 *
 *   "don't run all 4 games every day — rotate 1–2 games per session (2–4 min
 *    total)... Across a week, the child should hit all domains at least twice,
 *    which is what feeds the dashboard's 'skills tracked' stat."
 *
 * The planner is a greedy coverage solver: pick the game that closes the
 * biggest gap against this week's target, then optionally a second game that
 * adds the most *new* coverage on top of the first. Recency is a tie-breaker so
 * the same game never lands twice in a row when an alternative exists.
 */

/** Each of the six domains should be touched this many times per week. */
export const WEEKLY_DOMAIN_TARGET = 2;

/** Wireframe 02 shows "Session X of 10" — a ten-session block. */
export const SESSIONS_PER_BLOCK = 10;

export type PlannedGame = { game_id: GameId; rounds: number };

export type SessionPlan = {
  games: PlannedGame[];
  /** Rough wall-clock estimate, used to keep a session inside 2–4 minutes. */
  estimated_ms: number;
  /** Domains this plan will touch. */
  domains: DomainId[];
  /** Why these games — surfaced in the parent's pre-session card. */
  rationale: string;
};

/** Per-round wall-clock estimate, including the spoken prompt. */
const ROUND_MS: Record<GameId, number> = {
  pattern: 12_000,
  language: 11_000,
  beat: 15_000,
  sequence: 20_000,
  inhibit: 3_200,
  rhyme: 13_000,
  trace: 14_000,
  quantity: 7_000,
};

const INTRO_MS = 6_000;

/** Rounds are trimmed when two games share a session, but never below this. */
const MIN_ROUNDS_PER_VISIT = 4;

function roundsFor(meta: GameMeta, gamesInSession: number): number {
  if (gamesInSession <= 1) return meta.rounds;
  return Math.max(MIN_ROUNDS_PER_VISIT, Math.ceil(meta.rounds * 0.6));
}

export type WeekCoverage = Record<DomainId, number>;

export function emptyCoverage(): WeekCoverage {
  return DOMAIN_IDS.reduce((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {} as WeekCoverage);
}

/** How many times each domain has been touched since Monday. */
export function weekCoverage(
  sessions: SessionRecord[],
  now: Date = new Date(),
): WeekCoverage {
  const since = startOfWeek(now).getTime();
  const coverage = emptyCoverage();
  for (const session of sessions) {
    if (session.ended_at < since || session.abandoned) continue;
    for (const gameId of session.game_ids) {
      for (const domain of GAMES[gameId].domains) {
        coverage[domain] += 1;
      }
    }
  }
  return coverage;
}

export function domainsTrackedThisWeek(coverage: WeekCoverage): DomainId[] {
  return DOMAIN_IDS.filter(id => coverage[id] > 0);
}

/** The two domains a week leaned on — feeds "This week's focus" (wireframe 03). */
export function weeklyFocus(coverage: WeekCoverage): DomainId[] {
  return DOMAIN_IDS.filter(id => coverage[id] > 0)
    .sort((a, b) => coverage[b] - coverage[a])
    .slice(0, 2);
}

function gapScore(meta: GameMeta, coverage: WeekCoverage): number {
  return meta.domains.reduce(
    (sum, domain) => sum + Math.max(0, WEEKLY_DOMAIN_TARGET - coverage[domain]),
    0,
  );
}

function lastPlayedAt(gameId: GameId, sessions: SessionRecord[]): number {
  let latest = 0;
  for (const session of sessions) {
    if (session.game_ids.includes(gameId) && session.ended_at > latest) {
      latest = session.ended_at;
    }
  }
  return latest;
}

export type PlanOptions = {
  ageMonths: number;
  sessions: SessionRecord[];
  /** Spec §5: the course MVP is Games 1 and 2. Dev panel can toggle this. */
  mvpOnly?: boolean;
  now?: Date;
};

export function planSession(options: PlanOptions): SessionPlan {
  const now = options.now ?? new Date();
  const coverage = weekCoverage(options.sessions, now);

  let eligible = gamesForAge(options.ageMonths);
  if (options.mvpOnly) {
    const mvp = eligible.filter(g => g.mvp);
    if (mvp.length > 0) eligible = mvp;
  }
  if (eligible.length === 0) {
    // Age outside every band — fall back to the widest-age game rather than nothing.
    eligible = [GAMES.language];
  }

  const rank = (candidates: GameMeta[], cov: WeekCoverage) =>
    candidates
      .slice()
      .sort((a, b) => {
        const gap = gapScore(b, cov) - gapScore(a, cov);
        if (gap !== 0) return gap;
        const recency = lastPlayedAt(a.id, options.sessions) - lastPlayedAt(b.id, options.sessions);
        if (recency !== 0) return recency; // least recently played first
        // With no history at all, every gap and every recency is identical.
        // Break that tie towards the two games spec §5 calls the core pair,
        // rather than towards whichever id sorts first alphabetically.
        if (a.mvp !== b.mvp) return a.mvp ? -1 : 1;
        return a.id.localeCompare(b.id); // stable
      });

  const first = rank(eligible, coverage)[0];

  // Provisional coverage after the first game, so the second adds something new.
  const afterFirst: WeekCoverage = { ...coverage };
  for (const domain of first.domains) afterFirst[domain] += 1;

  const stillNeeded = DOMAIN_IDS.some(id => afterFirst[id] < WEEKLY_DOMAIN_TARGET);
  const others = eligible.filter(g => g.id !== first.id);
  const second =
    stillNeeded && others.length > 0 ? rank(others, afterFirst)[0] : undefined;

  const chosen = second ? [first, second] : [first];
  const games: PlannedGame[] = chosen.map(meta => ({
    game_id: meta.id,
    rounds: roundsFor(meta, chosen.length),
  }));

  const estimated_ms = games.reduce(
    (sum, g) => sum + INTRO_MS + g.rounds * ROUND_MS[g.game_id],
    0,
  );

  const domains = Array.from(new Set(chosen.flatMap(g => g.domains)));

  return {
    games,
    estimated_ms,
    domains,
    rationale: buildRationale(chosen, coverage),
  };
}

function buildRationale(chosen: GameMeta[], coverage: WeekCoverage): string {
  const behind = DOMAIN_IDS.filter(id => coverage[id] < WEEKLY_DOMAIN_TARGET);
  const touches = chosen.flatMap(g => g.domains).filter(d => behind.includes(d));
  if (touches.length === 0) {
    return 'Every skill area has been covered this week — this session keeps things varied.';
  }
  return 'Picked to cover the skill areas that have had the least play this week.';
}

/** "Session X of 10" — position within the current ten-session block. */
export function sessionNumberInBlock(completedSessions: number): number {
  return (completedSessions % SESSIONS_PER_BLOCK) + 1;
}
