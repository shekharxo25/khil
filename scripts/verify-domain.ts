/**
 * Headless verification of Khil's decision logic.
 *
 *   npm run verify
 *
 * Runs the same self-checks the in-app audit panel shows, plus a printed trace
 * of what the flag engine actually produces from seeded data. It exits non-zero
 * on any failure, so it can gate a build.
 *
 * Why this exists as a script and not only as a UI panel: the three rules the
 * spec states as non-negotiable — no condition names anywhere, no flag from a
 * single round, no flag from a single session — are the kind of thing that
 * quietly regresses. Here they fail loudly.
 */

// safeLanguage throws in dev and warns in production. For a gate we want the
// production behaviour plus an explicit count, so violations are tallied rather
// than aborting the run at the first one.
(globalThis as Record<string, unknown>).__DEV__ = false;

import { runSelfTests } from '../src/domain/selftest';
import { evaluateFlag, isParentVisible } from '../src/domain/flagEngine';
import { signalsForSessions, SIGNAL_META } from '../src/domain/signals';
import { seedSessions } from '../src/store/demoSeed';
import { planSession, weekCoverage } from '../src/domain/rotation';
import { DOMAINS, DOMAIN_IDS } from '../src/domain/domains';
import { moduleName } from '../src/domain/games';

const DOB_4Y6M = new Date(Date.now() - Math.round(4.5 * 365 * 86_400_000)).toISOString();

function rule(text: string) {
  console.log(`\n${'─'.repeat(72)}\n${text}\n${'─'.repeat(72)}`);
}

rule('1. Self-checks');
const checks = runSelfTests();
for (const check of checks) {
  console.log(`  ${check.passed ? '✓' : '✗'} ${check.name}${check.passed ? '' : `\n      → ${check.detail}`}`);
}
const failures = checks.filter(c => !c.passed).length;
console.log(`\n  ${checks.length - failures}/${checks.length} passed`);

rule('2. Ordinary play — the engine should stay silent');
const typical = seedSessions({ childId: 'verify_typical', dobIso: DOB_4Y6M, mode: 'typical' });
const typicalSignals = signalsForSessions(typical);
const typicalEval = evaluateFlag('verify_typical', typical, []);
console.log(`  sessions: ${typical.length}, rounds: ${typical.reduce((n, s) => n + s.rounds.length, 0)}`);
console.log(`  signals outside the reference range: ${typicalSignals.length}`);
console.log(`  flag: ${typicalEval.flag ? '⚠ RAISED' : 'none'}`);

rule('3. Clustered pattern — the engine should speak up');
const cluster = seedSessions({ childId: 'verify_cluster', dobIso: DOB_4Y6M, mode: 'cluster' });
const clusterSignals = signalsForSessions(cluster);
console.log(`  sessions: ${cluster.length}, rounds: ${cluster.reduce((n, s) => n + s.rounds.length, 0)}`);
console.log(`  signals outside the reference range: ${clusterSignals.length}`);
for (const criterion of evaluateFlag('verify_cluster', cluster, []).criteria) {
  console.log(`  ${criterion.met ? '✓' : '○'} ${criterion.label}  [${criterion.detail}]`);
}

const clusterEval = evaluateFlag('verify_cluster', cluster, []);
if (clusterEval.flag) {
  const flag = clusterEval.flag;
  // A freshly raised flag is `pending_review` and is NOT actually shown to a
  // parent yet — see domain/flagEngine.ts's `isParentVisible`. This trace
  // prints the copy that WOULD be shown once a pediatrician confirms it, to
  // demonstrate the wording without implying it bypassed review.
  console.log(`\n  status: ${flag.status} (parent-visible: ${isParentVisible(flag)})`);
  console.log('\n  ── what the parent will see, once a specialist confirms it ──');
  console.log(`  ⚑ ${flag.parent_headline}`);
  console.log(`     ${flag.parent_body}`);
  console.log(`     observed on: ${flag.observed_label}`);
  console.log('\n  ── what the specialist sees right now, in the review queue ──');
  console.log(`     SYSTEM NOTE (NOT A DIAGNOSIS)`);
  console.log(`     ${flag.clinician_note}`);
  console.log('\n  ── evidence (pediatrician-only) ──');
  for (const item of flag.evidence) {
    console.log(
      `     ${item.measure}\n       observed ${item.observed} · typical ${item.expected_range} · ${item.sessions} sessions · ${item.modules.join(', ')}`,
    );
  }
} else {
  console.log('\n  ⚠ no flag produced from clustered data');
}

rule('4. Rotation coverage across a week');
const coverage = weekCoverage(cluster, new Date());
for (const id of DOMAIN_IDS) {
  console.log(`  ${DOMAINS[id].label.padEnd(22)} ${'●'.repeat(coverage[id]) || '—'}`);
}
const plan = planSession({ ageMonths: 54, sessions: cluster });
console.log(
  `\n  next session: ${plan.games.map(g => `${moduleName(g.game_id)} (${g.rounds} rounds)`).join(' + ')}`,
);
console.log(`  estimated: ${Math.round(plan.estimated_ms / 1000)}s — ${plan.rationale}`);

rule('5. Signal vocabulary (every phrase shown to a human)');
for (const id of Object.keys(SIGNAL_META) as Array<keyof typeof SIGNAL_META>) {
  console.log(`  ${id}\n    parent : ${SIGNAL_META[id].clause}\n    clinic : ${SIGNAL_META[id].clinicalClause}`);
}

const hardFailures =
  failures + (typicalEval.flag ? 1 : 0) + (clusterEval.flag ? 0 : 1);

console.log(`\n${hardFailures === 0 ? '✓ ALL GOOD' : `✗ ${hardFailures} FAILURE(S)`}\n`);
process.exit(hardFailures === 0 ? 0 : 1);
