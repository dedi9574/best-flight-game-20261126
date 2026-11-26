// Merpati Express — a small seeded random number generator so the terrain
// decoration is identical on every load (mulberry32).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a value in [min, max) from a seeded rng. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Pick an integer in [min, max] from a seeded rng. */
export function rangeInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Clamp a number into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Shortest signed angle from `from` to `to`, in radians. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Degrees (0 = north, clockwise) to radians (0 = east, counter-clockwise). */
export function headingToRad(deg) {
  return ((deg - 90) * Math.PI) / 180;
}

/** Radians (0 = east, counter-clockwise) to degrees (0 = north, clockwise). */
export function radToHeading(rad) {
  let deg = (rad * 180) / Math.PI + 90;
  deg %= 360;
  if (deg < 0) deg += 360;
  return deg;
}
