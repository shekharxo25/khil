import { color } from '../theme/tokens';
import type { DomainId } from './domains';

/**
 * Game registry — eight games across ten skill areas.
 *
 * Games 1–4 are the original spec §2 set. Games 5–8 were added to widen the
 * behavioural coverage: response inhibition and sustained attention, rhyme
 * awareness, grapho-motor control, and non-symbolic quantity comparison.
 * Which concern areas each of those is designed to surface is documented in
 * the README — deliberately not here, and never in anything rendered.
 *
 * Game 9 ("Peekaboo Response", gaze via front camera) remains unbuilt, per the
 * spec: not until the consent flow and on-device-only processing story are
 * solid. Khil still touches no camera and no microphone.
 */

export const GAME_IDS = [
  'pattern',
  'language',
  'beat',
  'sequence',
  'inhibit',
  'rhyme',
  'trace',
  'quantity',
] as const;

export type GameId = (typeof GAME_IDS)[number];

export type GameMeta = {
  id: GameId;
  /** Child-facing name — spoken, never required reading. */
  title: string;
  /** One line a parent can scan in the picker. */
  tagline: string;
  /** What actually happens, for the parent who wants detail. */
  mechanic: string;
  minAgeMonths: number;
  maxAgeMonths: number;
  /** First domain is primary and drives "This week's focus". */
  domains: [DomainId, DomainId];
  rounds: number;
  emoji: string;
  accent: string;
  /** Spec §5: the two games the course MVP leans on. */
  mvp: boolean;
};

export const GAMES: Record<GameId, GameMeta> = {
  pattern: {
    id: 'pattern',
    title: 'Spot the Odd One',
    tagline: 'Find the shape that doesn’t belong',
    mechanic:
      'Three shapes appear; the child taps the one that is different. The difference climbs from colour only, to shape, to a subtle pattern.',
    minAgeMonths: 36,
    maxAgeMonths: 83,
    domains: ['pattern', 'routine'],
    rounds: 9,
    emoji: '🔷',
    accent: color.kite.cobalt,
    mvp: true,
  },
  language: {
    id: 'language',
    title: 'Point to the One I Say',
    tagline: 'Tap the picture the voice names',
    mechanic:
      'A voice names something; the child taps the matching picture. Later rounds ask for a category instead of a name, which separates comprehension from rote matching.',
    minAgeMonths: 24,
    maxAgeMonths: 71,
    domains: ['language', 'social'],
    rounds: 10,
    emoji: '💬',
    accent: color.kite.magenta,
    mvp: true,
  },
  beat: {
    id: 'beat',
    title: 'Copy My Beat',
    tagline: 'Echo the drum pattern back',
    mechanic:
      'A short drum sequence plays; the child repeats it. The sequence grows by one each time it is echoed correctly.',
    minAgeMonths: 36,
    maxAgeMonths: 83,
    domains: ['motor', 'sequencing'],
    rounds: 6,
    emoji: '🥁',
    accent: color.kite.coral,
    mvp: false,
  },
  sequence: {
    id: 'sequence',
    title: 'What Happens Next',
    tagline: 'Put the story in order',
    mechanic:
      'Three picture cards show a simple event out of order; the child drags them into place. Each card narrates itself on tap, so nothing needs reading.',
    minAgeMonths: 48,
    maxAgeMonths: 83,
    domains: ['sequencing', 'language'],
    rounds: 4,
    emoji: '🧩',
    accent: color.kite.parrot,
    mvp: false,
  },

  // ── Added for wider behavioural coverage ─────────────────────────────────
  inhibit: {
    id: 'inhibit',
    title: 'Wake the Sleepy Ones',
    tagline: 'Tap the awake animals, let the sleeping ones sleep',
    mechanic:
      'Animals appear one at a time. Most are awake and want a tap; a few are asleep and must be left alone. Measures taps that should have been held back, and prompts that went by without one.',
    minAgeMonths: 42,
    maxAgeMonths: 83,
    domains: ['attention', 'routine'],
    rounds: 14,
    emoji: '🎯',
    accent: color.kite.saffron,
    mvp: false,
  },
  rhyme: {
    id: 'rhyme',
    title: 'Sounds the Same',
    tagline: 'Find the word that rhymes',
    mechanic:
      'A voice says a word, then names three pictures. The child taps the one that rhymes with it. Later rounds ask for the same starting sound instead. No letters appear anywhere.',
    minAgeMonths: 48,
    maxAgeMonths: 83,
    domains: ['sounds', 'language'],
    rounds: 8,
    emoji: '👂',
    accent: color.kite.violet,
    mvp: false,
  },
  trace: {
    id: 'trace',
    title: 'Follow the Kite String',
    tagline: 'Drag along the line without leaving it',
    mechanic:
      'A dotted path appears; the child drags a kite along it from start to finish. Measures how far the finger drifts from the path, how shaky the line is, and how often it lifts off.',
    minAgeMonths: 42,
    maxAgeMonths: 83,
    domains: ['handControl', 'attention'],
    rounds: 5,
    emoji: '✍️',
    accent: color.kite.teal,
    mvp: false,
  },
  quantity: {
    id: 'quantity',
    title: 'Which Has More?',
    tagline: 'Tap the side with more dots',
    mechanic:
      'Two groups of dots appear side by side; the child taps the larger one. The groups get closer in size as the game goes on. Nothing is counted and no numerals appear.',
    minAgeMonths: 48,
    maxAgeMonths: 83,
    domains: ['numbers', 'attention'],
    rounds: 10,
    emoji: '⚖️',
    accent: color.kite.lime,
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
    case 'inhibit':
      return 'Wait-and-tap module';
    case 'rhyme':
      return 'Rhyme matching module';
    case 'trace':
      return 'Line tracing module';
    case 'quantity':
      return 'Quantity comparison module';
  }
}

export function gamesForAge(ageMonths: number): GameMeta[] {
  return GAME_LIST.filter(g => ageMonths >= g.minAgeMonths && ageMonths <= g.maxAgeMonths);
}

export function isGameInBand(id: GameId, ageMonths: number): boolean {
  const g = GAMES[id];
  return ageMonths >= g.minAgeMonths && ageMonths <= g.maxAgeMonths;
}
