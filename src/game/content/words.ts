import { pick, sample, shuffle, type Rng } from '../../lib/random';

/**
 * Content for Game 2 — "Point to the One I Say" (spec §2, Game 2).
 *
 * Three tiers, and the third is the one that matters:
 *   tier 1 → name a familiar object, distractors from other categories
 *   tier 2 → name an object, distractors from the SAME category (so a rote
 *            picture-word association is no longer enough)
 *   tier 3 → name a CATEGORY ("point to something you eat"), which separates
 *            comprehension from rote matching, exactly as the spec asks
 */

export type WordItem = {
  id: string;
  word: string;
  emoji: string;
  categories: CategoryId[];
};

export type CategoryId = 'animal' | 'food' | 'vehicle' | 'clothing' | 'household' | 'nature';

export const ITEMS: WordItem[] = [
  { id: 'dog', word: 'dog', emoji: '🐶', categories: ['animal'] },
  { id: 'cat', word: 'cat', emoji: '🐱', categories: ['animal'] },
  { id: 'cow', word: 'cow', emoji: '🐮', categories: ['animal'] },
  { id: 'bird', word: 'bird', emoji: '🐦', categories: ['animal'] },
  { id: 'fish', word: 'fish', emoji: '🐟', categories: ['animal'] },
  { id: 'elephant', word: 'elephant', emoji: '🐘', categories: ['animal'] },

  { id: 'apple', word: 'apple', emoji: '🍎', categories: ['food'] },
  { id: 'banana', word: 'banana', emoji: '🍌', categories: ['food'] },
  { id: 'bread', word: 'bread', emoji: '🍞', categories: ['food'] },
  { id: 'rice', word: 'rice', emoji: '🍚', categories: ['food'] },
  { id: 'carrot', word: 'carrot', emoji: '🥕', categories: ['food'] },
  { id: 'milk', word: 'milk', emoji: '🥛', categories: ['food'] },

  { id: 'car', word: 'car', emoji: '🚗', categories: ['vehicle'] },
  { id: 'bus', word: 'bus', emoji: '🚌', categories: ['vehicle'] },
  { id: 'bicycle', word: 'bicycle', emoji: '🚲', categories: ['vehicle'] },
  { id: 'train', word: 'train', emoji: '🚂', categories: ['vehicle'] },
  { id: 'boat', word: 'boat', emoji: '⛵', categories: ['vehicle'] },

  { id: 'shoe', word: 'shoe', emoji: '👟', categories: ['clothing'] },
  { id: 'hat', word: 'hat', emoji: '🧢', categories: ['clothing'] },
  { id: 'shirt', word: 'shirt', emoji: '👕', categories: ['clothing'] },
  { id: 'sock', word: 'sock', emoji: '🧦', categories: ['clothing'] },

  { id: 'cup', word: 'cup', emoji: '🥤', categories: ['household'] },
  { id: 'spoon', word: 'spoon', emoji: '🥄', categories: ['household'] },
  { id: 'chair', word: 'chair', emoji: '🪑', categories: ['household'] },
  { id: 'key', word: 'key', emoji: '🔑', categories: ['household'] },
  { id: 'book', word: 'book', emoji: '📕', categories: ['household'] },
  { id: 'clock', word: 'clock', emoji: '🕐', categories: ['household'] },

  { id: 'tree', word: 'tree', emoji: '🌳', categories: ['nature'] },
  { id: 'flower', word: 'flower', emoji: '🌻', categories: ['nature'] },
  { id: 'sun', word: 'sun', emoji: '☀️', categories: ['nature'] },
  { id: 'moon', word: 'moon', emoji: '🌙', categories: ['nature'] },
];

type CategoryPrompt = { category: CategoryId; prompt: string };

export const CATEGORY_PROMPTS: CategoryPrompt[] = [
  { category: 'food', prompt: 'Point to something you eat' },
  { category: 'animal', prompt: 'Point to an animal' },
  { category: 'vehicle', prompt: 'Point to something you ride in' },
  { category: 'clothing', prompt: 'Point to something you wear' },
  { category: 'nature', prompt: 'Point to something you see outside' },
];

export type LanguageRound = {
  tier: 1 | 2 | 3;
  /** Spoken instruction — the only place the answer is ever given. */
  prompt: string;
  options: WordItem[];
  correctIndex: number;
  /** Repeated on a hesitation nudge, phrased slightly differently. */
  repeatPrompt: string;
};

const NAME_PROMPTS = [
  (w: string) => `Where’s the ${w}?`,
  (w: string) => `Show me the ${w}`,
  (w: string) => `Can you find the ${w}?`,
  (w: string) => `Point to the ${w}`,
];

function itemsInCategory(category: CategoryId): WordItem[] {
  return ITEMS.filter(i => i.categories.includes(category));
}

function itemsNotInCategory(category: CategoryId): WordItem[] {
  return ITEMS.filter(i => !i.categories.includes(category));
}

export function makeLanguageRound(rng: Rng, tier: 1 | 2 | 3): LanguageRound {
  if (tier === 3) {
    const { category, prompt } = pick(rng, CATEGORY_PROMPTS);
    const target = pick(rng, itemsInCategory(category));
    // Distractors must all be outside the category, or there'd be two right answers.
    const distractors = sample(rng, itemsNotInCategory(category), 3);
    const options = shuffle(rng, [target, ...distractors]);
    return {
      tier,
      prompt,
      repeatPrompt: prompt,
      options,
      correctIndex: options.findIndex(o => o.id === target.id),
    };
  }

  const target = pick(rng, ITEMS);
  const sameCategory = itemsInCategory(target.categories[0]).filter(i => i.id !== target.id);
  const others = ITEMS.filter(i => !i.categories.includes(target.categories[0]));

  const distractorPool =
    tier === 2 && sameCategory.length >= 2
      ? [...sample(rng, sameCategory, 2), ...sample(rng, others, 1)]
      : sample(rng, others, tier === 1 ? 2 : 3);

  const options = shuffle(rng, [target, ...distractorPool]);
  const phrase = pick(rng, NAME_PROMPTS);

  return {
    tier,
    prompt: phrase(target.word),
    repeatPrompt: `Let’s try again. Where’s the ${target.word}?`,
    options,
    correctIndex: options.findIndex(o => o.id === target.id),
  };
}

/** Same escalate-with-step-backs schedule as the other games. See domain/tiers. */
export { tierForRound as languageTierForRound } from '../../domain/tiers';
