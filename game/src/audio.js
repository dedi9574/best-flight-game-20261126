// Merpati Express — synthesized sound: a WebAudio engine hum whose pitch
// follows the throttle, plus a ring chime, a crash thud and a landing fanfare.
// No audio files: everything is built from oscillators and noise.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.noiseGain = null;
    this.started = false;
  }

  /** Create the context on a user gesture (browsers block audio before one). */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine hum: two detuned saws through a low-pass, gain follows throttle.
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 82;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.5;
    this.engineOsc.connect(filter);
    this.engineOsc2.connect(g2);
    g2.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    this.engineOsc2.start();
    // Wind noise: a looping filtered noise buffer.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 900;
    noiseFilter.Q.value = 0.6;
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;
    noise.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.ctx.destination);
    noise.start();
    this.started = true;
  }

  /** Call every frame while flying: throttle 0..1, speed in knots. */
  setFlight(throttle, speedKnots) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const hum = 0.05 + throttle * 0.075;
    this.engineGain.gain.setTargetAtTime(hum, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + throttle * 70, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(72 + throttle * 105, t, 0.1);
    this.noiseGain.gain.setTargetAtTime(Math.min(0.05, speedKnots / 320 * 0.05), t, 0.2);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) {
      this.engineGain.gain.setTargetAtTime(muted ? 0 : 0.06, this.ctx.currentTime, 0.05);
      this.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  /** A short two-note chime when the plane passes a ring. */
  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [880, 1318].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.22, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.5);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.55);
    });
  }

  /** A low thud for a crash or a hard mountain hit. */
  thud(big = true) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(big ? 120 : 90, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(big ? 0.5 : 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.45);
  }

  /** A short rising fanfare for a landing or mission complete. */
  fanfare() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.11);
      g.gain.exponentialRampToValueAtTime(0.2, t + i * 0.11 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + 0.5);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t + i * 0.11);
      o.stop(t + i * 0.11 + 0.55);
    });
  }

  /** Silence the engine (menu / game over). */
  idle() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0, t, 0.1);
    this.noiseGain.gain.setTargetAtTime(0, t, 0.1);
  }
}
