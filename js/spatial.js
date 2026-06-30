// Spatial hash grid for broad-phase food/collision queries.
class SpatialGrid {
  constructor(cell) { this.cell = cell; this.cells = new Map(); }
  _key(x, y) { return ((x / this.cell) | 0) + ':' + ((y / this.cell) | 0); }
  clear() { this.cells.clear(); }
  insert(item, x, y, r) {
    const k = this._key(x, y);
    let bucket = this.cells.get(k);
    if (!bucket) { bucket = []; this.cells.set(k, bucket); }
    bucket.push({ item, x, y, r });
  }
  query(x, y, r, out) {
    out = out || [];
    const minx = ((x - r) / this.cell) | 0;
    const maxx = ((x + r) / this.cell) | 0;
    const miny = ((y - r) / this.cell) | 0;
    const maxy = ((y + r) / this.cell) | 0;
    for (let cx = minx; cx <= maxx; cx++) {
      for (let cy = miny; cy <= maxy; cy++) {
        const bucket = this.cells.get(cx + ':' + cy);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
      }
    }
    return out;
  }
}

// Lightweight particle pool for eat bursts, death explosions, turbo trails.
class ParticleSystem {
  constructor(max) {
    this.max = max || CONFIG.PARTICLE_MAX;
    this.pool = [];
    for (let i = 0; i < this.max; i++) {
      this.pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, r: 1, color: '#fff' });
    }
  }
  spawn(x, y, vx, vy, life, r, color) {
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
        p.life = life; p.maxLife = life; p.r = r; p.color = color;
        return;
      }
    }
  }
  burst(x, y, count, color, speed, life, r) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = randRange(speed * 0.3, speed);
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, life * randRange(0.6, 1.1), r * randRange(0.6, 1.2), color);
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
    }
  }
  draw(ctx, cam) {
    const b = cam.visibleBounds();
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      if (p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY) continue;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}