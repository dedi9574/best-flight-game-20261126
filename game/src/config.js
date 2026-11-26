// Merpati Express — configuration: world size, physics, missions.
// All numbers are in game units: world distances in metres-ish units,
// altitude in feet, speeds in knots for display (world speed = knots / 1.15).

export const WORLD = {
  width: 9000,
  height: 7000,
  // The runway sits on the main island, running east-west.
  runway: { x: 4300, y: 4200, length: 1300, width: 110, headingDeg: 90 },
};

export const PHYSICS = {
  maxSpeedKnots: 320,
  stallSpeedKnots: 75,
  turnRateMax: 1.55, // rad/s at low speed
  turnRateMin: 0.85, // rad/s at max speed
  accel: 55, // knots/s towards the throttle target
  climbRate: 34, // ft/s while climbing
  descendRate: 42, // ft/s while descending
  sinkRate: 26, // ft/s lost below stall speed
  maxAltitude: 2600,
  fuelDrainBase: 0.22, // %/s
  fuelDrainThrottle: 0.5, // %/s at full throttle
  fuelPerRing: 12, // % refilled by each ring
  ringRadius: 150, // world units
  ringAltBand: 160, // feet either side of the ring's target altitude
};

export const MISSIONS = [
  {
    id: 1,
    name: 'Island Hop',
    short: 'Fly 8 rings before the fuel runs out',
    timeLimit: 300,
    fuelStart: 100,
    wind: 0,
    night: false,
    rain: false,
    start: { x: 1600, y: 3600, headingDeg: 90, altitude: 500, throttle: 0.55 },
    rings: [
      { x: 2400, y: 3300, alt: 600 },
      { x: 2600, y: 2800, alt: 700 },
      { x: 4700, y: 1300, alt: 850 },
      { x: 6200, y: 2300, alt: 650 },
      { x: 6900, y: 3700, alt: 700 },
      { x: 6100, y: 5200, alt: 550 },
      { x: 4300, y: 5700, alt: 650 },
      { x: 2500, y: 5100, alt: 500 },
    ],
    landing: false,
  },
  {
    id: 2,
    name: 'Runway Landing',
    short: 'Land on runway 09 within 3 minutes',
    timeLimit: 180,
    fuelStart: 100,
    wind: 0,
    night: false,
    rain: false,
    start: { x: 1400, y: 4200, headingDeg: 90, altitude: 900, throttle: 0.6 },
    rings: [
      { x: 2600, y: 4200, alt: 500 },
      { x: 3500, y: 4200, alt: 300 },
    ],
    landing: true,
  },
  {
    id: 3,
    name: 'Night Storm',
    short: '6 rings at night, in gusting wind and rain',
    timeLimit: 300,
    fuelStart: 80,
    wind: 1,
    night: true,
    rain: true,
    start: { x: 1800, y: 3000, headingDeg: 110, altitude: 600, throttle: 0.6 },
    rings: [
      { x: 2700, y: 2700, alt: 700 },
      { x: 4200, y: 1300, alt: 850 },
      { x: 5900, y: 2600, alt: 650 },
      { x: 6700, y: 4300, alt: 700 },
      { x: 5100, y: 5500, alt: 550 },
      { x: 3200, y: 4900, alt: 600 },
    ],
    landing: false,
  },
];

export const SCORE = {
  ring: 100,
  ringCenterBonus: 25, // within 50 ft of the ring's target altitude
  landingBase: 500,
  landingBonusMax: 250,
  timeBonusPerSecond: 2,
};

export const STORAGE_BEST_PREFIX = 'merpati-express-best-';
