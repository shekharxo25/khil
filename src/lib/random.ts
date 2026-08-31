/**
 * Deterministic PRNG (mulberry32).
 *
 * Rounds are generated from a seed so that a flagged session can be replayed
 * exactly in the clinician's review screen without storing any media.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() called with an empty list');
  return items[Math.floor(rng() * items.length) % items.length];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffle that is guaranteed not to return the original order (for scramble puzzles). */
export function shuffleDeranged<T>(rng: Rng, items: readonly T[]): T[] {
  if (items.length < 2) return items.slice();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = shuffle(rng, items);
    if (candidate.some((value, index) => value !== items[index])) return candidate;
  }
  const fallback = items.slice();
  [fallback[0], fallback[1]] = [fallback[1], fallback[0]];
  return fallback;
}

export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, count);
}
