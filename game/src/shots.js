// Merpati Express — reproducible screenshot scenes: ?shot=start|play|landing|storm
// (plus &seed=, accepted for compatibility with the kit's shots.json format).
// Each scene sets the game up deterministically and freezes the simulation so
// the screenshot renders the same frame every time.

import { MISSIONS, PHYSICS } from './config.js';
import { headingToRad } from './random.js';

export const SHOT_NAMES = ['start', 'play', 'landing', 'storm'];

/**
 * Configure a fresh Game for a screenshot scene.
 * @param {object} game the Game instance from main.js
 * @param {string} shot one of SHOT_NAMES
 */
export function applyShot(game, shot) {
  if (shot === 'start') {
    game.state = 'menu';
    game.time = 0;
    return;
  }
  if (shot === 'play') {
    // Mission 1, mid-flight: five rings already flown, the sixth ring ahead
    // over the southern coast — green island, sea and beach in the frame.
    game.startMission(1);
    game.ringIndex = 5;
    game.score = 500;
    const plane = game.plane;
    plane.x = 5400;
    plane.y = 5050;
    plane.heading = headingToRad(102);
    plane.speedKnots = 240;
    plane.altitude = 560;
    plane.throttle = 0.7;
    plane.fuel = 62;
    game.time = 120;
    game.frozen = true;
    return;
  }
  if (shot === 'landing') {
    // Mission 2, on final approach: runway dead ahead, low and slow, both
    // guide rings already flown.
    game.startMission(2);
    game.ringIndex = 2;
    game.score = 200;
    const plane = game.plane;
    plane.x = 3300;
    plane.y = 4200;
    plane.heading = headingToRad(90);
    plane.speedKnots = 105;
    plane.altitude = 190;
    plane.throttle = 0.32;
    plane.fuel = 88;
    game.time = 95;
    game.frozen = true;
    return;
  }
  if (shot === 'storm') {
    // Mission 3, night storm: rain, gusts, the fourth ring glowing ahead
    // past the city, with the runway lights behind the plane.
    game.startMission(3);
    game.ringIndex = 3;
    game.score = 300;
    const plane = game.plane;
    plane.x = 5800;
    plane.y = 4200;
    plane.heading = headingToRad(80);
    plane.speedKnots = 210;
    plane.altitude = 800;
    plane.throttle = 0.66;
    plane.fuel = 64;
    game.time = 58;
    game.lightning = 0.7;
    game.frozen = true;
    return;
  }
  // Unknown shot name: fall back to the menu.
  game.state = 'menu';
}
