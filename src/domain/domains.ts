/**
 * The six developmental domains behind the dashboard's "6 skills tracked" stat
 * (wireframe 03). Spec §1: four games exist precisely so that this number means
 * something — several domains, not one signal dressed up six ways.
 *
 * Every label here is behavioural and plain-language. No domain is named after
 * a condition, and no domain name may ever imply one.
 */

export const DOMAIN_IDS = [
  'pattern',
  'attention',
  'language',
  'social',
  'motor',
  'sequencing',
] as const;

export type DomainId = (typeof DOMAIN_IDS)[number];

export type DomainMeta = {
  id: DomainId;
  /** Parent-facing name. Appears in "This week's focus". */
  label: string;
  /** One line a parent can read without a glossary. */
  blurb: string;
  emoji: string;
};

export const DOMAINS: Record<DomainId, DomainMeta> = {
  pattern: {
    id: 'pattern',
    label: 'Pattern recognition',
    blurb: 'Noticing when one thing in a group is different.',
    emoji: '🔷',
  },
  attention: {
    id: 'attention',
    label: 'Visual attention',
    blurb: 'Staying with a task and moving on to the next one.',
    emoji: '👀',
  },
  language: {
    id: 'language',
    label: 'Language response',
    blurb: 'Understanding a spoken word and acting on it.',
    emoji: '💬',
  },
  social: {
    id: 'social',
    label: 'Shared attention',
    blurb: 'Following what someone else is pointing at or asking for.',
    emoji: '🤝',
  },
  motor: {
    id: 'motor',
    label: 'Movement & rhythm',
    blurb: 'Tapping accurately and keeping to a beat.',
    emoji: '🥁',
  },
  sequencing: {
    id: 'sequencing',
    label: 'Order & memory',
    blurb: 'Holding a short order of things in mind and repeating it.',
    emoji: '🧩',
  },
};

export function domainLabel(id: DomainId): string {
  return DOMAINS[id].label;
}

export const DOMAIN_COUNT = DOMAIN_IDS.length;
