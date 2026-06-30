// Food pellet. Two kinds:
//  - normal: small colorful pellet, value 1-3
//  - big/golden: larger glowing orb, value 6-12, worth way more mass
//  - math orb: spawns when a question is pending — eating it opens a question
class Food {
  constructor(x, y, value, r, color, kind) {
    this.x = x; this.y = y;
    const big = !r && !kind && Math.random() < CONFIG.FOOD_BIG_CHANCE;
    this.kind = kind || (big ? 'big' : 'normal');
    this.r = r || (big ? randRange(CONFIG.FOOD_MAX_R, CONFIG.FOOD_BIG_R)
                        : randRange(CONFIG.FOOD_MIN_R, CONFIG.FOOD_MAX_R));
    this.value = value || (big ? randRange(6, 12) : randRange(1, 3));
    this.color = color || (this.kind === 'big' ? '#ffe14d' : (this.kind === 'math' ? '#7afff0' : randPick(FOOD_COLORS)));
    this.pulse = Math.random() * TAU;
    this.spawnTime = performance.now();
  }
}

const FOOD_COLORS = [
  '#ff5fbf', '#5b9bff', '#5cff8d', '#ffd166', '#ff8a5b',
  '#b388ff', '#7afff0', '#ff7676', '#fff48f', '#9effa3',
  '#ff4d4d', '#4dd2ff', '#ffe14d', '#c7a4ff', '#a0ff8a',
];

// Drops a ring of food from a dead snake, color matching the snake's body.
function dropFoodFromSnake(world, snake) {
  const skin = snake.skin;
  const color = (skin.body && skin.body[0] !== 'r') ? skin.body : '#ff5fbf';
  const step = 5;
  for (let i = 0; i < snake.points.length; i += step) {
    const p = snake.points[i];
    const n = randInt(2, 4);
    for (let j = 0; j < n; j++) {
      const a = Math.random() * TAU;
      const d = randRange(0, snake.radius * 1.4);
      const val = 2 + (snake.score / snake.points.length) * 0.5;
      world.food.push(new Food(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d,
        Math.min(8, Math.max(2, val)),
        randRange(CONFIG.FOOD_MIN_R, CONFIG.FOOD_MAX_R + 1),
        color));
    }
  }
}