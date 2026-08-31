import type { DomainId } from './domains';

/**
 * Game registry — spec §2.
 *
 * Spec §5 scope note: Games 1 and 2 are the MVP; 3 and 4 are "only if time
 * allows". All four are built here and all four are wired into rotation, but
 * `mvp` marks the two the demo leans on, and the dev panel can restrict
 * rotation to just those.
 *
 * Game 5 ("Peekaboo Response", gaze via front camera) is intentionally NOT
 * implemented. See README — it stays out until the consent flow and the
 * on-device-only processing story are solid, exactly as the spec instructs.
 */

export const GAME_IDS = ['pattern', 'language', 'beat', 'sequence'] as const;
export type GameId = (typeof GAME_IDS)[number];

export type GameMeta = {
  id: GameId;
  /** Child-facing name — spoken, never required reading. */
  title: string;
  /** Parent/clinician-facing description of the mechanic. */
  mechanic: string;
  minAgeMonths: number;
  maxAgeMonths: number;
  /** First domain is the primary one; it drives "This week's focus". */
  domains: [DomainId, DomainId];
  /** Nominal round count for one visit to this game. */
  rounds: number;
  emoji: string;
  accent: string;
  mvp: boolean;
};

export const GAMES: Record<GameId, GameMeta> = {
  pattern: {
    id: 'pattern',
    title: 'Spot the Odd One',
    mechanic:
      'Three shapes appear; the child taps the one that is different. Difficulty climbs from a colour-only difference to a subtle pattern difference.',
    minAgeMonths: 36,
    maxAgeMonths: 83,
    domains: ['pattern', 'attention'],
    rounds: 9,
    emoji: '🔷',
    accent: '#4C9BE8',
    mvp: true,
  },
  language: {
    id: 'language',
    title: 'Point to the One I Say',
    mechanic:
      'A voice names something; the child taps the matching picture. Later rounds ask for a category instead of a name, to separate comprehension from rote matching.',
    minAgeMonths: 24,
    maxAgeMonths: 71,
    domains: ['language', 'social'],
    rounds: 10,
    emoji: '💬',
    accent: '#B45B8F',
    mvp: true,
  },
  beat: {
    id: 'beat',
    title: 'Copy My Beat',
    mechanic:
      'A character plays a short drum sequence; the child repeats it. The sequence grows by one each time it is echoed correctly.',
    minAgeMonths: 36,
    maxAgeMonths: 83,
    domains: ['motor', 'sequencing'],
    rounds: 6,
    emoji: '🥁',
    accent: '#EF7A6A',
    mvp: false,
  },
  sequence: {
    id: 'sequence',
    title: 'What Happens Next',
    mechanic:
      'Three picture cards show a simple event out of order; the child drags them into the right order. Each card narrates itself on tap, so nothing needs reading.',
    minAgeMonths: 48,
    maxAgeMonths: 83,
    domains: ['sequencing', 'language'],
    rounds: 4,
    emoji: '🧩',
    accent: '#48A97C',
    mvp: false,
  },
};

export const GAME_LIST: GameMeta[] = GAME_IDS.map(id => GAMES[id]);

export function gameTitle(id: GameId): string {
  return GAMES[id].title;
}

/** Parent- and clinician-facing name of the module a flag came from. */
export function moduleName(id: GameId): string {
  switch (id) {
    case 'pattern':
      return 'Pattern matching module';
    case 'language':
      return 'Spoken-word matching module';
    case 'beat':
      return 'Rhythm copying module';
    case 'sequence':
      return 'Picture ordering module';
  }
}

export function gamesForAge(ageMonths: number): GameMeta[] {
  return GAME_LIST.filter(g => ageMonths >= g.minAgeMonths && ageMonths <= g.maxAgeMonths);
}
