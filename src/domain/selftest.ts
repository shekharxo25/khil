import { seedSessions } from '../store/demoSeed';
import { DAY_MS } from '../lib/time';
import { applyOutcome, evaluateFlag, isParentVisible } from './flagEngine';
import { findParentUnsafeTerms, findUnsafeTerms, isSafeCopy } from './safeLanguage';
import { SIGNAL_META, SIGNAL_IDS } from './signals';
import { DOMAINS, DOMAIN_IDS } from './domains';
import { GAME_IDS, GAMES, moduleName } from './games';
import { AGE_BANDS, bandForAge, deviation } from './norms';
import { planSession } from './rotation';

/**
 * Runtime self-checks, surfaced in the dev panel.
 *
 * These are the invariants the spec states as rules rather than preferences —
 * the things that must be true of a build before it is shown to anyone. Having
 * them run inside the app (rather than only in a test file nobody opens during
 * a demo) means the claim "this never names a condition" is demonstrable on the
 * spot instead of merely asserted.
 */

export type CheckResult = { name: string; passed: boolean; detail: string };

const DOB_FOUR_YEARS = new Date(Date.now() - 4.5 * 365 * DAY_MS).toISOString();

export function runSelfTests(): CheckResult[] {
  const results: CheckResult[] = [];
  const check = (name: string, fn: () => string | true) => {
    try {
      const outcome = fn();
      results.push(
        outcome === true
          ? { name, passed: true, detail: 'ok' }
          : { name, passed: false, detail: outcome },
      );
    } catch (error) {
      results.push({ name, passed: false, detail: String(error) });
    }
  };

  // --- Language rule -------------------------------------------------------
  check('Condition names are rejected', () => {
    const samples = [
      'autism risk: high',
      'possible ASD indicators',
      'shows dyslexia markers',
      'attention deficit noted',
      'screening positive',
      'developmental delay suspected',
      'severity: moderate',
    ];
    const missed = samples.filter(s => findUnsafeTerms(s).length === 0);
    return missed.length === 0 ? true : `not caught: ${missed.join(' | ')}`;
  });

  check('Required disclaimer wording is allowed', () => {
    const allowed = [
      'This is not a diagnosis, and most flags do not turn out to indicate anything.',
      'I understand this is a screening aid, not a diagnosis.',
      'Slower-than-typical response switching between tasks.',
    ];
    const blocked = allowed.filter(s => !isSafeCopy(s));
    return blocked.length === 0 ? true : `wrongly blocked: ${blocked.join(' | ')}`;
  });

  check('Every signal phrase is behavioural', () => {
    const bad = SIGNAL_IDS.filter(
      id => !isSafeCopy(SIGNAL_META[id].clause) || !isSafeCopy(SIGNAL_META[id].clinicalClause),
    );
    return bad.length === 0 ? true : `unsafe phrasing: ${bad.join(', ')}`;
  });

  check('Every domain and module name is behavioural', () => {
    const bad = [
      ...DOMAIN_IDS.map(id => DOMAINS[id].label),
      ...DOMAIN_IDS.map(id => DOMAINS[id].blurb),
      ...GAME_IDS.map(id => GAMES[id].title),
      ...GAME_IDS.map(moduleName),
    ].filter(text => !isSafeCopy(text));
    return bad.length === 0 ? true : `unsafe: ${bad.join(' | ')}`;
  });

  // --- Flag engine ---------------------------------------------------------
  check('Ordinary play raises no flag', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'typical' });
    const result = evaluateFlag('selftest', sessions, []);
    return result.flag === null
      ? true
      : `flag raised on typical play: ${result.flag.parent_body}`;
  });

  check('A clustered pattern does raise a flag', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' });
    const result = evaluateFlag('selftest', sessions, []);
    if (!result.flag) {
      const failed = result.criteria.filter(c => !c.met).map(c => c.id);
      return `no flag; unmet criteria: ${failed.join(', ') || 'none'}`;
    }
    return true;
  });

  check('A single session can never raise a flag', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' });
    const worst = sessions[sessions.length - 1];
    const result = evaluateFlag('selftest', [worst], []);
    return result.flag === null ? true : 'a single session produced a flag';
  });

  check('A single round can never raise a flag', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' });
    const oneRoundEach = sessions.map(s => ({ ...s, rounds: s.rounds.slice(0, 1) }));
    const result = evaluateFlag('selftest', oneRoundEach, []);
    return result.flag === null ? true : 'one round per session produced a flag';
  });

  check('Abandoned sessions are excluded', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' }).map(
      s => ({ ...s, abandoned: true }),
    );
    const result = evaluateFlag('selftest', sessions, []);
    return result.flag === null ? true : 'abandoned sessions produced a flag';
  });

  check('Flag copy passes the language rule', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' });
    const result = evaluateFlag('selftest', sessions, []);
    if (!result.flag) return 'no flag to check';
    const unsafe = [
      result.flag.parent_headline,
      result.flag.parent_body,
      result.flag.clinician_note,
      ...result.flag.evidence.map(e => e.measure),
    ].filter(text => !isSafeCopy(text));
    return unsafe.length === 0 ? true : `unsafe: ${unsafe.join(' | ')}`;
  });

  check('Parent-facing flag copy passes the stricter raw-data ban too', () => {
    // Milestone spec v0.2 §1: the parent must never see the technical measure
    // names or raw numbers — that's pediatrician-only. clinician_note is
    // exempt on purpose; it is expected to contain exactly these terms.
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' });
    const result = evaluateFlag('selftest', sessions, []);
    if (!result.flag) return 'no flag to check';
    const unsafe = [result.flag.parent_headline, result.flag.parent_body].filter(
      text => findParentUnsafeTerms(text).length > 0,
    );
    return unsafe.length === 0
      ? true
      : `raw/technical language reached the parent: ${unsafe
          .map(t => `"${t}" -> ${findParentUnsafeTerms(t).join(', ')}`)
          .join(' | ')}`;
  });

  // --- Human-in-the-loop (Milestone spec v0.2 §4) ---------------------------
  check('A newly raised flag is never parent-visible', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' });
    const result = evaluateFlag('selftest', sessions, []);
    if (!result.flag) return 'no flag to check';
    return result.flag.status === 'pending_review' && !isParentVisible(result.flag)
      ? true
      : `status was "${result.flag.status}", parent-visible = ${isParentVisible(result.flag)}`;
  });

  check('A pediatrician dismissing a candidate keeps it invisible to the parent', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' });
    const result = evaluateFlag('selftest', sessions, []);
    if (!result.flag) return 'no flag to check';
    const patch = applyOutcome(result.flag, 'not_concerning', 'specialist');
    const after = { ...result.flag, ...patch };
    return !isParentVisible(after) && after.status === 'closed_not_concerning'
      ? true
      : `status became "${after.status}", parent-visible = ${isParentVisible(after)}`;
  });

  check('A pediatrician confirming "needs visit" is what makes it parent-visible', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' });
    const result = evaluateFlag('selftest', sessions, []);
    if (!result.flag) return 'no flag to check';
    const patch = applyOutcome(result.flag, 'needs_visit', 'specialist');
    const after = { ...result.flag, ...patch };
    return isParentVisible(after) && after.status === 'open'
      ? true
      : `status became "${after.status}", parent-visible = ${isParentVisible(after)}`;
  });

  check('"Diagnosis pending" also unlocks parent visibility, without the word reaching them', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' });
    const result = evaluateFlag('selftest', sessions, []);
    if (!result.flag) return 'no flag to check';
    const patch = applyOutcome(result.flag, 'diagnosis_pending', 'specialist');
    const after = { ...result.flag, ...patch };
    if (!isParentVisible(after)) return `status became "${after.status}", still not parent-visible`;
    return isSafeCopy(after.parent_body) && isSafeCopy(after.parent_headline)
      ? true
      : 'the word reached parent-facing copy';
  });

  check('Re-tagging an already-visible flag closes it instead of re-hiding it', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'cluster' });
    const result = evaluateFlag('selftest', sessions, []);
    if (!result.flag) return 'no flag to check';
    const openFlag = { ...result.flag, status: 'open' as const };
    const patch = applyOutcome(openFlag, 'needs_visit', 'specialist');
    return patch.status === 'closed_needs_visit'
      ? true
      : `expected closed_needs_visit, got ${patch.status}`;
  });

  // --- Reference bands -----------------------------------------------------
  check('Age bands cover ages 2 through 6 with no gap', () => {
    const sorted = AGE_BANDS.slice().sort((a, b) => a.minMonths - b.minMonths);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].minMonths !== sorted[i - 1].maxMonths + 1) {
        return `gap between ${sorted[i - 1].id} and ${sorted[i].id}`;
      }
    }
    return sorted[0].minMonths === 24 && sorted[sorted.length - 1].maxMonths >= 71
      ? true
      : 'bands do not span 24–71 months';
  });

  check('Deviation is zero inside the band and positive outside it', () => {
    const band = bandForAge(52).metrics.responseLatencyMs;
    const inside = deviation('responseLatencyMs', band, (band.low + band.high) / 2);
    const outside = deviation('responseLatencyMs', band, band.high + (band.high - band.low));
    if (inside !== 0) return `inside the band gave ${inside}`;
    return Math.abs(outside - 1) < 1e-6 ? true : `one range-width out gave ${outside}`;
  });

  // --- Rotation ------------------------------------------------------------
  check('Rotation never schedules more than two games', () => {
    const plan = planSession({ ageMonths: 54, sessions: [] });
    return plan.games.length >= 1 && plan.games.length <= 2
      ? true
      : `planned ${plan.games.length} games`;
  });

  check('Rotation respects the age band of each game', () => {
    const plan = planSession({ ageMonths: 30, sessions: [] }); // 2y6m
    const bad = plan.games.filter(
      g => 30 < GAMES[g.game_id].minAgeMonths || 30 > GAMES[g.game_id].maxAgeMonths,
    );
    return bad.length === 0 ? true : `age-inappropriate: ${bad.map(g => g.game_id).join(', ')}`;
  });

  check('A week of rotation reaches every skill area', () => {
    const sessions = seedSessions({ childId: 'selftest', dobIso: DOB_FOUR_YEARS, mode: 'typical' });
    const touched = new Set(sessions.flatMap(s => s.game_ids.flatMap(g => GAMES[g].domains)));
    const missing = DOMAIN_IDS.filter(id => !touched.has(id));
    return missing.length === 0 ? true : `never touched: ${missing.join(', ')}`;
  });

  return results;
}
