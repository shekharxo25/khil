import { makeId } from '../lib/id';
import { DAY_MS, formatDate } from '../lib/time';
import type { DomainId } from './domains';
import { moduleName, type GameId } from './games';
import { assertSafeCopy } from './safeLanguage';
import {
  SIGNAL_META,
  formatSignalValue,
  signalsForSessions,
  type Signal,
  type SignalId,
} from './signals';
import { median, type SessionRecord } from './telemetry';

/**
 * Flag engine — spec §3:
 *
 *   "a flag should only ever be generated from a cluster of unusual signals
 *    across more than one session/game, never from a single bad round in a
 *    single game. This is both more honest and avoids a jittery, alarming
 *    flag rate."
 *
 * So the gate is deliberately hard to pass. Six conditions must ALL hold, and
 * every one of them is checkable and shown in the dev panel, because a
 * screening aid whose trigger logic is a black box is not a trustworthy one.
 *
 * The engine is pure: sessions and existing flags in, an evaluation out. No
 * storage, no side effects, no time-of-day dependence beyond the `now` you
 * pass in — which is what makes it testable.
 */

export const FLAG_RULES = {
  /** Only look at recent play. Older signals say little about now. */
  windowDays: 14,
  /** A child needs a baseline of play before anything is said about them. */
  minValidSessions: 3,
  /** Total qualifying signals inside the window. */
  minSignals: 3,
  /** Spec: never a single session. */
  minDistinctSessions: 2,
  /** Spec: never a single kind of oddness — it must be a cluster. */
  minDistinctSignalTypes: 2,
  /** At least one signal type must recur, i.e. it wasn't a one-off day. */
  minRecurringTypeSessions: 2,
  /** Combined strength, in reference-range widths, of the recurring cluster. */
  minClusterStrength: 1.2,
  /** After a flag is closed, stay quiet for this long before raising another. */
  cooldownDays: 21,
} as const;

export type FlagStatus =
  | 'open'
  | 'booked'
  | 'snoozed'
  | 'closed_not_concerning'
  | 'closed_needs_visit';

export type FlagOutcome = 'not_concerning' | 'needs_visit';

export type FlagEvidence = {
  signal_id: SignalId;
  measure: string;
  observed: string;
  expected_range: string;
  sessions: number;
  modules: string[];
};

export type Flag = {
  id: string;
  child_id: string;
  created_at: number;
  window_start: number;
  window_end: number;
  status: FlagStatus;

  primary_domain: DomainId;
  primary_game: GameId;
  session_ids: string[];
  signals: Signal[];
  evidence: FlagEvidence[];

  /** "14 Aug 2026 · Pattern matching module" — wireframe 04. */
  observed_label: string;
  parent_headline: string;
  parent_body: string;
  /** Wireframe 06: same descriptive, non-diagnostic language as the parent view. */
  clinician_note: string;

  snooze_until?: number;
  outcome?: { outcome: FlagOutcome; marked_at: number; by: string };
  /** Set when the parent books, so the clinician list can show it. */
  booked_at?: number;
};

export type Criterion = {
  id: string;
  label: string;
  met: boolean;
  detail: string;
};

export type FlagEvaluation = {
  criteria: Criterion[];
  eligible: boolean;
  /** Present only when every criterion is met. */
  flag: Flag | null;
  /** All signals found in the window, met or not — for the dev panel. */
  windowSignals: Signal[];
};

function withinWindow(session: SessionRecord, now: number): boolean {
  return now - session.ended_at <= FLAG_RULES.windowDays * DAY_MS;
}

function distinct<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinClauses(clauses: string[]): string {
  if (clauses.length === 0) return '';
  if (clauses.length === 1) return `${sentenceCase(clauses[0])}.`;
  if (clauses.length === 2) return `${sentenceCase(clauses[0])}, and ${clauses[1]}.`;
  const head = clauses.slice(0, -1).join(', ');
  return `${sentenceCase(head)}, and ${clauses[clauses.length - 1]}.`;
}

/** Total strength per signal type, and how many distinct sessions it appeared in. */
function groupByType(signals: Signal[]) {
  const map = new Map<
    SignalId,
    { strength: number; sessions: Set<string>; games: Set<GameId>; signals: Signal[] }
  >();
  for (const signal of signals) {
    const entry =
      map.get(signal.id) ??
      { strength: 0, sessions: new Set<string>(), games: new Set<GameId>(), signals: [] };
    entry.strength += signal.strength;
    entry.sessions.add(signal.session_id);
    entry.games.add(signal.game_id);
    entry.signals.push(signal);
    map.set(signal.id, entry);
  }
  return map;
}

export function evaluateFlag(
  childId: string,
  sessions: SessionRecord[],
  existingFlags: Flag[],
  now: number = Date.now(),
): FlagEvaluation {
  const childSessions = sessions
    .filter(s => s.child_id === childId && !s.abandoned && !s.off_band)
    .sort((a, b) => a.ended_at - b.ended_at);
  const windowSessions = childSessions.filter(s => withinWindow(s, now));
  const windowSignals = signalsForSessions(windowSessions);

  const byType = groupByType(windowSignals);
  const recurringTypes = Array.from(byType.entries()).filter(
    ([, entry]) => entry.sessions.size >= FLAG_RULES.minRecurringTypeSessions,
  );
  const clusterStrength = recurringTypes.reduce((sum, [, entry]) => sum + entry.strength, 0);

  const openFlag = existingFlags.find(
    f => f.child_id === childId && (f.status === 'open' || f.status === 'booked' || f.status === 'snoozed'),
  );
  const lastClosed = existingFlags
    .filter(f => f.child_id === childId && f.status.startsWith('closed'))
    .sort((a, b) => (b.outcome?.marked_at ?? b.created_at) - (a.outcome?.marked_at ?? a.created_at))[0];
  const inCooldown = lastClosed
    ? now - (lastClosed.outcome?.marked_at ?? lastClosed.created_at) <
      FLAG_RULES.cooldownDays * DAY_MS
    : false;

  const criteria: Criterion[] = [
    {
      id: 'baseline',
      label: `At least ${FLAG_RULES.minValidSessions} complete sessions in the last ${FLAG_RULES.windowDays} days`,
      met: windowSessions.length >= FLAG_RULES.minValidSessions,
      detail: `${windowSessions.length} complete session${windowSessions.length === 1 ? '' : 's'}`,
    },
    {
      id: 'signals',
      label: `At least ${FLAG_RULES.minSignals} signals outside the age reference range`,
      met: windowSignals.length >= FLAG_RULES.minSignals,
      detail: `${windowSignals.length} signal${windowSignals.length === 1 ? '' : 's'}`,
    },
    {
      id: 'sessions',
      label: `Signals span at least ${FLAG_RULES.minDistinctSessions} different sessions`,
      met: distinct(windowSignals.map(s => s.session_id)).length >= FLAG_RULES.minDistinctSessions,
      detail: `${distinct(windowSignals.map(s => s.session_id)).length} session${
        distinct(windowSignals.map(s => s.session_id)).length === 1 ? '' : 's'
      }`,
    },
    {
      id: 'types',
      label: `At least ${FLAG_RULES.minDistinctSignalTypes} different kinds of signal`,
      met: byType.size >= FLAG_RULES.minDistinctSignalTypes,
      detail: `${byType.size} kind${byType.size === 1 ? '' : 's'}`,
    },
    {
      id: 'recurring',
      label: `At least one kind of signal recurs across ${FLAG_RULES.minRecurringTypeSessions}+ sessions`,
      met: recurringTypes.length > 0,
      detail:
        recurringTypes.length > 0
          ? recurringTypes.map(([id]) => SIGNAL_META[id].measure).join('; ')
          : 'no repeat across sessions',
    },
    {
      id: 'strength',
      label: `Combined strength of the recurring cluster ≥ ${FLAG_RULES.minClusterStrength}`,
      met: clusterStrength >= FLAG_RULES.minClusterStrength,
      detail: clusterStrength.toFixed(2),
    },
    {
      id: 'quiet',
      label: 'No flag already open, and not inside the post-review quiet period',
      met: !openFlag && !inCooldown,
      detail: openFlag
        ? 'a flag is already open'
        : inCooldown
          ? `quiet until ${formatDate(
              (lastClosed?.outcome?.marked_at ?? lastClosed?.created_at ?? now) +
                FLAG_RULES.cooldownDays * DAY_MS,
            )}`
          : 'clear',
    },
  ];

  const eligible = criteria.every(c => c.met);
  if (!eligible) {
    return { criteria, eligible: false, flag: null, windowSignals };
  }

  // Build the flag from the recurring cluster only — the part that actually held up.
  const clusterSignals = recurringTypes.flatMap(([, entry]) => entry.signals);
  const ranked = recurringTypes
    .slice()
    .sort((a, b) => b[1].strength - a[1].strength);

  const topTypes = ranked.slice(0, 2).map(([id]) => id);
  const clauses = topTypes.map(id => SIGNAL_META[id].clause);
  const clinicalClauses = topTypes.map(id => SIGNAL_META[id].clinicalClause);

  const strongest = clusterSignals
    .slice()
    .sort((a, b) => b.strength - a.strength)[0];
  const modules = distinct(clusterSignals.map(s => moduleName(s.game_id)));
  const sessionIds = distinct(clusterSignals.map(s => s.session_id));

  const evidence: FlagEvidence[] = ranked.map(([id, entry]) => {
    const representative = entry.signals.slice().sort((a, b) => b.strength - a.strength)[0];
    // Report the median across the observations of this type, not the worst
    // one. Quoting the single most extreme reading back to a parent overstates
    // what was actually seen, and it is the easiest way for a screening tool to
    // become quietly alarmist.
    const typical =
      median(entry.signals.map(s => s.value)) ?? representative.value;
    return {
      signal_id: id,
      measure: SIGNAL_META[id].measure,
      observed: formatSignalValue({ ...representative, value: typical }),
      expected_range: representative.expected_range,
      sessions: entry.sessions.size,
      modules: Array.from(entry.games).map(moduleName),
    };
  });

  const parentBody = assertSafeCopy(joinClauses(clauses), 'flag.parent_body');
  const parentHeadline = assertSafeCopy(
    'We noticed something worth a second look',
    'flag.parent_headline',
  );
  const clinicianNote = assertSafeCopy(
    `${joinClauses(clinicalClauses).replace(/\.$/, '')} observed during ${
      modules.length === 1 ? `the ${modules[0].toLowerCase()}` : listify(modules.map(m => m.toLowerCase()))
    }, across ${sessionIds.length} sessions between ${formatDate(
      Math.min(...clusterSignals.map(s => s.observed_at)),
    )} and ${formatDate(Math.max(...clusterSignals.map(s => s.observed_at)))}.`,
    'flag.clinician_note',
  );

  const flag: Flag = {
    id: makeId('flag'),
    child_id: childId,
    created_at: now,
    window_start: now - FLAG_RULES.windowDays * DAY_MS,
    window_end: now,
    status: 'open',
    primary_domain: strongest.domain,
    primary_game: strongest.game_id,
    session_ids: sessionIds,
    signals: clusterSignals,
    evidence,
    observed_label: `${formatDate(strongest.observed_at)} · ${moduleName(strongest.game_id)}`,
    parent_headline: parentHeadline,
    parent_body: parentBody,
    clinician_note: clinicianNote,
  };

  return { criteria, eligible: true, flag, windowSignals };
}

function listify(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Fixed reassurance copy — wireframe 04, note 2. Never generated, never varied. */
export const REASSURANCE_TITLE = 'What this is — and isn’t';
export const REASSURANCE_BODY =
  'This is a pattern worth discussing with a specialist. It is not a diagnosis, and most flags do not turn out to indicate anything.';

export const CHILD_SAFE_DISCLAIMER =
  'Khil is a screening aid. It never decides anything about your child on its own.';
