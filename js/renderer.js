// Canvas renderer: animated gradient background + twinkling starfield, pulsing
// energy border, glowing food (normal / big gold / math cyan orb), particles,
// snakes (drop shadow + tube + skin segments + glossy highlight + boost/turbo
// glow + speed lines), expressive heads with tracking eyes + name labels,
// mobile joystick + boost button overlays, and a circular minimap.
class Renderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.cam = camera;
    this.t = 0;
    this.input = null;

    // Precomputed starfield tile (deterministic, twinkles at runtime).
    this._starTile = 2048;
    this._stars = [];
    const rng = mulberry(0x9e3779b9);
    for (let i = 0; i < 70; i++) {
      this._stars.push({
        x: rng() * this._starTile,
        y: rng() * this._starTile,
        r: 0.6 + rng() * 1.8,
        phase: rng() * TAU,
        speed: 0.6 + rng() * 1.6,
        hue: 200 + (rng() * 120) | 0,
      });
    }
  }

  // ---------------------------------------------------------------- main draw
  draw(world, input) {
    const ctx = this.ctx, cam = this.cam;
    this.input = input;

    // Base fill (independent of camera transform)
    ctx.save();
    ctx.fillStyle = '#070a18';
    ctx.fillRect(0, 0, cam.width, cam.height);

    // Camera transform including screen shake.
    ctx.translate(cam.width / 2 + cam.shakeX, cam.height / 2 + cam.shakeY);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this._drawBackground(ctx, cam);
    this._drawBorder(ctx);
    this._drawFood(ctx, world.food, cam);
    world.particles.draw(ctx, cam);
    this._drawSnakes(ctx, world, cam);

    ctx.restore();
  }

  // ------------------------------------------------- screen-space UI overlays
  drawUI(world, input) {
    this._drawJoystick(input);
    this._drawBoostButton(input);
  }

  // ------------------------------------------------- animated background
  _drawBackground(ctx, cam) {
    const b = cam.visibleBounds();
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY);

    // Slowly hue-shifting radial wash centered on the camera view.
    const hue = (this.t * 0.006) % 360;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, span * 0.75);
    g.addColorStop(0, `hsla(${hue.toFixed(0)}, 60%, 16%, 1)`);
    g.addColorStop(0.55, `hsla(${((hue + 40) % 360).toFixed(0)}, 55%, 8%, 1)`);
    g.addColorStop(1, '#05060f');
    ctx.fillStyle = g;
    ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);

    // Soft moving glow blob that drifts across the field.
    const driftA = this.t * 0.00018;
    const gx = cx + Math.cos(driftA) * span * 0.22;
    const gy = cy + Math.sin(driftA * 1.3) * span * 0.22;
    const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, span * 0.45);
    gg.addColorStop(0, `hsla(${((hue + 80) % 360).toFixed(0)}, 80%, 60%, 0.16)`);
    gg.addColorStop(1, 'hsla(0,0%,0%,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);

    // Faint grid lines.
    const grid = CONFIG.BG_GRID;
    ctx.lineWidth = 1 / cam.zoom;
    ctx.strokeStyle = 'rgba(120,140,220,0.07)';
    ctx.beginPath();
    const x0 = Math.floor(b.minX / grid) * grid;
    const y0 = Math.floor(b.minY / grid) * grid;
    for (let x = x0; x < b.maxX; x += grid) { ctx.moveTo(x, b.minY); ctx.lineTo(x, b.maxY); }
    for (let y = y0; y < b.maxY; y += grid) { ctx.moveTo(b.minX, y); ctx.lineTo(b.maxX, y); }
    ctx.stroke();

    // Brighter accent grid every 4 cells.
    ctx.strokeStyle = 'rgba(150,180,255,0.10)';
    ctx.beginPath();
    const big = grid * 4;
    const bx0 = Math.floor(b.minX / big) * big;
    const by0 = Math.floor(b.minY / big) * big;
    for (let x = bx0; x < b.maxX; x += big) { ctx.moveTo(x, b.minY); ctx.lineTo(x, b.maxY); }
    for (let y = by0; y < b.maxY; y += big) { ctx.moveTo(b.minX, y); ctx.lineTo(b.maxX, y); }
    ctx.stroke();

    // Twinkling starfield (tiled across the visible area).
    const tile = this._starTile;
    const tx0 = Math.floor(b.minX / tile), tx1 = Math.floor(b.maxX / tile);
    const ty0 = Math.floor(b.minY / tile), ty1 = Math.floor(b.maxY / tile);
    const tt = this.t * 0.003;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const ox = tx * tile, oy = ty * tile;
        for (let i = 0; i < this._stars.length; i++) {
          const s = this._stars[i];
          const sx = ox + s.x, sy = oy + s.y;
          if (sx < b.minX || sx > b.maxX || sy < b.minY || sy > b.maxY) continue;
          const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tt * s.speed + s.phase));
          ctx.globalAlpha = tw * 0.8;
          ctx.fillStyle = `hsl(${s.hue}, 85%, 82%)`;
          ctx.beginPath();
          ctx.arc(sx, sy, s.r, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------- pulsing energy border
  _drawBorder(ctx) {
    const R = CONFIG.WORLD_RADIUS;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 0.0028);

    ctx.save();
    // Outer wide soft glow.
    ctx.lineWidth = 40 + pulse * 14;
    ctx.strokeStyle = `hsla(265, 85%, 62%, ${0.10 + pulse * 0.07})`;
    ctx.shadowColor = '#7a4dff';
    ctx.shadowBlur = 80;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();

    // Rotating dashed energy ring.
    ctx.shadowBlur = 28;
    ctx.lineWidth = 7;
    ctx.strokeStyle = `hsla(${(275 + pulse * 30).toFixed(0)}, 95%, 72%, 0.95)`;
    ctx.setLineDash([34, 26]);
    ctx.lineDashOffset = -this.t * 0.05;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();

    // Crisp inner core ring.
    ctx.setLineDash([]);
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(220,200,255,0.95)';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------- food (3 kinds)
  _drawFood(ctx, food, cam) {
    const b = cam.visibleBounds();
    const tt = this.t * 0.004;
    const pad = 60;
    for (let i = 0; i < food.length; i++) {
      const f = food[i];
      if (f.x < b.minX - pad || f.x > b.maxX + pad || f.y < b.minY - pad || f.y > b.maxY + pad) continue;
      const pulse = 1 + Math.sin(tt + f.pulse) * 0.14;
      const r = f.r * pulse;

      if (f.kind === 'math') {
        this._drawMathOrb(ctx, f, r, tt);
      } else if (f.kind === 'big') {
        this._drawBigOrb(ctx, f, r, tt);
      } else {
        this._drawNormalPellet(ctx, f, r);
      }
    }
  }

  _drawNormalPellet(ctx, f, r) {
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
    // Glossy spec.
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(f.x - r * 0.32, f.y - r * 0.32, r * 0.38, 0, TAU);
    ctx.fill();
  }

  _drawBigOrb(ctx, f, r, tt) {
    // Outer glowing halo.
    const g = ctx.createRadialGradient(f.x, f.y, r * 0.4, f.x, f.y, r * 2.6);
    g.addColorStop(0, 'rgba(255,225,90,0.55)');
    g.addColorStop(1, 'rgba(255,225,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y, r * 2.6, 0, TAU); ctx.fill();
    // Core.
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
    // Inner shine.
    const ig = ctx.createRadialGradient(f.x - r * 0.3, f.y - r * 0.3, r * 0.1, f.x, f.y, r);
    ig.addColorStop(0, 'rgba(255,255,255,0.9)');
    ig.addColorStop(1, 'rgba(255,225,90,0)');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
    // Sparkle glints.
    this._drawSparkles(ctx, f, r, tt, 4, '#fff6c0');
  }

  _drawMathOrb(ctx, f, r, tt) {
    // Wide cyan glow.
    const g = ctx.createRadialGradient(f.x, f.y, r * 0.4, f.x, f.y, r * 3.2);
    g.addColorStop(0, 'rgba(122,255,240,0.5)');
    g.addColorStop(1, 'rgba(122,255,240,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y, r * 3.2, 0, TAU); ctx.fill();

    // Rotating outer ring of arcs.
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(this.t * 0.0022);
    ctx.strokeStyle = 'rgba(180,255,250,0.85)';
    ctx.lineWidth = 2.2;
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * TAU;
      ctx.beginPath();
      ctx.arc(0, 0, r + 7, a0, a0 + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    // Pulsing inner ring.
    const ringR = r + 3 + Math.sin(this.t * 0.006) * 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(f.x, f.y, ringR, 0, TAU); ctx.stroke();

    // Core orb.
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
    // Inner gloss.
    const ig = ctx.createRadialGradient(f.x - r * 0.3, f.y - r * 0.3, r * 0.1, f.x, f.y, r);
    ig.addColorStop(0, 'rgba(255,255,255,0.85)');
    ig.addColorStop(1, 'rgba(122,255,240,0)');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();

    // Pulsing "x" glyph.
    const gp = 0.7 + 0.3 * Math.sin(this.t * 0.008);
    ctx.strokeStyle = `rgba(8,30,32,${gp})`;
    ctx.lineWidth = Math.max(1.6, r * 0.22);
    ctx.lineCap = 'round';
    const d = r * 0.42;
    ctx.beginPath();
    ctx.moveTo(f.x - d, f.y - d); ctx.lineTo(f.x + d, f.y + d);
    ctx.moveTo(f.x + d, f.y - d); ctx.lineTo(f.x - d, f.y + d);
    ctx.stroke();

    this._drawSparkles(ctx, f, r, tt, 5, '#cffff8');
  }

  // Rotating sparkle glints around an orb.
  _drawSparkles(ctx, f, r, tt, count, color) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(this.t * 0.003 + f.pulse);
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + Math.sin(tt + i) * 0.2;
      const dist = r * (1.7 + 0.5 * Math.sin(tt * 1.5 + i));
      const sx = Math.cos(a) * dist, sy = Math.sin(a) * dist;
      const sz = (0.5 + 0.5 * Math.sin(tt * 3 + i * 1.7)) * r * 0.28;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(tt * 2 + i);
      ctx.beginPath();
      ctx.moveTo(sx, sy - sz);
      ctx.lineTo(sx + sz * 0.3, sy);
      ctx.lineTo(sx, sy + sz);
      ctx.lineTo(sx - sz * 0.3, sy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ------------------------------------------------- snakes
  _drawSnakes(ctx, world, cam) {
    const list = world.snakes.filter(s => s.alive).slice().sort((a, b) => a.score - b.score);
    for (let i = 0; i < list.length; i++) this._drawSnake(ctx, list[i], cam, world);
  }

  _drawSnake(ctx, s, cam, world) {
    const pts = s.points;
    if (pts.length < 2) return;
    const r = s.radius;
    const b = cam.visibleBounds();
    // Whole-snake bounds cull.
    if (s.head.x < b.minX - 600 || s.head.x > b.maxX + 600 ||
        s.head.y < b.minY - 600 || s.head.y > b.maxY + 600) {
      // Tail may still be visible; fall through but skip if fully off.
      const tail = pts[pts.length - 1];
      if (tail.x < b.minX - 600 && tail.x < b.maxX + 600) { /* keep cheap */ }
    }
    const step = Math.max(1, Math.floor(CONFIG.SEGMENT_SPACING / (r * 0.5)));
    const len = pts.length;
    const isPlayer = (world && s === world.player);
    const boosting = s.boosting || s.isTurbo;
    const baseColor = (s.skin.body === 'rainbow') ? '#9b59b6' : s.skin.body;
    const glowColor = s.isTurbo ? '#7afff0' : (s.skin.body === 'rainbow' ? '#ffffff' : s.skin.body);

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // --- Soft drop shadow beneath the snake.
    ctx.save();
    ctx.translate(0, r * 0.55);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.moveTo(pts[len - 1].x, pts[len - 1].y);
    for (let i = len - 1 - step; i >= 0; i -= step) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = r * 2.0;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.stroke();
    ctx.restore();

    // --- Player-only bloom glow.
    if (isPlayer) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 26;
      ctx.lineWidth = r * 2.35;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(pts[len - 1].x, pts[len - 1].y);
      for (let i = len - 1 - step; i >= 0; i -= step) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // --- Dark outline (gives the tube a clean rim).
    ctx.lineWidth = r * 2.18;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.moveTo(pts[len - 1].x, pts[len - 1].y);
    for (let i = len - 1 - step; i >= 0; i -= step) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // --- Main tube fill.
    ctx.lineWidth = r * 2.0;
    ctx.strokeStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(pts[len - 1].x, pts[len - 1].y);
    for (let i = len - 1 - step; i >= 0; i -= step) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // --- Skin pattern segments (culled).
    for (let i = 0; i < len; i += step * 2) {
      const p = pts[i];
      if (p.x < b.minX - 80 || p.x > b.maxX + 80 || p.y < b.minY - 80 || p.y > b.maxY + 80) continue;
      drawSegment(ctx, s.skin, p.x, p.y, r, this.t, i);
      // Glossy top highlight on each visible segment.
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.ellipse(p.x - r * 0.18, p.y - r * 0.32, r * 0.55, r * 0.28, s.heading, 0, TAU);
      ctx.fill();
    }

    // --- Sheen line down the spine (cylindrical 3D feel).
    ctx.lineWidth = r * 0.34;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(pts[len - 1].x, pts[len - 1].y);
    for (let i = len - 1 - step; i >= 0; i -= step) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // --- Boost / turbo glow + speed lines.
    if (boosting) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = s.isTurbo ? 36 : 24;
      ctx.lineWidth = r * (s.isTurbo ? 2.4 : 2.15);
      ctx.strokeStyle = s.isTurbo ? 'rgba(122,255,240,0.4)' : 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(pts[len - 1].x, pts[len - 1].y);
      for (let i = len - 1 - step; i >= 0; i -= step) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      this._drawSpeedLines(ctx, s, glowColor);
    }
    ctx.restore();

    this._drawHead(ctx, s, cam, world);
  }

  // Motion-blur streaks emanating behind the head.
  _drawSpeedLines(ctx, s, color) {
    const h = s.head;
    const back = V2.fromAngle(s.heading + Math.PI);
    const perp = V2.fromAngle(s.heading + Math.PI / 2);
    const r = s.radius;
    const lines = 5;
    const flick = 0.5 + 0.5 * Math.sin(this.t * 0.04);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < lines; i++) {
      const off = (i - (lines - 1) / 2) * r * 0.55;
      const len = r * (2.4 + flick * 1.4) + i * r * 0.25;
      const sx = h.x + back.x * r * 0.6 + perp.x * off;
      const sy = h.y + back.y * r * 0.6 + perp.y * off;
      const ex = sx + back.x * len;
      const ey = sy + back.y * len;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.22 + 0.18 * (1 - Math.abs(i - (lines - 1) / 2) / lines);
      ctx.lineWidth = r * (0.18 + 0.12 * flick);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ------------------------------------------------- head + eyes + label
  _drawHead(ctx, s, cam, world) {
    const h = s.head;
    const r = s.radius;
    const b = cam.visibleBounds();
    if (h.x < b.minX - 120 || h.x > b.maxX + 120 || h.y < b.minY - 120 || h.y > b.maxY + 120) return;

    const lookA = this.input ? this.input.headingFrom(h) : s.heading;
    const lookDir = V2.fromAngle(lookA);
    const moveDir = V2.fromAngle(s.heading);
    const eyeDir = V2.norm({
      x: moveDir.x * 0.45 + lookDir.x * 0.55,
      y: moveDir.y * 0.45 + lookDir.y * 0.55,
    });

    const isPlayer = (world && s === world.player);
    const baseColor = (s.skin.body === 'rainbow') ? '#9b59b6' : s.skin.body;
    const glowColor = s.isTurbo ? '#7afff0' : baseColor;

    ctx.save();
    ctx.translate(h.x, h.y);

    // Turbo / boost aura on the head.
    if (s.boosting || s.isTurbo) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = s.isTurbo ? 34 : 20;
    } else if (isPlayer) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 16;
    }

    // Head body (slightly elongated along heading).
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.12, r * 1.0, s.heading, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Head rim + glossy top highlight.
    const hg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    hg.addColorStop(0, 'rgba(255,255,255,0.55)');
    hg.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.12, r * 1.0, s.heading, 0, TAU);
    ctx.fill();

    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.12, r * 1.0, s.heading, 0, TAU);
    ctx.stroke();

    // Eyes positioned perpendicular to heading; pupils track eyeDir.
    const eyeR = r * 0.42;
    const ex = r * 0.42, ey = r * 0.56;
    const cosH = Math.cos(s.heading), sinH = Math.sin(s.heading);
    const placeEye = (sx, sy) => ({ x: sx * cosH - sy * sinH, y: sx * sinH + sy * cosH });
    const e1 = placeEye(ex, -ey), e2 = placeEye(ex, ey);
    const pupilOff = eyeR * 0.42;
    for (const e of [e1, e2]) {
      // White sclera with subtle shading.
      const sg = ctx.createRadialGradient(e.x - eyeR * 0.2, e.y - eyeR * 0.2, eyeR * 0.1, e.x, e.y, eyeR);
      sg.addColorStop(0, '#ffffff');
      sg.addColorStop(1, '#d8d8e6');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(e.x, e.y, eyeR, 0, TAU); ctx.fill();
      // Pupil.
      ctx.fillStyle = '#0a0a18';
      ctx.beginPath();
      ctx.arc(e.x + eyeDir.x * pupilOff, e.y + eyeDir.y * pupilOff, eyeR * 0.52, 0, TAU);
      ctx.fill();
      // Pupil glint.
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(e.x + eyeDir.x * pupilOff - eyeR * 0.16,
              e.y + eyeDir.y * pupilOff - eyeR * 0.16, eyeR * 0.14, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Name label above the head.
    ctx.save();
    ctx.translate(h.x, h.y - r - 18);
    ctx.scale(1 / cam.zoom, 1 / cam.zoom);
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(s.name, 0, 0);
    ctx.fillStyle = isPlayer ? '#ffe14d' : '#ffffff';
    ctx.fillText(s.name, 0, 0);
    ctx.restore();
  }

  // ------------------------------------------------- mobile joystick overlay
  _drawJoystick(input) {
    if (!input) return;
    const j = input.joystickDrawData && input.joystickDrawData();
    if (!j) return;
    const ctx = this.ctx;
    const R = 92;
    ctx.save();
    // Outer ring with soft glow.
    ctx.shadowColor = 'rgba(150,120,255,0.8)';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = 'rgba(184,166,255,0.85)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(j.cx, j.cy, R, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
    // Translucent fill.
    const fg = ctx.createRadialGradient(j.cx, j.cy, 10, j.cx, j.cy, R);
    fg.addColorStop(0, 'rgba(150,120,255,0.32)');
    fg.addColorStop(1, 'rgba(80,60,180,0.10)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(j.cx, j.cy, R, 0, TAU); ctx.fill();
    // Inner directional hint.
    ctx.strokeStyle = 'rgba(184,166,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(j.cx, j.cy, R * 0.55, 0, TAU); ctx.stroke();
    // Thumb knob.
    const kx = j.cx + j.dx, ky = j.cy + j.dy;
    const kg = ctx.createRadialGradient(kx - 8, ky - 8, 4, kx, ky, 34);
    kg.addColorStop(0, '#ffffff');
    kg.addColorStop(0.5, '#c8b8ff');
    kg.addColorStop(1, '#8a74ff');
    ctx.fillStyle = kg;
    ctx.shadowColor = 'rgba(150,120,255,0.9)';
    ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(kx, ky, 34, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------- boost button hint
  _drawBoostButton(input) {
    if (!input || !isTouch()) return;
    if (input.boostBtn) return;
    const ctx = this.ctx;
    const cx = this.cam.width - 92, cy = this.cam.height - 92;
    const R = 60;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 0.005);
    ctx.save();
    // Glow ring.
    ctx.shadowColor = 'rgba(122,255,240,0.9)';
    ctx.shadowBlur = 22 + pulse * 10;
    ctx.strokeStyle = `rgba(122,255,240,${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
    // Translucent disc.
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, R);
    g.addColorStop(0, 'rgba(122,255,240,0.45)');
    g.addColorStop(1, 'rgba(122,255,240,0.08)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // Bolt glyph.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u26A1', cx, cy + 1);
    ctx.restore();
  }

  // ------------------------------------------------- circular minimap
  drawMinimap(ctx, world, player, size) {
    const s = size;
    const cx = this.cam.width - s - 18;
    const cy = 18;
    const ox = cx + s / 2, oy = cy + s / 2;
    const R = s / 2;
    ctx.save();
    // Backdrop with soft outer glow.
    ctx.shadowColor = 'rgba(150,120,255,0.7)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(8,12,24,0.88)';
    ctx.beginPath(); ctx.arc(ox, oy, R + 3, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // Clip to the circle.
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, TAU); ctx.clip();
    // Inner subtle gradient.
    const mg = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);
    mg.addColorStop(0, 'rgba(40,30,80,0.5)');
    mg.addColorStop(1, 'rgba(8,12,24,0.2)');
    ctx.fillStyle = mg;
    ctx.fillRect(cx, cy, s, s);
    // World boundary ring on minimap.
    ctx.strokeStyle = 'rgba(180,140,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ox, oy, R - 1, 0, TAU); ctx.stroke();

    const scale = (R - 2) / CONFIG.WORLD_RADIUS;
    for (let i = 0; i < world.snakes.length; i++) {
      const sn = world.snakes[i];
      if (!sn.alive) continue;
      const px = ox + sn.head.x * scale;
      const py = oy + sn.head.y * scale;
      if (sn === player) {
        // Player: gold dot with glow.
        ctx.shadowColor = '#ffe14d';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.arc(px, py, 3.6, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = sn.isBot ? '#7afff0' : '#ffffff';
        ctx.beginPath(); ctx.arc(px, py, 2.0, 0, TAU); ctx.fill();
      }
    }
    // Ring frame on top.
    ctx.strokeStyle = 'rgba(184,166,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}