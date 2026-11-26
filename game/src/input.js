// Merpati Express — keyboard and mouse input, read once per frame.
// Keys: W/S or Up/Down throttle, A/D or Left/Right turn, Shift/E climb,
// Ctrl/Q descend, P pause, M mute, Enter/Space start. Mouse: hold the left
// button to steer toward the pointer, wheel for throttle, click for menus.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, rightDown: false, wheel: 0 };
    this.clicked = null; // {x, y} of the latest click, consumed by the game
    this.pressed = new Set(); // keys pressed since last frame, consumed by the game
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.rightDown = false;
    });

    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.rightDown = true;
      this.clicked = { x: this.mouse.x, y: this.mouse.y };
      e.preventDefault();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.mouse.wheel += e.deltaY < 0 ? 0.06 : -0.06;
      e.preventDefault();
    }, { passive: false });
  }

  down(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** Flight controls for this frame (values the plane understands). */
  flightControls() {
    const turn =
      (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) -
      (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    return {
      turn,
      throttleUp: this.down('KeyW') || this.down('ArrowUp'),
      throttleDown: this.down('KeyS') || this.down('ArrowDown'),
      climb: this.down('ShiftLeft') || this.down('ShiftRight') || this.down('KeyE') || this.mouse.rightDown,
      descend: this.down('ControlLeft') || this.down('ControlRight') || this.down('KeyQ'),
      mouseSteer: this.mouse.down,
      steerTo: null, // filled in by the game (screen -> world)
    };
  }

  /** Clear the one-shot presses after the game has read them. */
  endFrame() {
    this.pressed.clear();
    this.clicked = null;
    this.mouse.wheel = 0;
  }
}
