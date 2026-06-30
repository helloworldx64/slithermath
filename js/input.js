// Input handler. Desktop: mouse aim + click/space to boost. Mobile: on-screen
// virtual joystick (left side) + boost button (right side). Both work simultaneously.
class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.aim = { x: 1, y: 0 };
    this.boost = false;

    // Joystick state (touch)
    this.joy = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0, mag: 0 };
    this.boostBtn = false;

    // --- Desktop mouse ---
    canvas.addEventListener('mousemove', (e) => this._mouseMove(e.clientX, e.clientY));
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) this.boost = true; });
    canvas.addEventListener('mouseup', (e) => { if (e.button === 0) this.boost = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Touch (joystick + boost button) ---
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this._touchStart(e); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this._touchMove(e); }, { passive: false });
    canvas.addEventListener('touchend', (e) => { e.preventDefault(); this._touchEnd(e); }, { passive: false });

    // --- Keyboard ---
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ShiftLeft') { this.boost = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ShiftLeft') this.boost = false;
    });
  }

  _mouseMove(cx, cy) {
    const w = this.camera.screenToWorld(cx, cy);
    this.aim.x = w.x; this.aim.y = w.y;
  }

  _touchStart(e) {
    for (const t of e.changedTouches) {
      // Left half of screen = joystick; right half = boost button
      if (t.clientX < this.camera.width / 2 && !this.joy.active) {
        this.joy.active = true; this.joy.id = t.identifier;
        this.joy.cx = t.clientX; this.joy.cy = t.clientY;
        this.joy.dx = 0; this.joy.dy = 0; this.joy.mag = 0;
      } else if (t.clientX >= this.camera.width / 2) {
        this.boostBtn = true;
      }
    }
  }
  _touchMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.joy.id) {
        let dx = t.clientX - this.joy.cx;
        let dy = t.clientY - this.joy.cy;
        const mag = Math.hypot(dx, dy);
        const maxR = 70;
        if (mag > maxR) { dx = dx / mag * maxR; dy = dy / mag * maxR; }
        this.joy.dx = dx; this.joy.dy = dy; this.joy.mag = Math.min(1, mag / maxR);
        // aim = direction from joystick center
        this.aim.x = this.joy.cx + dx * 100;
        this.aim.y = this.joy.cy + dy * 100;
        // convert to world coords via a virtual point ahead of player
        // (handled in headingFrom using screen-to-world)
        this._joyScreenX = this.joy.cx + dx;
        this._joyScreenY = this.joy.cy + dy;
      }
    }
  }
  _touchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.joy.id) {
        this.joy.active = false; this.joy.id = null;
        this.joy.dx = 0; this.joy.dy = 0; this.joy.mag = 0;
      } else {
        this.boostBtn = false;
      }
    }
  }

  headingFrom(head) {
    if (this.joy.active && this._joyScreenX != null) {
      // joystick: steer relative to screen center-of-player
      const w = this.camera.screenToWorld(this._joyScreenX, this._joyScreenY);
      return Math.atan2(w.y - head.y, w.x - head.x);
    }
    return Math.atan2(this.aim.y - head.y, this.aim.x - head.x);
  }

  isBoosting() { return this.boost || this.boostBtn; }

  // Joystick draw data for the renderer
  joystickDrawData() {
    if (!this.joy.active) return null;
    return { cx: this.joy.cx, cy: this.joy.cy, dx: this.joy.dx, dy: this.joy.dy, mag: this.joy.mag };
  }
}