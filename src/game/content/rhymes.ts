import { shuffle, type Rng } from '../../lib/random';

/**
 * Content for "Sounds the Same".
 *
 * Rhyme awareness is one of the better-established pre-reading skills that can
 * be checked before a child reads a single letter, which is exactly why this
 * game shows pictures and says words and never puts a letter on screen.
 *
 * Every set is written out in full rather than generated. Rhyme is a property
 * of how a word sounds, and a generator working from spelling would happily
 * offer "comb" as a rhyme for "home".
 */

export type SoundItem = { word: string; emoji: string };

export type SoundSet = {
  /** 1–2 = rhyme (ends the same). 3 = alliteration (starts the same). */
  tier: 1 | 2 | 3;
  cue: SoundItem;
  answer: SoundItem;
  /** Must share neither the ending (tiers 1–2) nor the opening (tier 3). */
  distractors: [SoundItem, SoundItem];
};

const RHYMES: SoundSet[] = [
  {
    tier: 1,
    cue: { word: 'cat', emoji: '🐱' },
    answer: { word: 'hat', emoji: '🧢' },
    distractors: [{ word: 'dog', emoji: '🐶' }, { word: 'sun', emoji: '☀️' }],
  },
  {
    tier: 1,
    cue: { word: 'dog', emoji: '🐶' },
    answer: { word: 'frog', emoji: '🐸' },
    distractors: [{ word: 'cat', emoji: '🐱' }, { word: 'star', emoji: '⭐' }],
  },
  {
    tier: 1,
    cue: { word: 'star', emoji: '⭐' },
    answer: { word: 'car', emoji: '🚗' },
    distractors: [{ word: 'moon', emoji: '🌙' }, { word: 'fish', emoji: '🐟' }],
  },
  {
    tier: 1,
    cue: { word: 'bee', emoji: '🐝' },
    answer: { word: 'tree', emoji: '🌳' },
    distractors: [{ word: 'cow', emoji: '🐮' }, { word: 'hat', emoji: '🧢' }],
  },
  {
    tier: 2,
    cue: { word: 'moon', emoji: '🌙' },
    answer: { word: 'spoon', emoji: '🥄' },
    distractors: [{ word: 'sun', emoji: '☀️' }, { word: 'book', emoji: '📕' }],
  },
  {
    tier: 2,
    cue: { word: 'cake', emoji: '🍰' },
    answer: { word: 'snake', emoji: '🐍' },
    distractors: [{ word: 'bread', emoji: '🍞' }, { word: 'bird', emoji: '🐦' }],
  },
  {
    tier: 2,
    cue: { word: 'goat', emoji: '🐐' },
    answer: { word: 'boat', emoji: '⛵' },
    distractors: [{ word: 'duck', emoji: '🦆' }, { word: 'hat', emoji: '🧢' }],
  },
  {
    tier: 2,
    cue: { word: 'mouse', emoji: '🐭' },
    answer: { word: 'house', emoji: '🏠' },
    distractors: [{ word: 'bird', emoji: '🐦' }, { word: 'cup', emoji: '🥤' }],
  },
  {
    tier: 2,
    cue: { word: 'fox', emoji: '🦊' },
    answer: { word: 'box', emoji: '📦' },
    distractors: [{ word: 'owl', emoji: '🦉' }, { word: 'milk', emoji: '🥛' }],
  },
  {
    tier: 2,
    cue: { word: 'sock', emoji: '🧦' },
    answer: { word: 'clock', emoji: '🕐' },
    distractors: [{ word: 'shirt', emoji: '👕' }, { word: 'apple', emoji: '🍎' }],
  },
  {
    tier: 2,
    cue: { word: 'whale', emoji: '🐳' },
    answer: { word: 'snail', emoji: '🐌' },
    distractors: [{ word: 'fish', emoji: '🐟' }, { word: 'tree', emoji: '🌳' }],
  },
];

const ALLITERATION: SoundSet[] = [
  {
    tier: 3,
    cue: { word: 'ball', emoji: '⚽' },
    answer: { word: 'bird', emoji: '🐦' },
    distractors: [{ word: 'cat', emoji: '🐱' }, { word: 'sun', emoji: '☀️' }],
  },
  {
    tier: 3,
    cue: { word: 'sun', emoji: '☀️' },
    answer: { word: 'sock', emoji: '🧦' },
    distractors: [{ word: 'dog', emoji: '🐶' }, { word: 'tree', emoji: '🌳' }],
  },
  {
    tier: 3,
    cue: { word: 'moon', emoji: '🌙' },
    answer: { word: 'milk', emoji: '🥛' },
    distractors: [{ word: 'car', emoji: '🚗' }, { word: 'fish', emoji: '🐟' }],
  },
  {
    tier: 3,
    cue: { word: 'cat', emoji: '🐱' },
    answer: { word: 'cup', emoji: '🥤' },
    distractors: [{ word: 'bird', emoji: '🐦' }, { word: 'tree', emoji: '🌳' }],
  },
  {
    tier: 3,
    cue: { word: 'fish', emoji: '🐟' },
    answer: { word: 'fox', emoji: '🦊' },
    distractors: [{ word: 'moon', emoji: '🌙' }, { word: 'cake', emoji: '🍰' }],
  },
  {
    tier: 3,
    cue: { word: 'duck', emoji: '🦆' },
    answer: { word: 'dog', emoji: '🐶' },
    distractors: [{ word: 'star', emoji: '⭐' }, { word: 'hat', emoji: '🧢' }],
  },
];

export type RhymeRound = {
  tier: 1 | 2 | 3;
  cue: SoundItem;
  options: SoundItem[];
  correctIndex: number;
  prompt: string;
};

export function makeRhymeRound(rng: Rng, tier: 1 | 2 | 3): RhymeRound {
  const pool = tier === 3 ? ALLITERATION : RHYMES.filter(s => s.tier === tier);
  const set = shuffle(rng, pool.length > 0 ? pool : RHYMES)[0];
  const options = shuffle(rng, [set.answer, ...set.distractors]);
  return {
    tier: set.tier,
    cue: set.cue,
    options,
    correctIndex: options.findIndex(o => o.word === set.answer.word),
    prompt:
      set.tier === 3
        ? `Which one starts like ${set.cue.word}?`
        : `Which one sounds like ${set.cue.word}?`,
  };
}
