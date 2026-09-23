/**
 * Deterministic, seedable pseudo-random number generator (mulberry32).
 * Used everywhere randomness is needed (scenario generation, Monte Carlo
 * simulation) so tests and daily challenges are reproducible.
 */

/**
 * Creates a seeded RNG function. Each call returns a float in [0, 1).
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a 32-bit numeric seed from a string (e.g. an ISO date like
 * "2026-09-25"), using the FNV-1a hash. Useful for date-based daily
 * challenges where the seed must be stable and shareable as text.
 */
export function seedFromString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
