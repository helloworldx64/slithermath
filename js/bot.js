// Bot AI — three difficulty tiers (easy / normal / hard).
// Behaviour priorities (high -> low):
//   1. Stay alive (dodge ALL nearby snake bodies + world wall)
//   2. Cut off smaller snakes for an aggressive kill (hard tier)
//   3. Seek the highest-value nearby food (math/big orbs prioritised)
//   4. Wander to explore when nothing interesting is nearby
// Hard bots think fast, see far, predict prey paths, and boost aggressively.
// Easy bots are sluggish, near-sighted, passive and rarely boost.
class BotAI {
  constructor(snake, tier) {
    this.snake = snake;
    this.tier = tier || 'normal';
    this.thinkTimer = Math.random() * 0.15;
    this.wanderAngle = Math.random() * TAU;
    // Per-tier tuning table.
    const T = BotAI.TIERS[this.tier] || BotAI.TIERS.normal;
    this.viewR = t_value(T.viewR);
    this.aggression = t_value(T.aggressionLo, T.aggressionHi);
    this.reaction = T.reaction;          // think interval (s)
    this.boostChance = T.boostChance;     // base per-think boost probability
    this.dangerR = T.dangerR;             // how far away body segments start pushing
    this.repelW = T.repelW;               // repulsion strength
    this.wallMargin = T.wallMargin;       // start turning before the wall
    this.wallW = T.wallW;                  // wall steering strength
    this.cutLookahead = T.cutLookahead;   // frames ahead for cut-off prediction
    this.cutR = T.cutR;                    // max range to attempt a cut-off
    this.huntPlayerBias = T.huntPlayerBias;
    this.boostWorth = T.boostWorth;        // min food score to justify a boost
  }

  update(dt, world) {
    const s = this.snake;
    if (!s.alive) return;
    // Throttled "thinking": cheaper than every-frame, still reactive for hard.
    this.thinkTimer -= dt;
    if (this.thinkTimer > 0) return;
    this.thinkTimer = this.reaction + Math.random() * 0.02;

    const head = s.head;
    const r = s.radius;

    // Accumulator steering vector (desired direction we want to head in).
    let ax = 0, ay = 0;

    // 1. FOOD SEEKING — pick the highest "value/distance" orb in view.
    const foodTarget = this._seekFood(head, world);
    if (foodTarget) {
      ax += foodTarget.dx * foodTarget.w;
      ay += foodTarget.dy * foodTarget.w;
    }

    // 2. DANGER AVOIDANCE — sum repulsion from ALL nearby snakes' bodies.
    let danger = 0;
    const rep = this._bodyRepulsion(head, r, world);
    if (rep) {
      ax += rep.x * this.repelW;
      ay += rep.y * this.repelW;
      danger = rep.danger;
    }

    // 3. CUT-OFF / HUNTING — hard bots actively intercept smaller prey.
    const prey = this._huntPrey(head, r, world);
    if (prey) {
      ax += prey.dx * prey.w;
      ay += prey.dy * prey.w;
    }

    // 4. WALL AVOIDANCE — strong pull to the centre near the border.
    const wall = this._wallSteer(head);
    if (wall) {
      ax += wall.x * this.wallW;
      ay += wall.y * this.wallW;
      danger = Math.max(danger, wall.danger);
    }

    // 5. WANDER — small noise so idle bots still explore for food.
    this.wanderAngle += randRange(-0.5, 0.5);
    ax += Math.cos(this.wanderAngle) * 30;
    ay += Math.sin(this.wanderAngle) * 30;

    // If every accumulator is zero, keep flying straight.
    if (ax === 0 && ay === 0) {
      s.setTarget(s.heading);
    } else {
      s.setTarget(Math.atan2(ay, ax));
    }

    // 6. BOOST — smart: only boost when it pays off and we can afford it.
    s.boosting = this._shouldBoost(s, foodTarget, danger, prey);
  }

  // --- Food seeking -------------------------------------------------------
  // Returns {dx, dy, w} pointing toward the best orb, or null.
  _seekFood(head, world) {
    const out = world.foodGrid.query(head.x, head.y, this.viewR, []);
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < out.length; i++) {
      const f = out[i].item;
      const d = Math.hypot(f.x - head.x, f.y - head.y);
      if (d < 1) continue;
      // Value weighting: math orbs and big orbs are worth far more mass.
      let val = f.value;
      if (f.kind === 'math') val *= 22;
      else if (f.kind === 'big') val *= 8;
      const score = val * this.viewR / (1 + d * 0.5);
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    if (!best) return null;
    const dx = best.x - head.x, dy = best.y - head.y;
    const l = Math.hypot(dx, dy) || 1;
    // Closer + higher value = stronger pull.
    const w = clamp(bestScore / 60, 0.5, 3.0);
    return { dx: dx / l, dy: dy / l, w, score: bestScore, food: best, dist: l };
  }

  // --- Body repulsion -----------------------------------------------------
  // Sums a unit repulsion away from every dangerous segment of every other
  // snake. Hard bots react further out; easy bots only when very close.
  _bodyRepulsion(head, r, world) {
    let rx = 0, ry = 0, danger = 0;
    const snakes = world.snakes;
    const reach = this.dangerR + r;
    for (let i = 0; i < snakes.length; i++) {
      const o = snakes[i];
      if (o === this.snake || !o.alive) continue;
      const oR = o.radius;
      // Skip distant snakes entirely (broad cull by head distance).
      if (V2.distSq(head, o.head) > (reach + 600) * (reach + 600)) continue;
      const pts = o.points;
      const step = oR > 22 ? 2 : 4;       // sample more densely for big bodies
      for (let j = 2; j < pts.length; j += step) {
        const p = pts[j];
        const dx = head.x - p.x, dy = head.y - p.y;
        const d2 = dx * dx + dy * dy;
        const safe = reach + oR;
        if (d2 >= safe * safe) continue;
        const d = Math.sqrt(d2) || 1;
        // Closer segments push harder; weight falls off with distance.
        const closeness = 1 - d / safe;
        const w = closeness * closeness * 2.2;
        rx += (dx / d) * w;
        ry += (dy / d) * w;
        danger = Math.max(danger, closeness);
        // Head-on head collision is the deadliest — extra shove from the head.
        if (j < 4) {
          const hdx = head.x - o.head.x, hdy = head.y - o.head.y;
          const hd = Math.hypot(hdx, hdy) || 1;
          if (hd < safe) {
            const hw = (1 - hd / safe) * 3.0;
            rx += (hdx / hd) * hw;
            ry += (hdy / hd) * hw;
            danger = Math.max(danger, 1 - hd / safe);
          }
        }
      }
    }
    if (rx === 0 && ry === 0) return null;
    const l = Math.hypot(rx, ry) || 1;
    return { x: rx / l, y: ry / l, danger };
  }

  // --- Cut-off / hunting --------------------------------------------------
  // Predicts where smaller snakes (or the player) are heading and steers to
  // intercept. Aborts if the intercept point is unsafe.
  _huntPrey(head, r, world) {
    if (this.aggression < 0.2) return null; // easy bots don't bother
    const snakes = world.snakes;
    let best = null, bestW = 0;
    const myScore = this.snake.score;
    for (let i = 0; i < snakes.length; i++) {
      const o = snakes[i];
      if (o === this.snake || !o.alive) continue;
      const d = V2.dist(head, o.head);
      if (d > this.cutR) continue;
      // Only hunt snakes we are clearly bigger than.
      if (myScore < o.score * 1.25) continue;
      // Player gets extra attention from hard bots.
      const isPlayer = (o === world.player);
      const bias = (isPlayer ? this.huntPlayerBias : 1.0);
      if (isPlayer && this.aggression < 0.5) continue;
      // Predict the target's future head position.
      const hv = V2.fromAngle(o.heading);
      const ahead = {
        x: o.head.x + hv.x * this.cutLookahead,
        y: o.head.y + hv.y * this.cutLookahead,
      };
      // Self-preservation: abort if intercept point is near a wall or a big body.
      if (Math.hypot(ahead.x, ahead.y) > CONFIG.WORLD_RADIUS - 300) continue;
      if (this._pointUnsafe(ahead, r, world, o)) continue;
      const dx = ahead.x - head.x, dy = ahead.y - head.y;
      const l = Math.hypot(dx, dy) || 1;
      const w = (this.aggression * bias) * (1 - d / this.cutR) * 2.4;
      if (w > bestW) { bestW = w; best = { dx: dx / l, dy: dy / l, w, prey: o }; }
    }
    return best;
  }

  // Checks whether a candidate point is too close to any other snake's body.
  _pointUnsafe(p, r, world, ignore) {
    const snakes = world.snakes;
    const safe = 70 + r;
    for (let i = 0; i < snakes.length; i++) {
      const o = snakes[i];
      if (o === this.snake || o === ignore || !o.alive) continue;
      if (V2.distSq(p, o.head) > 600 * 600) continue;
      const pts = o.points;
      for (let j = 2; j < pts.length; j += 4) {
        const q = pts[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        if (dx * dx + dy * dy < safe * safe) return true;
      }
    }
    return false;
  }

  // --- Wall avoidance -----------------------------------------------------
  _wallSteer(head) {
    const distC = Math.hypot(head.x, head.y);
    const margin = this.wallMargin;
    const limit = CONFIG.WORLD_RADIUS - margin;
    if (distC < limit) return null;
    const urgency = clamp((distC - limit) / margin, 0, 1.4);
    // Pull toward centre.
    const nx = -head.x / (distC || 1), ny = -head.y / (distC || 1);
    return { x: nx, y: ny, danger: urgency };
  }

  // --- Boost logic --------------------------------------------------------
  // Boost when chasing a high-value orb or fleeing danger, but only if we can
  // afford the score drain and aren't already in turbo.
  _shouldBoost(s, foodTarget, danger, prey) {
    if (s.isTurbo) return false;
    if (s.score <= CONFIG.BOOST_MIN_SCORE + 25) return false;
    // Always boost to escape imminent death.
    if (danger > 0.55) return true;
    // Boost toward a very valuable food orb if it's a short sprint.
    if (foodTarget && foodTarget.score >= this.boostWorth && foodTarget.dist < this.viewR * 0.55) {
      if (chance(this.boostChance * 4)) return true;
    }
    // Hard bots boost to close a cut-off on a smaller prey.
    if (prey && this.tier === 'hard' && chance(this.boostChance * 2)) return true;
    // Idle occasional boost for hard bots only.
    return this.tier === 'hard' && chance(this.boostChance * 0.25);
  }
}

// ---- Per-tier configuration ----------------------------------------------
// t_value picks a value or random-in-range from the table entries.
function t_value() {
  const a = arguments[0];
  if (a && typeof a === 'object' && a.lo != null) return randRange(a.lo, a.hi);
  if (arguments.length > 1) return randRange(arguments[0], arguments[1]);
  return a;
}

BotAI.TIERS = {
  easy: {
    viewR: 450,
    aggressionLo: 0.10, aggressionHi: 0.20,
    reaction: 0.14,
    boostChance: 0.012,
    dangerR: 130,
    repelW: 110,
    wallMargin: 1100, wallW: 420,
    cutLookahead: 0, cutR: 0,
    huntPlayerBias: 0.5,
    boostWorth: 400,
  },
  normal: {
    viewR: 700,
    aggressionLo: 0.30, aggressionHi: 0.50,
    reaction: 0.08,
    boostChance: 0.025,
    dangerR: 190,
    repelW: 170,
    wallMargin: 950, wallW: 600,
    cutLookahead: 70, cutR: 420,
    huntPlayerBias: 0.8,
    boostWorth: 250,
  },
  hard: {
    viewR: 900,
    aggressionLo: 0.70, aggressionHi: 0.95,
    reaction: 0.04,
    boostChance: 0.055,
    dangerR: 250,
    repelW: 230,
    wallMargin: 820, wallW: 850,
    cutLookahead: 130, cutR: 640,
    huntPlayerBias: 1.25,
    boostWorth: 150,
  },
};