/**
 * Difficulty scheduling.
 *
 * The spec says difficulty escalates within a visit. A purely blocked
 * escalation (1,1,1,2,2,2,3,3,3) escalates but makes "task switching"
 * unmeasurable: there are only two rule changes in a whole visit, and both sit
 * at fixed positions the child can anticipate.
 *
 * So the schedule escalates on average while stepping back every third round.
 * Mean difficulty still climbs across the visit, and roughly half of the rounds
 * now change the rule from the previous round — which is what makes a switch
 * cost (see signals.ts) measurable at all.
 */
export function tierSchedule(totalRounds: number): (1 | 2 | 3)[] {
  const out: (1 | 2 | 3)[] = [];
  for (let i = 0; i < totalRounds; i += 1) {
    const base = Math.min(3, 1 + Math.floor((i * 3) / Math.max(1, totalRounds)));
    const stepBack = i % 3 === 2 && base > 1;
    out.push((stepBack ? base - 1 : base) as 1 | 2 | 3);
  }
  return out;
}

export function tierForRound(roundIndex: number, totalRounds: number): 1 | 2 | 3 {
  const schedule = tierSchedule(totalRounds);
  return schedule[Math.min(roundIndex, schedule.length - 1)];
}
