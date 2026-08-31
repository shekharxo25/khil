import { shuffle, type Rng } from '../../lib/random';

/**
 * Content for Game 4 — "What Happens Next" (spec §2, Game 4).
 *
 * Three cards per scenario, each with its own narration so the game stays
 * reading-free: "Voice narrates each card on tap so it stays reading-free."
 */

export type StoryCard = {
  emoji: string;
  /** Spoken when the child taps the card. */
  narration: string;
  /** Adult-facing only — never rendered on the child screen. */
  altText: string;
};

export type Scenario = {
  id: string;
  /** Spoken set-up before the cards appear. */
  intro: string;
  /** Cards in their CORRECT order. The game shuffles them. */
  cards: StoryCard[];
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'plant',
    intro: 'Put the pictures in order. What happens first?',
    cards: [
      { emoji: '🚿', narration: 'Someone waters the little plant', altText: 'watering a seedling' },
      { emoji: '🌱', narration: 'The plant grows taller', altText: 'a growing plant' },
      { emoji: '🌸', narration: 'A flower opens up', altText: 'a bloomed flower' },
    ],
  },
  {
    id: 'egg',
    intro: 'Put the pictures in order. What happens first?',
    cards: [
      { emoji: '🥚', narration: 'There is an egg in a nest', altText: 'egg in nest' },
      { emoji: '🐣', narration: 'A tiny chick hatches out', altText: 'chick hatching' },
      { emoji: '🐔', narration: 'The chick grows into a big hen', altText: 'grown hen' },
    ],
  },
  {
    id: 'cake',
    intro: 'Put the pictures in order. What happens first?',
    cards: [
      { emoji: '🥣', narration: 'We mix the batter in a bowl', altText: 'mixing bowl' },
      { emoji: '🎂', narration: 'The cake comes out of the oven', altText: 'finished cake' },
      { emoji: '🍰', narration: 'We eat a slice of cake', altText: 'slice of cake' },
    ],
  },
  {
    id: 'rain',
    intro: 'Put the pictures in order. What happens first?',
    cards: [
      { emoji: '☁️', narration: 'Grey clouds come over the sky', altText: 'clouds gathering' },
      { emoji: '🌧️', narration: 'Rain falls down', altText: 'rain falling' },
      { emoji: '🌈', narration: 'A rainbow appears', altText: 'rainbow' },
    ],
  },
  {
    id: 'shoes',
    intro: 'Put the pictures in order. What happens first?',
    cards: [
      { emoji: '🧦', narration: 'First we put on our socks', altText: 'socks' },
      { emoji: '👟', narration: 'Then we put on our shoes', altText: 'shoes' },
      { emoji: '🏃', narration: 'Now we can run outside', altText: 'running child' },
    ],
  },
];

export type SequenceRound = {
  scenario: Scenario;
  /** Indices into `scenario.cards`, in the scrambled order shown to the child. */
  shownOrder: number[];
};

export function makeSequenceRound(rng: Rng, scenario: Scenario): SequenceRound {
  const indices = scenario.cards.map((_, i) => i);
  let shownOrder = shuffle(rng, indices);
  // A scenario that starts solved teaches nothing and logs nothing.
  let guard = 0;
  while (shownOrder.every((v, i) => v === i) && guard < 10) {
    shownOrder = shuffle(rng, indices);
    guard += 1;
  }
  if (shownOrder.every((v, i) => v === i)) {
    shownOrder = [indices[1], indices[0], ...indices.slice(2)];
  }
  return { scenario, shownOrder };
}

export function pickScenarios(rng: Rng, count: number): Scenario[] {
  return shuffle(rng, SCENARIOS).slice(0, Math.min(count, SCENARIOS.length));
}
