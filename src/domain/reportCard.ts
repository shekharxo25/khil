import { DOMAINS, type DomainId } from './domains';
import { GAMES, type GameId } from './games';
import { DAY_MS } from '../lib/time';
import { assertParentSafeCopy } from './safeLanguage';
import { signalsForSessions, SIGNAL_STRENGTH_GATE } from './signals';
import type { SessionRecord } from './telemetry';

/**
 * The parent-facing "report card" — Milestone spec v0.2, §1.
 *
 *   "A simple, non-numeric progress indicator (e.g. 'Growing well' / 'Right on
 *    track' / 'Let's keep an eye on this') — avoid red/yellow/green
 *    traffic-light colors... A short one-line plain-language note per domain
 *    ... A trend view over time (last 4-8 weeks) — simple line or bar,
 *    nothing clinical-looking."
 *
 * Everything here answers to the same rule as the rest of the domain layer:
 * no numbers, no raw measurements, and nothing that could be read as a
 * clinical instrument reach the parent. The status ladder is deliberately
 * coarse — three states, no numeric score behind them — and the trend is
 * "how much this was practiced", not "how fast" or "how accurate", because
 * play-count is the one weekly measure that cannot read as a clinical result.
 *
 * Raw accuracy/latency/deviation numbers still exist (`signals.ts`) and still
 * reach the specialist portal — this file is the parent-only view on top of
 * the same data, at a coarser grain.
 */

export const REPORT_PERIOD_DAYS = 28;
export const TREND_WEEKS = 6;
/** A domain needs at least this many sessions in the period to say anything about it. */
const MIN_SESSIONS_FOR_STATUS = 2;

export type DomainStatus = 'thriving' | 'on_track' | 'watch';

export const STATUS_LABEL: Record<DomainStatus, string> = {
  thriving: 'Growing well',
  on_track: 'Right on track',
  watch: 'Let’s keep an eye on this',
};

/**
 * Deliberately not a traffic-light red/yellow/green. Warm and cool neutrals
 * only — 'watch' is the same indigo as the flag card, never amber or red,
 * for the same reason the flag itself is indigo: this is "look here", not
 * "something is wrong".
 */
export type StatusTone = 'brand' | 'neutral' | 'notice';
export const STATUS_TONE: Record<DomainStatus, StatusTone> = {
  thriving: 'brand',
  on_track: 'neutral',
  watch: 'notice',
};

export type DomainReport = {
  domain: DomainId;
  status: DomainStatus;
  /** One line, plain language. Passed through the parent-safe-copy gate. */
  note: string;
  sessionsInPeriod: number;
  trend: WeeklyPoint[];
};

export type WeeklyPoint = {
  weekStart: number;
  /** How many rounds touching this domain happened in that week. */
  rounds: number;
};

function gamesForDomain(domain: DomainId): GameId[] {
  return Object.values(GAMES)
    .filter(g => g.domains.includes(domain))
    .map(g => g.id);
}

function startOfWeekMs(ms: number): number {
  const d = new Date(ms);
  const day = (d.getDay() + 6) % 7; // Monday-anchored
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

/** Weekly practice count for one domain, oldest week first. */
export function domainTrend(
  sessions: SessionRecord[],
  domain: DomainId,
  now: number = Date.now(),
  weeks: number = TREND_WEEKS,
): WeeklyPoint[] {
  const games = new Set(gamesForDomain(domain));
  const currentWeekStart = startOfWeekMs(now);
  const buckets: WeeklyPoint[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    buckets.push({ weekStart: currentWeekStart - i * 7 * DAY_MS, rounds: 0 });
  }

  for (const session of sessions) {
    if (session.abandoned || session.off_band) continue;
    if (!session.game_ids.some(id => games.has(id))) continue;
    const weekStart = startOfWeekMs(session.ended_at);
    const bucket = buckets.find(b => b.weekStart === weekStart);
    if (!bucket) continue;
    bucket.rounds += session.rounds.filter(r => games.has(r.game_id)).length;
  }

  return buckets;
}

const NOTES: Record<DomainStatus, ((domainLabel: string) => string)[]> = {
  thriving: [
    label => `Loves ${label.toLowerCase()} games — quick and steady this month.`,
    label => `${label} has been a strength this month, and it shows in how eagerly it’s played.`,
  ],
  on_track: [
    label => `${label} is coming along steadily, right where we’d expect.`,
    label => `Nothing stands out here — ${label.toLowerCase()} is developing at a typical pace.`,
  ],
  watch: [
    label => `${label} has looked a little different than usual lately — worth keeping an eye on.`,
    label => `We’ve noticed some unevenness in ${label.toLowerCase()} this month.`,
  ],
};

function pickNote(status: DomainStatus, domain: DomainId, seed: number): string {
  const options = NOTES[status];
  const note = options[seed % options.length](DOMAINS[domain].label);
  return assertParentSafeCopy(note, `reportCard.note.${domain}.${status}`);
}

/**
 * The status ladder for one domain over the report period, or null when
 * there isn't enough play yet to say anything — silence is the honest answer
 * then, not a forced status.
 */
export function domainReport(
  sessions: SessionRecord[],
  domain: DomainId,
  now: number = Date.now(),
): DomainReport | null {
  const games = new Set(gamesForDomain(domain));
  const periodStart = now - REPORT_PERIOD_DAYS * DAY_MS;
  const periodSessions = sessions.filter(
    s =>
      !s.abandoned &&
      !s.off_band &&
      s.ended_at >= periodStart &&
      s.ended_at <= now &&
      s.game_ids.some(id => games.has(id)),
  );
  if (periodSessions.length < MIN_SESSIONS_FOR_STATUS) return null;

  // Reuses the exact same per-session signal computation the flag engine
  // reads from — the report card's "watch" state and the flag engine's
  // trigger are answerable to the same numbers, just shown at a coarser grain.
  const signals = signalsForSessions(periodSessions).filter(s => s.domain === domain);
  const sessionsWithSignal = new Set(signals.map(s => s.session_id));
  const hasRecurringSignal = sessionsWithSignal.size >= 2;

  const roundsInDomain = periodSessions.flatMap(s =>
    s.rounds.filter(r => games.has(r.game_id)),
  );
  const accuracy =
    roundsInDomain.length === 0
      ? null
      : roundsInDomain.filter(r => r.response_correct).length / roundsInDomain.length;
  const noSignalAtAll = signals.every(s => s.strength < SIGNAL_STRENGTH_GATE);

  let status: DomainStatus;
  if (hasRecurringSignal) status = 'watch';
  else if (noSignalAtAll && accuracy !== null && accuracy >= 0.82) status = 'thriving';
  else status = 'on_track';

  const seed = periodSessions.length + roundsInDomain.length;
  return {
    domain,
    status,
    note: pickNote(status, domain, seed),
    sessionsInPeriod: periodSessions.length,
    trend: domainTrend(sessions, domain, now),
  };
}

/** Every domain with enough play to report on, most-played first. */
export function reportCard(sessions: SessionRecord[], now: number = Date.now()): DomainReport[] {
  return (Object.keys(DOMAINS) as DomainId[])
    .map(d => domainReport(sessions, d, now))
    .filter((r): r is DomainReport => r !== null)
    .sort((a, b) => b.sessionsInPeriod - a.sessionsInPeriod);
}

export type ReportPeriod = {
  /** 0 = current (in-progress) period, 1 = the one before it, etc. */
  index: number;
  start: number;
  end: number;
  label: string;
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatShort(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Past report-card periods, most recent first, back to the child's first session. */
export function pastPeriods(
  sessions: SessionRecord[],
  now: number = Date.now(),
  maxPeriods: number = 6,
): ReportPeriod[] {
  const played = sessions.filter(s => !s.abandoned);
  if (played.length === 0) return [];
  const earliest = Math.min(...played.map(s => s.started_at));
  const periods: ReportPeriod[] = [];
  for (let i = 0; i < maxPeriods; i += 1) {
    const end = now - i * REPORT_PERIOD_DAYS * DAY_MS;
    const start = end - REPORT_PERIOD_DAYS * DAY_MS;
    if (start < earliest - REPORT_PERIOD_DAYS * DAY_MS) break;
    periods.push({
      index: i,
      start,
      end,
      label: i === 0 ? 'This period (in progress)' : `${formatShort(start)} – ${formatShort(end)}`,
    });
  }
  return periods;
}
