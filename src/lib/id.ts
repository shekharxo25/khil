let counter = 0;

/** Collision-safe-enough id for local-only records. */
export function makeId(prefix: string): string {
  counter += 1;
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .padStart(4, '0');
  return `${prefix}_${stamp}${counter.toString(36)}${rand}`;
}
