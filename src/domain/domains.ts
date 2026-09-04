/**
 * The behavioural skill areas Khil tracks.
 *
 * READ THIS BEFORE ADDING A DOMAIN.
 *
 * Every name and blurb here is a description of something a child does on
 * screen. None of them is a condition, and none of them may be renamed into
 * one. The concern areas these domains are designed to surface — and there are
 * six of them — are documented in the README, in code comments, and nowhere
 * that a parent or a clinician can read. That separation is the product's
 * central promise; see `safeLanguage.ts`, which enforces it.
 *
 * Order is load-bearing: it fixes each domain's petal position and colour in
 * the bloom (see `ui/Bloom.tsx`), so appending is safe and reordering is not.
 */

export const DOMAIN_IDS = [
  'pattern',
  'attention',
  'language',
  'social',
  'motor',
  'sequencing',
  'sounds',
  'handControl',
  'numbers',
  'routine',
] as const;

export type DomainId = (typeof DOMAIN_IDS)[number];

export type DomainMeta = {
  id: DomainId;
  /** Parent-facing name. Appears in "This week's focus" and on the bloom. */
  label: string;
  /** Short enough to sit under the label on a phone. */
  blurb: string;
  /** What an adult would actually watch for, in one line. */
  watchFor: string;
  emoji: string;
};

export const DOMAINS: Record<DomainId, DomainMeta> = {
  pattern: {
    id: 'pattern',
    label: 'Pattern recognition',
    blurb: 'Noticing when one thing in a group is different.',
    watchFor: 'How quickly the odd one out is spotted as the difference gets subtler.',
    emoji: '🔷',
  },
  attention: {
    id: 'attention',
    label: 'Focus & holding back',
    blurb: 'Staying with a task, and waiting when waiting is the answer.',
    watchFor: 'Taps on things the game asked them to leave alone, and prompts let pass.',
    emoji: '🎯',
  },
  language: {
    id: 'language',
    label: 'Language response',
    blurb: 'Understanding a spoken word and acting on it.',
    watchFor: 'Whether a named thing and a described group are both understood.',
    emoji: '💬',
  },
  social: {
    id: 'social',
    label: 'Shared attention',
    blurb: 'Following what someone else is asking for or pointing at.',
    watchFor: 'Whether a spoken request reliably turns into a response.',
    emoji: '🤝',
  },
  motor: {
    id: 'motor',
    label: 'Movement & rhythm',
    blurb: 'Tapping accurately and keeping to a beat.',
    watchFor: 'Whether taps land evenly, not just in the right order.',
    emoji: '🥁',
  },
  sequencing: {
    id: 'sequencing',
    label: 'Order & memory',
    blurb: 'Holding a short order of things in mind and repeating it.',
    watchFor: 'How long a remembered order can get before it breaks.',
    emoji: '🧩',
  },
  sounds: {
    id: 'sounds',
    label: 'Sound & word patterns',
    blurb: 'Hearing that two words end or start the same way.',
    watchFor: 'Whether words that rhyme are heard as belonging together.',
    emoji: '👂',
  },
  handControl: {
    id: 'handControl',
    label: 'Hand control',
    blurb: 'Guiding a finger steadily along a line.',
    watchFor: 'How far a traced line drifts from the path, and how shaky it is.',
    emoji: '✍️',
  },
  numbers: {
    id: 'numbers',
    label: 'Quantity sense',
    blurb: 'Seeing at a glance which group has more.',
    watchFor: 'Whether close comparisons are as reliable as obvious ones.',
    emoji: '⚖️',
  },
  routine: {
    id: 'routine',
    label: 'Routine & change',
    blurb: 'Coping when the game changes what it is asking for.',
    watchFor: 'Extra time and repeated old answers after the rule changes.',
    emoji: '🔁',
  },
};

export function domainLabel(id: DomainId): string {
  return DOMAINS[id].label;
}

export const DOMAIN_COUNT = DOMAIN_IDS.length;

export function domainIndex(id: DomainId): number {
  return DOMAIN_IDS.indexOf(id);
}
