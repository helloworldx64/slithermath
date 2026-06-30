// Math engine: generates multiplication questions from the times tables,
// adapts difficulty based on the player's accuracy and streak, and tracks
// per-session stats. Designed for kids learning לוח הכפל (multiplication tables).
class MathEngine {
  constructor(account) {
    this.account = account;
    this.active = null;        // current question object
    this.streak = 0;           // consecutive correct
    this.bestStreak = 0;
    this.session = { answered: 0, correct: 0, wrong: 0, xp: 0 };
    // Per-table accuracy tracking for adaptive difficulty (2..10)
    this.tableStats = this._loadTableStats();
    this._nextQuestionAt = 0;  // score threshold before a question appears
  }

  _loadTableStats() {
    const s = Store.get('mr_tableStats', null);
    if (s) return s;
    const stats = {};
    for (let t = CONFIG.MATH_MIN_TABLE; t <= CONFIG.MATH_MAX_TABLE; t++) stats[t] = { seen: 0, correct: 0 };
    return stats;
  }

  _saveTableStats() { Store.set('mr_tableStats', this.tableStats); }

  // Pick a table weighted toward ones the player gets wrong more often (drill weaknesses),
  // but occasionally surface easy ones for confidence.
  _pickTable() {
    const tables = [];
    let totalWeight = 0;
    for (let t = CONFIG.MATH_MIN_TABLE; t <= CONFIG.MATH_MAX_TABLE; t++) {
      const s = this.tableStats[t];
      const acc = s.seen > 0 ? s.correct / s.seen : 0.5;
      // weight = higher for lower accuracy (drill weak spots), with a floor so easy ones still appear
      const w = Math.max(0.25, 1.1 - acc);
      tables.push({ t, w }); totalWeight += w;
    }
    let r = Math.random() * totalWeight;
    for (const e of tables) { r -= e.w; if (r <= 0) return e.t; }
    return tables[0].t;
  }

  // Generates a question. Difficulty rises with player score & current streak.
  // Returns { a, b, answer, options:[4 ints], table, key } or null if on cooldown.
  maybeAsk(playerScore, dt, force) {
    if (this.active) return null;
    // cooldown: next question appears after the player gains a chunk of score
    if (playerScore < this._nextQuestionAt && !force) return null;
    this.active = this._generate(playerScore);
    this.active.startedAt = performance.now();
    this.active.deadline = this.active.startedAt + CONFIG.MATH_TIME_LIMIT_MS;
    return this.active;
  }

  _generate(playerScore) {
    // Adaptive: harder tables & bigger multipliers as score/streak grow.
    const streakBoost = Math.min(this.streak, 8);
    const difficulty = clamp((playerScore / 400) + (streakBoost * 0.5), 0, 10);
    let table = this._pickTable();
    // Once you're doing well, mix random tables (full times-table review)
    if (difficulty > 4 && chance(0.35)) table = randInt(CONFIG.MATH_MIN_TABLE, CONFIG.MATH_MAX_TABLE);

    let a = table;
    let bMax = clamp(5 + Math.floor(difficulty), 5, CONFIG.MATH_MAX_TABLE);
    let b = randInt(2, bMax);
    if (chance(0.5)) { const t = a; a = b; b = t; } // commutative variety

    const answer = a * b;
    // Distractors: near-miss common mistakes
    const options = new Set([answer]);
    const addDistractor = (v) => {
      if (v > 0 && v !== answer && !options.has(v)) options.add(v);
    };
    addDistractor(answer + a);          // forgot to carry / off-by-one row
    addDistractor(answer - b);
    addDistractor(answer + b);
    addDistractor(a * (b + 1));         // next row up
    addDistractor((a + 1) * b);
    addDistractor(answer + randInt(1, 5));
    while (options.size < 4) addDistractor(answer + randInt(-12, 12));
    const optArr = Array.from(options).slice(0, 4);
    // shuffle
    for (let i = optArr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [optArr[i], optArr[j]] = [optArr[j], optArr[i]];
    }
    return { a, b, answer, options: optArr, table, key: `${a}x${b}-${performance.now()}` };
  }

  // Submit an answer. Returns { correct, gainedXp, turbo }.
  submit(picked) {
    if (!this.active) return { correct: false, gainedXp: 0 };
    const q = this.active;
    const isCorrect = picked === q.answer;
    const t = this.tableStats[q.table] || { seen: 0, correct: 0 };
    t.seen++; if (isCorrect) t.correct++;
    this.tableStats[q.table] = t;
    this._saveTableStats();

    this.session.answered++;
    let gainedXp = 0;
    if (isCorrect) {
      this.session.correct++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      gainedXp = CONFIG.MATH_CORRECT_XP + CONFIG.MATH_STREAK_XP_BONUS * Math.min(this.streak, 10);
      this.session.xp += gainedXp;
      if (this.account) this.account.addXp(gainedXp);
    } else {
      this.session.wrong++;
      this.streak = 0;
    }
    const result = { correct: isCorrect, gainedXp, turbo: isCorrect };
    this.active = null;
    // schedule next question: requires more score growth
    this._nextQuestionAt = (arguments[1] || 0) + this._nextGap();
    return result;
  }

  _nextGap() {
    // each question requires ~+60% more score than the last, so they space out as you grow
    return CONFIG.MATH_WINDOW_BASE * Math.pow(CONFIG.MATH_WINDOW_GROWTH, Math.min(this.session.answered, 12));
  }

  timeLeft() {
    if (!this.active) return 0;
    return Math.max(0, this.active.deadline - performance.now());
  }

  // Called when the timer runs out (counts as wrong, no XP).
  timeout(currentScore) {
    if (!this.active) return null;
    this.session.answered++;
    this.session.wrong++;
    this.streak = 0;
    const t = this.tableStats[this.active.table] || { seen: 0, correct: 0 };
    t.seen++;
    this.tableStats[this.active.table] = t;
    this._saveTableStats();
    this.active = null;
    this._nextQuestionAt = currentScore + this._nextGap();
    return { correct: false, gainedXp: 0, timeout: true };
  }

  // Force a fresh question after respawn (ignores cooldown)
  resetCooldown(currentScore) {
    this._nextQuestionAt = currentScore;
    this.active = null;
  }
}