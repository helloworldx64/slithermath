// World simulation: spawns/maintains food + math orbs, runs snakes, handles
// collisions, respawns dead bots, drops food on death. Uses a spatial grid for
// food queries. Math orbs are spawned by the Game when a question is due.
class World {
  constructor(serverId) {
    this.serverId = serverId || 'il';
    this.snakes = [];
    this.food = [];
    this.foodGrid = new SpatialGrid(140);
    this.particles = new ParticleSystem();
    this.nextId = 1;
    this.player = null;
    this.events = []; // queue of {type, ...} for Game to consume (eat, death, etc.)
    this._spawnFoodInitial();
  }

  _randomSpawnPoint(margin) {
    margin = margin == null ? 400 : margin;
    const r = (CONFIG.WORLD_RADIUS - margin) * Math.sqrt(Math.random());
    const a = Math.random() * TAU;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  _safeSpawnPoint() {
    for (let tries = 0; tries < 24; tries++) {
      const p = this._randomSpawnPoint(600);
      let ok = true;
      for (let i = 0; i < this.snakes.length; i++) {
        const s = this.snakes[i];
        if (!s.alive) continue;
        for (let j = 0; j < s.points.length; j += 4) {
          const q = s.points[j];
          if (V2.distSq(p, q) < 120 * 120) { ok = false; break; }
        }
        if (!ok) break;
      }
      if (ok) return p;
    }
    return this._randomSpawnPoint(600);
  }

  _spawnFoodInitial() {
    for (let i = 0; i < CONFIG.FOOD_COUNT; i++) {
      const p = this._randomSpawnPoint(20);
      this.food.push(new Food(p.x, p.y));
    }
  }

  spawnPlayer(name, skin, startLength) {
    const p = this._safeSpawnPoint();
    const s = new Snake({
      id: this.nextId++, name: name || 'You', skin,
      isBot: false, world: this, head: p, heading: Math.random() * TAU,
    });
    const len = Math.max(0, Math.min(50000, startLength | 0));
    if (len > 1) {
      s.score = len; s.targetLength = len;
      const dir = V2.fromAngle(s.heading);
      s.points = [];
      const pts = Math.max(48, len * 2.2);
      for (let i = 0; i < pts; i++) {
        s.points.push({ x: s.head.x - dir.x * i * CONFIG.SEGMENT_SPACING * 0.25,
                        y: s.head.y - dir.y * i * CONFIG.SEGMENT_SPACING * 0.25 });
      }
    }
    s.invulnUntil = performance.now() + CONFIG.INVULN_MS;
    this.player = s;
    this.snakes.push(s);
    return s;
  }

  spawnBot(tier) {
    const p = this._safeSpawnPoint();
    const name = randPick(BOT_NAMES) + (Math.random() < 0.3 ? ('_' + randInt(1, 99)) : '');
    const skin = randPick(SKINS);
    const s = new Snake({
      id: this.nextId++, name, skin,
      isBot: true, world: this, head: p, heading: Math.random() * TAU,
    });
    s.ai = new BotAI(s, tier);
    s.invulnUntil = performance.now() + 1500;
    this.snakes.push(s);
    return s;
  }

  fillBots() {
    // Mix of difficulty tiers
    while (this.snakes.filter(s => s.isBot && s.alive).length < CONFIG.BOT_COUNT) {
      const r = Math.random();
      const tier = r < 0.5 ? 'normal' : r < 0.8 ? 'easy' : 'hard';
      this.spawnBot(tier);
    }
  }

  // Spawn a special math orb near the player for them to grab.
  spawnMathOrb(near) {
    const a = Math.random() * TAU;
    const d = randRange(220, 420);
    const x = clamp(near.x + Math.cos(a) * d, -CONFIG.WORLD_RADIUS + 200, CONFIG.WORLD_RADIUS - 200);
    const y = clamp(near.y + Math.sin(a) * d, -CONFIG.WORLD_RADIUS + 200, CONFIG.WORLD_RADIUS - 200);
    const orb = new Food(x, y, 10, 13, '#7afff0', 'math');
    this.food.push(orb);
    return orb;
  }

  update(dt) {
    for (let i = 0; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (!s.alive) continue;
      if (s.isBot && s.ai) s.ai.update(dt, this);
      s.update(dt);
    }

    // Build food grid each frame
    this.foodGrid.clear();
    for (let i = 0; i < this.food.length; i++) {
      const f = this.food[i];
      this.foodGrid.insert(f, f.x, f.y, f.r);
    }

    const dead = [];
    const now = performance.now();
    for (let i = 0; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (!s.alive) continue;
      const headR = s.radius;

      // Eat nearby food
      const near = this.foodGrid.query(s.head.x, s.head.y, headR + 24, []);
      for (let j = 0; j < near.length; j++) {
        const f = near[j].item;
        const d = V2.distSq(s.head, f);
        const reach = (headR + f.r) * 0.92;
        if (d < reach * reach) {
          s.eatFood(f);
          f._dead = true;
          // particles + event
          this.particles.burst(f.x, f.y, f.kind === 'big' ? 10 : 5, f.color, 180, 0.5, f.r * 0.8);
          this.events.push({ type: 'eat', snake: s, food: f });
          if (f.kind === 'math') this.events.push({ type: 'mathOrb', snake: s, food: f });
        }
      }

      // Body collisions — only other snakes kill you (slither.io rule)
      if (now >= (s.invulnUntil || 0)) {
        for (let k = 0; k < this.snakes.length; k++) {
          const o = this.snakes[k];
          if (!o.alive || o === s) continue;
          if (s.hitsBody(o, headR * 0.92)) { dead.push(s); break; }
        }
      }
    }

    for (let i = 0; i < dead.length; i++) {
      const s = dead[i];
      if (!s.alive) continue;
      s.kill();
      dropFoodFromSnake(this, s);
      this.particles.burst(s.head.x, s.head.y, 24, s.color, 280, 1.0, 4);
      this.events.push({ type: 'death', snake: s });
    }

    // Cull dead food
    for (let i = this.food.length - 1; i >= 0; i--) {
      if (this.food[i]._dead) this.food.splice(i, 1);
    }
    // Top up food
    while (this.food.length < CONFIG.FOOD_COUNT) {
      const p = this._randomSpawnPoint(20);
      this.food.push(new Food(p.x, p.y));
    }
    if (this.food.length > CONFIG.FOOD_COUNT * 1.6) this.food.length = CONFIG.FOOD_COUNT;

    // Cull dead bots immediately; keep dead player for the death screen
    for (let i = this.snakes.length - 1; i >= 0; i--) {
      const s = this.snakes[i];
      if (!s.alive && s.isBot) this.snakes.splice(i, 1);
      else if (!s.alive && !s.isBot && now - s.deathTime > 4000) this.snakes.splice(i, 1);
    }
    this.fillBots();
    this.particles.update(dt);
  }

  leaderboard(topN) {
    const alive = this.snakes.filter(s => s.alive);
    alive.sort((a, b) => b.score - a.score);
    return alive.slice(0, topN || CONFIG.LEADERBOARD_SIZE);
  }

  playerRank(p) {
    if (!p) return 0;
    // Include the player even if just died, so rank is meaningful on death
    const all = this.snakes.filter(s => s.alive || s === p);
    all.sort((a, b) => b.score - a.score);
    return all.indexOf(p) + 1;
  }

  drainEvents() { const e = this.events; this.events = []; return e; }
}