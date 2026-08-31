import { pick, shuffle, type Rng } from '../../lib/random';
import { color } from '../../theme/tokens';

/**
 * Content for Game 1 — "Spot the Odd One" (spec §2, Game 1).
 *
 * Difficulty escalates exactly as the spec describes:
 *   tier 1 → colour-only difference
 *   tier 2 → shape difference
 *   tier 3 → subtle pattern difference (same shape, same colour, different fill)
 */

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'diamond' | 'rounded';

export type Tile = {
  shape: ShapeKind;
  fill: string;
  /** Number of dots drawn on the face — the tier-3 difference. */
  dots: number;
  /** Degrees. Also a tier-3 difference. */
  rotation: number;
};

export type PatternRound = {
  tier: 1 | 2 | 3;
  tiles: Tile[];
  oddIndex: number;
  /** Spoken instruction. Reworded across rounds so it does not become a drone. */
  prompt: string;
};

const PALETTE = [
  color.play.sky,
  color.play.coral,
  color.play.leaf,
  color.play.grape,
  color.play.sun,
  color.play.plum,
];

const SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond', 'rounded'];

const PROMPTS = [
  'Tap the shape that’s different',
  'One of these is not like the others. Tap it!',
  'Which one is different? Tap it',
  'Find the odd one out. Tap it',
];

/** Two visibly distinct colours — never a near-pair, so colour vision isn't the test. */
function twoColours(rng: Rng): [string, string] {
  const shuffled = shuffle(rng, PALETTE);
  return [shuffled[0], shuffled[1]];
}

export function makePatternRound(rng: Rng, tier: 1 | 2 | 3): PatternRound {
  const oddIndex = Math.floor(rng() * 3);
  const prompt = pick(rng, PROMPTS);
  const tiles: Tile[] = [];

  if (tier === 1) {
    const [base, odd] = twoColours(rng);
    const shape = pick(rng, SHAPES);
    for (let i = 0; i < 3; i += 1) {
      tiles.push({ shape, fill: i === oddIndex ? odd : base, dots: 0, rotation: 0 });
    }
  } else if (tier === 2) {
    const fill = pick(rng, PALETTE);
    const shuffledShapes = shuffle(rng, SHAPES);
    const base = shuffledShapes[0];
    const odd = shuffledShapes[1];
    for (let i = 0; i < 3; i += 1) {
      tiles.push({ shape: i === oddIndex ? odd : base, fill, dots: 0, rotation: 0 });
    }
  } else {
    const fill = pick(rng, PALETTE);
    const shape = pick(rng, SHAPES);
    const useDots = rng() < 0.6;
    const baseDots = useDots ? 3 : 0;
    const oddDots = useDots ? 4 : 0;
    const baseRotation = 0;
    const oddRotation = useDots ? 0 : 22;
    for (let i = 0; i < 3; i += 1) {
      tiles.push({
        shape,
        fill,
        dots: i === oddIndex ? oddDots : baseDots,
        rotation: i === oddIndex ? oddRotation : baseRotation,
      });
    }
  }

  return { tier, tiles, oddIndex, prompt };
}

/**
 * Difficulty schedule lives in domain/tiers so the seeder and the flag engine's
 * switch-cost probe agree with the live game about what a "rule change" is.
 */
export { tierForRound } from '../../domain/tiers';
