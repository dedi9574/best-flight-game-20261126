// Merpati Express — the world: one big island with a city and a runway,
// a smaller island to the north-east, mountains, a lake and scattered islets.
// Terrain is hand-laid-out (so the map is recognisable) and decorated with a
// seeded rng (so it is identical on every load).

import { WORLD } from './config.js';
import { mulberry32, range, rangeInt } from './random.js';

// A blob of land: a centre, radii and a ring of radial wobble.
function blob(cx, cy, rx, ry, wobble, seed) {
  const rng = mulberry32(seed);
  const points = [];
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 + (rng() - 0.5) * wobble;
    points.push({ x: cx + Math.cos(a) * rx * w, y: cy + Math.sin(a) * ry * w });
  }
  return { cx, cy, rx, ry, points };
}

export const ISLANDS = [
  blob(4000, 3700, 2700, 2000, 0.16, 11), // main island
  blob(7300, 1300, 1150, 850, 0.18, 23), // north-east island
  blob(1500, 1300, 520, 380, 0.2, 37), // north-west islet
  blob(7800, 5600, 640, 460, 0.2, 41), // south-east islet
  blob(1200, 5900, 420, 300, 0.22, 53), // south-west islet
];

export const MOUNTAINS = [
  { x: 2500, y: 2150, r: 400, height: 2200 },
  { x: 3450, y: 1850, r: 470, height: 2600 },
  { x: 4450, y: 2050, r: 430, height: 2400 },
  { x: 5350, y: 2350, r: 350, height: 1800 },
  { x: 7350, y: 1250, r: 370, height: 1500 },
];

export const LAKE = { cx: 2950, cy: 4900, rx: 720, ry: 420 };

// City blocks: a grid of rectangles just north of the runway.
export const CITY = { x0: 4600, y0: 2950, x1: 6150, y1: 3950 };

// Seeded decoration: trees on the main island, rocks on the shore, clouds.
const decorRng = mulberry32(20261126);
export const TREES = [];
for (let i = 0; i < 340; i++) {
  const x = range(decorRng, 1600, 6400);
  const y = range(decorRng, 1900, 5500);
  if (pointInBlob(x, y, ISLANDS[0]) && !nearMountain(x, y) && !inCity(x, y) && !inLake(x, y)) {
    TREES.push({ x, y, r: range(decorRng, 14, 26) });
  }
}
export const CLOUDS = [];
for (let i = 0; i < 26; i++) {
  CLOUDS.push({
    x: range(decorRng, 0, WORLD.width),
    y: range(decorRng, 0, WORLD.height),
    rx: range(decorRng, 130, 260),
    ry: range(decorRng, 42, 78),
    speed: range(decorRng, 6, 16),
  });
}
export const BIRDS = [];
for (let i = 0; i < 8; i++) {
  BIRDS.push({
    x: range(decorRng, 2000, 6000),
    y: range(decorRng, 2500, 5000),
    a: range(decorRng, 0, Math.PI * 2),
    speed: range(decorRng, 30, 55),
  });
}

function pointInBlob(x, y, b) {
  // Point-in-polygon over the blob's ring.
  let inside = false;
  const pts = b.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function nearMountain(x, y) {
  return MOUNTAINS.some((m) => {
    const dx = x - m.x, dy = y - m.y;
    return dx * dx + dy * dy < (m.r + 120) * (m.r + 120);
  });
}

function inCity(x, y) {
  return x > CITY.x0 - 80 && x < CITY.x1 + 80 && y > CITY.y0 - 80 && y < CITY.y1 + 80;
}

function inLake(x, y) {
  const dx = (x - LAKE.cx) / LAKE.rx, dy = (y - LAKE.cy) / LAKE.ry;
  return dx * dx + dy * dy < 1;
}

/** True when (x, y) is open water (not on any island and not the lake). */
export function isWater(x, y) {
  if (inLake(x, y)) return true;
  return !ISLANDS.some((b) => pointInBlob(x, y, b));
}

/** True when (x, y) is inside the runway rectangle. */
export function isRunway(x, y) {
  const r = WORLD.runway;
  return Math.abs(x - r.x) < r.length / 2 && Math.abs(y - r.y) < r.width / 2;
}

/** Terrain height in feet at (x, y): mountain height, else 0 on land. */
export function groundHeightAt(x, y) {
  let h = 0;
  for (const m of MOUNTAINS) {
    const dx = x - m.x, dy = y - m.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < m.r) {
      const peak = m.height * (0.35 + 0.65 * (1 - d / m.r));
      if (peak > h) h = peak;
    }
  }
  return h;
}

/** The mountain whose airspace (x, y) is inside at the given altitude, or null. */
export function mountainAt(x, y, altitude) {
  for (const m of MOUNTAINS) {
    const dx = x - m.x, dy = y - m.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < m.r && altitude < groundHeightAt(x, y)) return m;
  }
  return null;
}

/** Distance and bearing from (x, y) to a target, for the HUD arrow. */
export function bearingTo(x, y, tx, ty) {
  const dx = tx - x, dy = ty - y;
  return { dist: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
}
