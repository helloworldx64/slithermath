// Snake entity: head + body trail of points. Handles movement, boosting, turbo
// (from correct math answers), eating, and self/other collisions.
class Snake {
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.skin = opts.skin;
    this.isBot = !!opts.isBot;
    this.world = opts.world;
    this.color = this.skin.body === 'rainbow' ? '#9b59b6' : this.skin.body;
    this.head = opts.head || V2.zero();
    this.heading = opts.heading != null ? opts.heading : Math.random() * TAU;
    this.targetHeading = this.heading;
    this.speed = CONFIG.BASE_SPEED;
    this.boosting = false;
    this.turboUntil = 0;            // timestamp until which a turbo speed boost is active
    this.alive = true;
    this.score = CONFIG.START_SCORE;
    this.targetLength = CONFIG.START_LENGTH;
    this.points = [];
    const dir = V2.fromAngle(this.heading);
    for (let i = 0; i < this.targetLength * 4; i++) {
      this.points.push({ x: this.head.x - dir.x * i * CONFIG.SEGMENT_SPACING * 0.25,
                        y: this.head.y - dir.y * i * CONFIG.SEGMENT_SPACING * 0.25 });
    }
    this.deathTime = 0;
    this.invulnUntil = 0;
    this.foodEaten = 0;
  }

  get radius() {
    return Math.min(CONFIG.RADIUS_MAX,
      CONFIG.SEGMENT_BASE_R + this.score * CONFIG.RADIUS_PER_SCORE);
  }

  get isTurbo() { return performance.now() < this.turboUntil; }

  setTarget(heading) { this.targetHeading = heading; }

  // Activate a turbo boost (from a correct math answer)
  activateTurbo() {
    this.turboUntil = performance.now() + CONFIG.TURBO_DURATION_MS;
  }

  // Brief slow-down penalty (wrong answer)
  slowUntil = 0;
  activateSlow() { this.slowUntil = performance.now() + CONFIG.MATH_WRONG_PENALTY_MS; }

  update(dt) {
    if (!this.alive) return;
    this.heading = angleLerp(this.heading, this.targetHeading,
      Math.min(1, CONFIG.TURN_RATE * dt));

    let speedMult = 1;
    if (this.isTurbo) speedMult *= CONFIG.BOOST_TURBO_MULT;
    else if (performance.now() < this.slowUntil) speedMult *= 0.55;

    if (this.boosting && this.score > CONFIG.BOOST_MIN_SCORE) {
      this.score = Math.max(CONFIG.START_SCORE, this.score - CONFIG.BOOST_DRAIN_PER_SEC * dt);
      this.speed = CONFIG.BASE_SPEED * CONFIG.BOOST_SPEED_MULT * speedMult;
    } else {
      this.boosting = false;
      this.speed = CONFIG.BASE_SPEED * speedMult;
    }

    const dir = V2.fromAngle(this.heading);
    const sp = this.speed * dt;
    this.head.x += dir.x * sp;
    this.head.y += dir.y * sp;

    // World boundary (circular): keep inside
    const distC = Math.hypot(this.head.x, this.head.y);
    if (distC > CONFIG.WORLD_RADIUS - this.radius * 0.5) {
      const nx = this.head.x / (distC || 1), ny = this.head.y / (distC || 1);
      this.head.x -= nx * (distC - (CONFIG.WORLD_RADIUS - this.radius * 0.5));
      this.head.y -= ny * (distC - (CONFIG.WORLD_RADIUS - this.radius * 0.5));
      this.targetHeading = Math.atan2(-this.head.y, -this.head.x);
    }

    this.points.unshift({ x: this.head.x, y: this.head.y });
    const targetPointCount = Math.max(40, Math.floor(this.score * 2.2));
    if (this.points.length > targetPointCount + 8) this.points.length = targetPointCount + 8;
  }

  // Returns true if this snake's head hits a body segment of `other`.
  hitsBody(other, headR) {
    const otherR = other.radius * 0.78;
    const sumR = headR + otherR;
    const sumR2 = sumR * sumR;
    for (let i = 2; i < other.points.length; i += 2) {
      const p = other.points[i];
      const dx = p.x - this.head.x, dy = p.y - this.head.y;
      if (dx * dx + dy * dy < sumR2) return true;
    }
    return false;
  }

  eatFood(food) {
    const gain = food.value * CONFIG.LENGTH_PER_FOOD;
    this.score += gain;
    this.targetLength += gain * 0.6;
    this.foodEaten++;
  }

  kill() { this.alive = false; this.deathTime = performance.now(); }
}