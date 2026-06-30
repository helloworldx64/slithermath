// Bot AI. Three difficulty tiers (easy/normal/hard) based on the bot's score
// relative to the player. Behaviour: seek food + math orbs, avoid walls, dodge
// other snakes' bodies, opportunistically cut off smaller snakes, occasional boost.
class BotAI {
  constructor(snake, tier) {
    this.snake = snake;
    this.tier = tier || 'normal';
    this.thinkTimer = Math.random() * 0.2;
    this.wanderAngle = Math.random() * TAU;
    this.aggression = tier === 'hard' ? randRange(0.6, 1.0)
                  : tier === 'easy' ? randRange(0.1, 0.35)
                  : randRange(0.25, 0.7);
    this.viewR = tier === 'hard' ? 850 : tier === 'easy' ? 480 : 700;
  }

  update(dt, world) {
    const s = this.snake;
    if (!s.alive) return;
    this.thinkTimer -= dt;
    if (this.thinkTimer > 0) return;
    this.thinkTimer = (this.tier === 'hard' ? 0.05 : 0.09) + Math.random() * 0.05;

    const head = s.head;
    let targetX = head.x, targetY = head.y;
    let bestScore = -Infinity;

    // 1. Seek food (+ math orbs are extra attractive)
    const food = world.foodGrid.query(head.x, head.y, this.viewR, []);
    for (let i = 0; i < food.length; i++) {
      const f = food[i].item;
      const d = V2.dist(head, f);
      const attractiveness = f.kind === 'math' ? f.value * 180 : f.value * 80;
      const score = attractiveness / (1 + d);
      if (score > bestScore) { bestScore = score; targetX = f.x; targetY = f.y; }
    }

    // 2. Avoid other snakes' bodies; cut off smaller ones
    const snakes = world.snakes;
    for (let i = 0; i < snakes.length; i++) {
      const o = snakes[i];
      if (o === s || !o.alive) continue;
      const d = V2.dist(head, o.head);
      if (d > 700) continue;
      for (let j = 2; j < o.points.length; j += 6) {
        const p = o.points[j];
        const pd = V2.dist(head, p);
        if (pd < 180 + s.radius + o.radius) {
          const away = V2.norm(V2.sub(head, p));
          const w = (1 - pd / 360) * 200;
          targetX += away.x * w; targetY += away.y * w;
        }
      }
      if (s.score > o.score * 1.15 && d < 420 && d > 60) {
        const ahead = V2.add(o.head, V2.scale(V2.fromAngle(o.heading), 90));
        const cutDir = V2.norm(V2.sub(ahead, head));
        targetX += cutDir.x * 120 * this.aggression;
        targetY += cutDir.y * 120 * this.aggression;
      }
    }

    // 3. Wall avoidance
    const distC = Math.hypot(head.x, head.y);
    if (distC > CONFIG.WORLD_RADIUS - 900) {
      const toCenter = V2.norm(V2.scale(head, -1));
      const urgency = (distC - (CONFIG.WORLD_RADIUS - 900)) / 900;
      targetX += toCenter.x * 800 * urgency;
      targetY += toCenter.y * 800 * urgency;
    }

    // 4. Wander noise
    this.wanderAngle += randRange(-0.4, 0.4);
    targetX += Math.cos(this.wanderAngle) * 40;
    targetY += Math.sin(this.wanderAngle) * 40;

    s.setTarget(Math.atan2(targetY - head.y, targetX - head.x));

    // 5. Occasional boost (hard bots boost more)
    const boostChance = this.tier === 'hard' ? 0.025 : this.tier === 'easy' ? 0.005 : 0.012;
    s.boosting = s.score > CONFIG.BOOST_MIN_SCORE + 20 && Math.random() < boostChance && bestScore > 40;
  }
}