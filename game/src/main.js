// Merpati Express — bootstrap and game loop: the state machine (menu,
// playing, paused, end), ring checks, scoring, best scores and mouse steering.
// All game code in this entry was written from scratch for this bounty.

import { MISSIONS, PHYSICS, SCORE, STORAGE_BEST_PREFIX, WORLD } from './config.js';
import { clamp, headingToRad } from './random.js';
import { Plane } from './plane.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import {
  CAMERA_SCALE,
  drawTerrain, drawRings, drawClouds, drawPlaneShadow, drawPlane,
  drawHUD, drawNightAndRain, drawMenu, drawPaused, drawEnd, missionCardRects,
} from './render.js';
import { applyShot } from './shots.js';
import { bearingTo } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const input = new Input(canvas);
const sound = new SoundEngine();

class Game {
  constructor() {
    this.state = 'menu'; // menu | playing | paused | end
    this.missionIndex = 0;
    this.mission = MISSIONS[0];
    this.plane = new Plane(this.mission);
    this.ringIndex = 0;
    this.score = 0;
    this.time = 0; // seconds since mission start (drives clouds, rain, lightning)
    this.timeLeft = 0;
    this.best = 0;
    this.bests = MISSIONS.map((m) => this.loadBest(m.id));
    this.menuHover = -1;
    this.endKind = 'complete'; // complete | failed
    this.endMessage = '';
    this.lightning = 0;
    this.frozen = false; // screenshot mode: render the scene, do not simulate
    this.flashRing = 0;
    this.lastStatus = '';
  }

  loadBest(missionId) {
    try {
      return Number(window.localStorage.getItem(STORAGE_BEST_PREFIX + missionId)) || 0;
    } catch {
      return 0;
    }
  }

  saveBest(missionId, score) {
    try {
      window.localStorage.setItem(STORAGE_BEST_PREFIX + missionId, String(score));
    } catch {
      // Private mode: best scores just do not persist.
    }
  }

  startMission(id) {
    this.missionIndex = id - 1;
    this.mission = MISSIONS[this.missionIndex];
    this.plane = new Plane(this.mission);
    this.ringIndex = 0;
    this.score = 0;
    this.time = 0;
    this.timeLeft = this.mission.timeLimit;
    this.best = this.bests[this.missionIndex];
    this.state = 'playing';
    this.frozen = false;
    this.lightning = 0;
    sound.ensure();
    this.announce(`Mission ${id}: ${this.mission.name}. ${this.mission.short}`);
  }

  endMission(kind, message) {
    this.endKind = kind;
    this.endMessage = message;
    this.state = 'end';
    sound.idle();
    if (kind === 'complete') {
      const timeBonus = Math.round(this.timeLeft * SCORE.timeBonusPerSecond);
      this.score += timeBonus;
      sound.fanfare();
    } else {
      sound.thud(true);
    }
    if (this.score > this.best) {
      this.best = this.score;
      this.bests[this.missionIndex] = this.score;
      this.saveBest(this.mission.id, this.score);
    }
    this.announce(`${kind === 'complete' ? 'Mission complete' : 'Sortie over'}. ${message} Score ${this.score}.`);
  }

  announce(text) {
    if (text !== this.lastStatus) {
      this.lastStatus = text;
      statusEl.textContent = text;
    }
  }

  /** One frame of simulation (skipped while frozen, paused or in a menu). */
  update(dt) {
    this.time += dt;
    if (this.mission.night) {
      this.lightning = Math.max(0, this.lightning - dt * 1.4);
      if (Math.random() < dt * 0.06) this.lightning = 1;
    }

    const ctrl = input.flightControls();
    // Mouse steering: convert the pointer to a world point.
    if (ctrl.mouseSteer) {
      const wx = this.plane.x + (input.mouse.x - canvas.width / 2) / CAMERA_SCALE;
      const wy = this.plane.y + (input.mouse.y - canvas.height / 2) / CAMERA_SCALE;
      ctrl.steerTo = { x: wx, y: wy };
    }
    if (input.mouse.wheel !== 0) {
      ctrl.throttleSet = clamp(this.plane.throttle + input.mouse.wheel, 0, 1);
    }

    const events = this.plane.update(ctrl, dt, this.mission, this.time);
    sound.setFlight(this.plane.throttle, this.plane.speedKnots);

    // Ring checks.
    const ring = this.mission.rings[this.ringIndex];
    if (ring) {
      const d = Math.hypot(this.plane.x - ring.x, this.plane.y - ring.y);
      if (d < PHYSICS.ringRadius && Math.abs(this.plane.altitude - ring.alt) <= PHYSICS.ringAltBand) {
        this.ringIndex++;
        let gained = SCORE.ring;
        if (Math.abs(this.plane.altitude - ring.alt) <= 50) gained += SCORE.ringCenterBonus;
        this.score += gained;
        this.plane.refuel();
        this.flashRing = 1;
        sound.chime();
        this.announce(`Ring ${this.ringIndex} of ${this.mission.rings.length}. Score ${this.score}.`);
        if (this.ringIndex >= this.mission.rings.length && !this.mission.landing) {
          this.endMission('complete', `All ${this.mission.rings.length} rings flown — ${this.mission.name} done!`);
          return;
        }
      }
    }

    for (const e of events) {
      if (e === 'mountain') sound.thud(false);
      if (e === 'landed') {
        const align = Math.abs(((this.plane.headingDeg - WORLD.runway.headingDeg + 540) % 360) - 180);
        const quality = clamp(1 - align / 30, 0, 1) * clamp(1 - this.plane.speedKnots / 110, 0, 1);
        this.score += SCORE.landingBase + Math.round(quality * SCORE.landingBonusMax);
        this.endMission('complete', `Touchdown on runway 09 — smooth landing!`);
        return;
      }
      if (e === 'crash') {
        this.endMission('failed', this.plane.crashReason);
        return;
      }
    }

    // Timer.
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endMission('failed', 'Time ran out before the mission was done.');
      return;
    }

    // Out of fuel while still airborne and gliding down: the plane will crash
    // on its own when it reaches the ground; nothing else to do here.
    if (this.flashRing > 0) this.flashRing = Math.max(0, this.flashRing - dt * 2);
  }

  /** Handle one-shot keys and clicks for the current state. */
  handleInputs() {
    if (input.wasPressed('KeyM')) sound.setMuted(!sound.muted);
    if (this.state === 'menu') {
      if (input.wasPressed('Digit1')) this.startMission(1);
      if (input.wasPressed('Digit2')) this.startMission(2);
      if (input.wasPressed('Digit3')) this.startMission(3);
      if (input.wasPressed('Enter') || input.wasPressed('Space')) this.startMission(1);
      if (input.clicked) {
        const rects = missionCardRects(canvas.width, canvas.height);
        rects.forEach((r, i) => {
          if (input.clicked.x >= r.x && input.clicked.x <= r.x + r.w &&
              input.clicked.y >= r.y && input.clicked.y <= r.y + r.h) {
            this.startMission(i + 1);
          }
        });
      }
      // Hover highlight for the mission cards.
      const rects = missionCardRects(canvas.width, canvas.height);
      this.menuHover = rects.findIndex((r) =>
        input.mouse.x >= r.x && input.mouse.x <= r.x + r.w &&
        input.mouse.y >= r.y && input.mouse.y <= r.y + r.h);
      return;
    }
    if (this.state === 'playing') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        this.state = 'paused';
        sound.idle();
      }
      return;
    }
    if (this.state === 'paused') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.clicked) {
        this.state = 'playing';
        sound.ensure();
      }
      return;
    }
    if (this.state === 'end') {
      if (input.wasPressed('KeyR')) this.startMission(this.mission.id);
      if (input.wasPressed('Escape')) this.state = 'menu';
    }
  }

  /** Draw the current frame. */
  render() {
    const w = canvas.width, h = canvas.height;
    const g = {
      w, h,
      plane: this.plane,
      mission: this.mission,
      rings: this.mission.rings,
      ringIndex: this.ringIndex,
      score: this.score,
      timeLeft: this.timeLeft,
      time: this.time,
      best: this.best,
      bests: this.bests,
      menuHover: this.menuHover,
      state: this.state,
      endKind: this.endKind,
      endMessage: this.endMessage,
      lightning: this.lightning,
      MISSIONS,
    };

    if (this.state === 'menu') {
      drawMenu(ctx, g);
      return;
    }

    // Chase view: the world scrolls under the plane at the screen centre.
    const scale = CAMERA_SCALE;
    const view = {
      x0: this.plane.x - (w / 2) / scale,
      y0: this.plane.y - (h / 2) / scale,
      x1: this.plane.x + (w / 2) / scale,
      y1: this.plane.y + (h / 2) / scale,
    };
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-this.plane.x, -this.plane.y);
    drawTerrain(ctx, view, this.mission.night);
    drawRings(ctx, this.mission.rings, this.ringIndex, this.time);
    drawClouds(ctx, this.time, this.mission.night);
    drawPlaneShadow(ctx, this.plane);
    ctx.restore();

    // The aircraft itself, always centred.
    drawPlane(ctx, w / 2, h / 2, this.plane);

    // A green flash when a ring is passed.
    if (this.flashRing > 0) {
      ctx.fillStyle = `rgba(57, 255, 136, ${this.flashRing * 0.14})`;
      ctx.fillRect(0, 0, w, h);
    }

    drawNightAndRain(ctx, g);
    drawHUD(ctx, g);
    if (this.state === 'paused') drawPaused(ctx, g);
    if (this.state === 'end') drawEnd(ctx, g);
  }
}

const game = new Game();

// Screenshot scenes: ?shot=start|play|landing|storm (&seed= accepted).
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(game, shot);
}

// Exposed for automated play-testing (not part of the game itself).
window.__game = game;

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  game.handleInputs();
  if (game.state === 'playing' && !game.frozen) game.update(dt);
  game.render();
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
