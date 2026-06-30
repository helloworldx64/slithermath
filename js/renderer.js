// Canvas renderer: background grid + border, food, math orbs, particles, snakes
// (with glow/eyes/names), minimap, and the mobile joystick overlay.
class Renderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.cam = camera;
    this.t = 0;
  }

  draw(world, input) {
    const ctx = this.ctx, cam = this.cam;
    this.input = input;
    ctx.save();
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, cam.width, cam.height);

    // Camera transform (with shake)
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

  // UI overlays drawn in screen space (no camera transform)
  drawUI(world, input) {
    this._drawJoystick(input);
    this._drawBoostButton(input);
  }

  _drawBackground(ctx, cam) {
    const g = CONFIG.BG_GRID;
    const b = cam.visibleBounds();
    const x0 = Math.floor(b.minX / g) * g;
    const y0 = Math.floor(b.minY / g) * g;
    for (let x = x0; x < b.maxX; x += g) {
      for (let y = y0; y < b.maxY; y += g) {
        const odd = (((x / g) | 0) + ((y / g) | 0)) & 1;
        ctx.fillStyle = odd ? '#0c1428' : '#0a1020';
        ctx.fillRect(x, y, g, g);
      }
    }
  }

  _drawBorder(ctx) {
    ctx.save();
    ctx.lineWidth = 18;
    ctx.strokeStyle = 'rgba(120, 80, 220, 0.55)';
    ctx.shadowColor = '#7a4dff'; ctx.shadowBlur = 60;
    ctx.beginPath(); ctx.arc(0, 0, CONFIG.WORLD_RADIUS, 0, TAU); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(180,140,255,0.9)'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(0, 0, CONFIG.WORLD_RADIUS, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  _drawFood(ctx, food, cam) {
    const b = cam.visibleBounds();
    ctx.save();
    for (let i = 0; i < food.length; i++) {
      const f = food[i];
      if (f.x < b.minX - 40 || f.x > b.maxX + 40 || f.y < b.minY - 40 || f.y > b.maxY + 40) continue;
      const pulse = 1 + Math.sin(this.t * 0.004 + f.pulse) * 0.12;
      const r = f.r * pulse;
      if (f.kind === 'big' || f.kind === 'math') {
        ctx.shadowColor = f.color; ctx.shadowBlur = f.kind === 'math' ? 24 : 16;
      } else { ctx.shadowBlur = 0; }
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      // math orbs get a pulsing ring + "?" glyph
      if (f.kind === 'math') {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, r + 4 + Math.sin(this.t * 0.006) * 3, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#0a1020';
        ctx.font = `bold ${Math.round(r * 1.4)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('×', f.x, f.y + 1);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(f.x - r * 0.3, f.y - r * 0.3, r * 0.4, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawSnakes(ctx, world, cam) {
    const list = world.snakes.filter(s => s.alive).slice().sort((a, b) => a.score - b.score);
    for (let i = 0; i < list.length; i++) this._drawSnake(ctx, list[i], cam, world);
  }

  _drawSnake(ctx, s, cam, world) {
    if (s.points.length < 2) return;
    const r = s.radius;
    const step = Math.max(1, Math.floor(CONFIG.SEGMENT_SPACING / (r * 0.5)));
    const pts = s.points;
    const len = pts.length;

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // Outer tube
    ctx.beginPath();
    ctx.moveTo(pts[len - 1].x, pts[len - 1].y);
    for (let i = len - 1 - step; i >= 0; i -= step) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = r * 2;
    ctx.strokeStyle = (s.skin.body === 'rainbow') ? '#888' : s.skin.body;
    ctx.stroke();

    // Skin pattern segments
    for (let i = 0; i < len; i += step * 2) {
      const p = pts[i];
      drawSegment(ctx, s.skin, p.x, p.y, r, this.t, i);
    }

    // Boost / turbo glow
    if (s.boosting || s.isTurbo) {
      ctx.shadowColor = s.isTurbo ? '#7afff0' : ((s.skin.body === 'rainbow') ? '#fff' : s.skin.body);
      ctx.shadowBlur = s.isTurbo ? 32 : 22;
      ctx.lineWidth = r * (s.isTurbo ? 2.3 : 2.1);
      ctx.strokeStyle = s.isTurbo ? 'rgba(122,255,240,0.35)' : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(pts[len - 1].x, pts[len - 1].y);
      for (let i = len - 1 - step; i >= 0; i -= step) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    this._drawHead(ctx, s, cam, world);
  }

  _drawHead(ctx, s, cam, world) {
    const h = s.head;
    const r = s.radius;
    // Eyes follow the cursor / movement direction
    const lookA = this.input ? this.input.headingFrom(h) : s.heading;
    const lookDir = V2.fromAngle(lookA);
    const moveDir = V2.fromAngle(s.heading);
    // blend: eyes mostly point where you're steering
    const eyeDir = {
      x: moveDir.x * 0.5 + lookDir.x * 0.5,
      y: moveDir.y * 0.5 + lookDir.y * 0.5,
    };
    const eN = V2.norm(eyeDir);

    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.fillStyle = (s.skin.body === 'rainbow') ? '#9b59b6' : s.skin.body;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.08, r * 0.98, s.heading, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();

    // Eyes positioned perpendicular to heading, pupils track cursor
    const eyeR = r * 0.42;
    const ex = r * 0.42, ey = r * 0.55;
    // rotate eye positions by heading
    const cosH = Math.cos(s.heading), sinH = Math.sin(s.heading);
    const placeEye = (sx, sy) => ({ x: sx * cosH - sy * sinH, y: sx * sinH + sy * cosH });
    const e1 = placeEye(ex, -ey), e2 = placeEye(ex, ey);
    const pupilOff = eyeR * 0.35;
    for (const e of [e1, e2]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x, e.y, eyeR, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(e.x + eN.x * pupilOff, e.y + eN.y * pupilOff, eyeR * 0.5, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // Name above head
    const b = cam.visibleBounds();
    if (h.x < b.minX - 100 || h.x > b.maxX + 100 || h.y < b.minY - 100 || h.y > b.maxY + 100) return;
    ctx.save();
    ctx.translate(h.x, h.y - r - 16);
    ctx.scale(1 / cam.zoom, 1 / cam.zoom);
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(s.name, 0, 0);
    ctx.fillStyle = (world && s === world.player) ? '#ffe14d' : '#fff';
    ctx.fillText(s.name, 0, 0);
    ctx.restore();
  }

  _drawJoystick(input) {
    if (!input) return;
    const j = input.joystickDrawData && input.joystickDrawData();
    if (!j) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#b8a6ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(j.cx, j.cy, 70, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(140,110,255,0.25)';
    ctx.beginPath(); ctx.arc(j.cx, j.cy, 70, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#b8a6ff';
    ctx.beginPath(); ctx.arc(j.cx + j.dx, j.cy + j.dy, 28, 0, TAU); ctx.fill();
    ctx.restore();
  }

  _drawBoostButton(input) {
    if (!input || !isTouch()) return;
    if (input.boostBtn) return;
    const ctx = this.ctx;
    const cx = this.cam.width - 90, cy = this.cam.height - 90;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#7afff0';
    ctx.beginPath(); ctx.arc(cx, cy, 56, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡', cx, cy);
    ctx.restore();
  }

  drawMinimap(ctx, world, player, size) {
    const s = size;
    const cx = this.cam.width - s - 16;
    const cy = 16;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(8,12,24,0.85)';
    ctx.beginPath(); ctx.arc(cx + s / 2, cy + s / 2, s / 2 + 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(180,140,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx + s / 2, cy + s / 2, s / 2, 0, TAU); ctx.stroke();
    const scale = s / (CONFIG.WORLD_RADIUS * 2);
    for (let i = 0; i < world.snakes.length; i++) {
      const sn = world.snakes[i];
      if (!sn.alive) continue;
      const px = cx + s / 2 + sn.head.x * scale;
      const py = cy + s / 2 + sn.head.y * scale;
      ctx.fillStyle = sn === player ? '#ffe14d' : (sn.isBot ? '#7afff0' : '#fff');
      ctx.beginPath(); ctx.arc(px, py, sn === player ? 3.2 : 1.8, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}