// Merpati Express — the aircraft: position, heading, speed, altitude,
// throttle, fuel and damage, plus the per-frame physics update.

import { PHYSICS, WORLD } from './config.js';
import { clamp, headingToRad, radToHeading, angleDelta } from './random.js';
import { groundHeightAt, isRunway, isWater, mountainAt } from './world.js';

const KNOTS_TO_UNITS = 1 / 1.15; // world units per second per knot

export class Plane {
  constructor(mission) {
    this.reset(mission);
  }

  reset(mission) {
    const s = mission.start;
    this.x = s.x;
    this.y = s.y;
    this.heading = headingToRad(s.headingDeg);
    this.speedKnots = 120;
    this.altitude = s.altitude;
    this.throttle = s.throttle;
    this.fuel = mission.fuelStart;
    this.damage = 0;
    this.bank = 0; // visual banking, -1..1
    this.verticalSpeed = 0;
    this.hitCooldown = 0; // seconds of grace after a mountain hit
    this.crashed = false;
    this.landed = false;
    this.crashReason = '';
    this.windX = 0;
    this.windY = 0;
  }

  get speedUnits() {
    return this.speedKnots * KNOTS_TO_UNITS;
  }

  get headingDeg() {
    return radToHeading(this.heading);
  }

  /** Steer the nose toward an absolute heading (radians), limited by turn rate. */
  turnToward(targetHeading, dt) {
    const speedFactor = clamp(this.speedKnots / PHYSICS.maxSpeedKnots, 0.25, 1);
    const rate = PHYSICS.turnRateMax - (PHYSICS.turnRateMax - PHYSICS.turnRateMin) * speedFactor;
    const delta = angleDelta(this.heading, targetHeading);
    const step = clamp(delta, -rate * dt, rate * dt);
    this.heading += step;
    this.bank = clamp(step / (rate * dt || 1), -1, 1) * 0.9;
    return delta;
  }

  /**
   * Advance the plane one frame.
   * @param {object} ctrl {turn: -1..1, throttleUp, throttleDown, climb, descend, steerTo: {x,y}|null, mouseSteer}
   * @param {number} dt seconds
   * @param {object} mission the active mission (for wind)
   * @returns {string[]} events that happened this frame ('ring' handled by caller)
   */
  update(ctrl, dt, mission, time) {
    if (this.crashed || this.landed) return [];
    const events = [];

    // Throttle.
    if (ctrl.throttleUp) this.throttle = clamp(this.throttle + dt * 0.55, 0, 1);
    if (ctrl.throttleDown) this.throttle = clamp(this.throttle - dt * 0.55, 0, 1);
    if (typeof ctrl.throttleSet === 'number') this.throttle = clamp(ctrl.throttleSet, 0, 1);

    // Turning: keyboard, or the mouse steering toward a point.
    if (ctrl.mouseSteer && ctrl.steerTo) {
      const want = Math.atan2(ctrl.steerTo.y - this.y, ctrl.steerTo.x - this.x);
      this.turnToward(want, dt);
    } else if (ctrl.turn !== 0) {
      const speedFactor = clamp(this.speedKnots / PHYSICS.maxSpeedKnots, 0.25, 1);
      const rate = PHYSICS.turnRateMax - (PHYSICS.turnRateMax - PHYSICS.turnRateMin) * speedFactor;
      this.heading += ctrl.turn * rate * dt;
      this.bank = clamp(ctrl.turn, -1, 1) * 0.9;
    } else {
      this.bank *= Math.max(0, 1 - dt * 6);
    }

    // Speed chases the throttle target; drag grows with speed.
    const targetSpeed = this.throttle * PHYSICS.maxSpeedKnots;
    const accel = PHYSICS.accel * (targetSpeed > this.speedKnots ? 1 : 1.6);
    this.speedKnots += clamp(targetSpeed - this.speedKnots, -accel * dt, accel * dt);
    if (this.speedKnots < 0) this.speedKnots = 0;

    // Altitude: climb / descend keys, plus a sink below stall speed.
    const prevAlt = this.altitude;
    if (ctrl.climb) this.altitude += PHYSICS.climbRate * (0.4 + this.throttle) * dt;
    if (ctrl.descend) this.altitude -= PHYSICS.descendRate * dt;
    if (this.speedKnots < PHYSICS.stallSpeedKnots && !ctrl.climb) {
      this.altitude -= PHYSICS.sinkRate * dt;
    }
    this.altitude = clamp(this.altitude, 0, PHYSICS.maxAltitude);
    this.verticalSpeed = (this.altitude - prevAlt) / Math.max(dt, 0.0001);

    // Wind gusts (night storm mission): a slow sine gust plus jitter.
    if (mission.wind > 0) {
      const gust = Math.sin(time * 0.9) * 0.6 + Math.sin(time * 2.7 + 1.3) * 0.4;
      this.windX = gust * 26 * mission.wind;
      this.windY = Math.cos(time * 0.7) * 18 * mission.wind;
    } else {
      this.windX = 0;
      this.windY = 0;
    }

    // Move.
    const vx = Math.cos(this.heading) * this.speedUnits + this.windX;
    const vy = Math.sin(this.heading) * this.speedUnits + this.windY;
    this.x += vx * dt;
    this.y += vy * dt;
    // Stay inside the world.
    this.x = clamp(this.x, 60, WORLD.width - 60);
    this.y = clamp(this.y, 60, WORLD.height - 60);

    // Fuel.
    this.fuel -= (PHYSICS.fuelDrainBase + PHYSICS.fuelDrainThrottle * this.throttle) * dt;
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.throttle = Math.max(0, this.throttle - dt * 0.5);
      if (this.speedKnots < 40 && this.altitude <= 0) {
        this.crash('Out of fuel — ditched');
        events.push('crash');
      }
    }

    // Mountains: a hard hit costs damage and shoves the plane clear. A short
    // grace period after a hit keeps one graze from ending the sortie.
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    const mountain = mountainAt(this.x, this.y, this.altitude);
    if (mountain && this.hitCooldown <= 0) {
      this.damage += 30;
      this.hitCooldown = 1.5;
      this.speedKnots *= 0.5;
      const dx = this.x - mountain.x, dy = this.y - mountain.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x = mountain.x + (dx / d) * (mountain.r + 150);
      this.y = mountain.y + (dy / d) * (mountain.r + 150);
      events.push('mountain');
      if (this.damage >= 100) {
        this.crash('Smashed into the mountains');
        events.push('crash');
      }
    }

    // Ground contact.
    if (this.altitude <= 0) {
      if (mission.landing && isRunway(this.x, this.y)) {
        const align = Math.abs(((this.headingDeg - WORLD.runway.headingDeg + 540) % 360) - 180);
        if (this.speedKnots <= 110 && align < 30) {
          this.landed = true;
          events.push('landed');
        } else {
          this.crash('Too fast / misaligned on the runway');
          events.push('crash');
        }
      } else if (this.speedKnots <= 55) {
        // A slow belly landing on land or water: heavy damage, sortie over.
        this.damage = Math.min(100, this.damage + 45);
        this.crash(isWater(this.x, this.y) ? 'Ditched in the sea' : 'Belly landing in the field');
        events.push('crash');
      } else {
        this.crash(isWater(this.x, this.y) ? 'Crashed into the sea' : 'Crashed into the ground');
        events.push('crash');
      }
    }
    return events;
  }

  crash(reason) {
    this.crashed = true;
    this.crashReason = reason;
    this.speedKnots = 0;
  }

  /** Refuel after a ring, clamped to 100. */
  refuel() {
    this.fuel = clamp(this.fuel + PHYSICS.fuelPerRing, 0, 100);
  }

  get stalled() {
    return this.speedKnots < PHYSICS.stallSpeedKnots && this.altitude > 0;
  }
}
