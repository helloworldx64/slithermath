class MathEngine {
  constructor(account) {
    this.account = account;
    this.active = null;
    this.streak = 0;
    this.bestStreak = 0;
    this.session = { answered: 0, correct: 0, wrong: 0, xp: 0 };
    this.tableStats = this._loadTableStats();
    this.opStats = this._loadOpStats();
    this._nextQuestionAt = 0;
    this._difficulty = 0;
  }

  _loadTableStats() {
    const s = Store.get('mr_tableStats', null);
    if (s && typeof s === 'object') {
      for (let t = CONFIG.MATH_MIN_TABLE; t <= CONFIG.MATH_MAX_TABLE; t++) {
        if (!s[t]) s[t] = { seen: 0, correct: 0 };
      }
      return s;
    }
    const stats = {};
    for (let t = CONFIG.MATH_MIN_TABLE; t <= CONFIG.MATH_MAX_TABLE; t++) stats[t] = { seen: 0, correct: 0 };
    return stats;
  }

  _saveTableStats() { Store.set('mr_tableStats', this.tableStats); }

  _loadOpStats() {
    const ops = ['multiply', 'divide', 'missing', 'square', 'word'];
    const fresh = () => {
      const o = {};
      ops.forEach(op => o[op] = { seen: 0, correct: 0 });
      return o;
    };
    const s = Store.get('mr_opStats', null);
    if (s && typeof s === 'object') {
      const o = fresh();
      ops.forEach(op => {
        if (s[op]) o[op] = { seen: s[op].seen || 0, correct: s[op].correct || 0 };
      });
      return o;
    }
    return fresh();
  }

  _saveOpStats() { Store.set('mr_opStats', this.opStats); }

  _accOf(stat) {
    return stat && stat.seen > 0 ? stat.correct / stat.seen : 0.5;
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  _pickTable(difficulty) {
    const lo = CONFIG.MATH_MIN_TABLE, hi = CONFIG.MATH_MAX_TABLE;
    const entries = [];
    let total = 0;
    const sizeMix = clamp(difficulty / 8, 0, 1);
    for (let t = lo; t <= hi; t++) {
      const acc = this._accOf(this.tableStats[t]);
      const weakness = Math.max(0.2, 1.15 - acc);
      const sizePref = clamp(1 - (t - lo) / (hi - lo + 1), 0, 1);
      const sizeBias = lerp(sizePref, 1, sizeMix);
      const w = weakness * sizeBias;
      entries.push({ t, w }); total += w;
    }
    let r = Math.random() * total;
    for (const e of entries) { r -= e.w; if (r <= 0) return e.t; }
    return entries[0].t;
  }

  _pickOp(difficulty) {
    const allowed = [{ op: 'multiply', base: 1.0 }];
    if (difficulty >= 1.5) allowed.push({ op: 'divide', base: 0.45 });
    if (difficulty >= 3.0) allowed.push({ op: 'missing', base: 0.4 });
    if (difficulty >= 4.0) allowed.push({ op: 'square', base: 0.35 });
    if (difficulty >= 5.0) allowed.push({ op: 'word', base: 0.4 });
    const mix = clamp(difficulty / 9, 0, 1);
    const entries = [];
    let total = 0;
    for (const a of allowed) {
      const acc = this._accOf(this.opStats[a.op]);
      let w = a.base * Math.max(0.35, 1.1 - acc);
      if (a.op !== 'multiply') w *= (0.35 + mix * 0.9);
      entries.push({ op: a.op, w }); total += w;
    }
    let r = Math.random() * total;
    for (const e of entries) { r -= e.w; if (r <= 0) return e.op; }
    return 'multiply';
  }

  maybeAsk(playerScore, dt, force) {
    if (this.active) return null;
    if (!force && playerScore < this._nextQuestionAt) return null;
    const q = this._generate(playerScore);
    q.startedAt = performance.now();
    q.deadline = q.startedAt + q.timeLimit;
    this.active = q;
    return q;
  }

  _generate(playerScore) {
    const streakBoost = Math.min(this.streak, 12);
    const difficulty = clamp(
      (playerScore / 250) + (streakBoost * 0.7) + (this.session.correct * 0.12),
      0, 12
    );
    this._difficulty = difficulty;
    const table = this._pickTable(difficulty);
    const op = this._pickOp(difficulty);
    const bMax = clamp(4 + Math.floor(difficulty * 1.25), 4, CONFIG.MATH_MAX_TABLE);

    let q;
    if (op === 'multiply') q = this._makeMultiply(table, bMax);
    else if (op === 'divide') q = this._makeDivide(table, bMax);
    else if (op === 'missing') q = this._makeMissing(table, bMax);
    else if (op === 'square') q = this._makeSquare(table, bMax);
    else q = this._makeWord(table, bMax);

    q.table = table;
    q.op = op;
    if (!('prompt' in q)) q.prompt = null;
    q.key = `${q.a}x${q.b}-${op}-${performance.now()}`;
    q.timeLimit = this._timeLimitFor(op, difficulty);
    q.options = this._buildOptions(q, op);
    return q;
  }

  _makeMultiply(table, bMax) {
    let a = table;
    let b = randInt(2, bMax);
    if (chance(0.5)) { const t = a; a = b; b = t; }
    return { a, b, answer: a * b };
  }

  _makeDivide(table, bMax) {
    const b = table;
    const quotient = randInt(2, clamp(bMax, 2, CONFIG.MATH_MAX_TABLE));
    const dividend = b * quotient;
    return { a: dividend, b, answer: quotient };
  }

  _makeMissing(table, bMax) {
    const a = table;
    const missing = randInt(2, bMax);
    const product = a * missing;
    return { a, b: product, answer: missing, product, missingFactor: true };
  }

  _makeSquare(table, bMax) {
    let a = table;
    if (chance(0.4)) a = randInt(CONFIG.MATH_MIN_TABLE, Math.min(bMax, 10));
    a = clamp(a, 2, 10);
    return { a, b: a, answer: a * a };
  }

  _makeWord(table, bMax) {
    let groups, items;
    if (table <= 6) { groups = table; items = randInt(2, Math.min(bMax, 8)); }
    else { items = table; groups = randInt(2, 6); }
    const a = clamp(groups, 2, 6);
    const b = clamp(items, 2, 9);
    const answer = a * b;
    const templates = [
      `יש ${a} קופסאות, בכל אחת ${b} עטים. כמה עטים בסך הכל?`,
      `בכל מדף ${b} ספרים, ויש ${a} מדפים. כמה ספרים?`,
      `${a} ילדים, כל אחד מביא ${b} כדורים. כמה כדורים?`,
      `יש ${a} שקיות ובכל שקית ${b} סוכריות. כמה סוכריות?`,
      `${a} חבילות, בכל אחת ${b} קנים. כמה קנים?`,
      `${a} גינות, בכל גינה ${b} עצים. כמה עצים בסך הכל?`,
    ];
    return { a, b, answer, prompt: randPick(templates) };
  }

  _timeLimitFor(op, difficulty) {
    const base = CONFIG.MATH_TIME_LIMIT_MS || 9000;
    if (base <= 0) return Infinity;
    const d = clamp(difficulty / 10, 0, 1);
    const timeFactor = lerp(1.0, 0.65, d);
    let opFactor = 1.0;
    if (op === 'word') opFactor = 1.25;
    else if (op === 'divide' || op === 'missing') opFactor = 1.08;
    return Math.round(base * timeFactor * opFactor);
  }

  _buildOptions(q, op) {
    const answer = q.answer;
    const pool = new Set();
    const add = (v) => {
      if (Number.isFinite(v)) {
        const n = Math.round(v);
        if (n > 0 && n !== answer) pool.add(n);
      }
    };
    const a = q.a, b = q.b;

    if (op === 'multiply' || op === 'word' || op === 'square') {
      add(a * (b + 1)); add(a * (b - 1));
      add((a + 1) * b); add((a - 1) * b);
      add((a + 1) * (b - 1)); add((a - 1) * (b + 1));
      add(answer + a); add(answer - a);
      add(answer + b); add(answer - b);
      add(answer + 1); add(answer - 1);
      add(answer + 2); add(answer - 2);
    } else if (op === 'divide') {
      const quotient = answer, divisor = b, dividend = a;
      add(quotient + 1); add(quotient - 1);
      add(quotient + 2); add(quotient - 2);
      add(quotient + divisor); add(quotient - divisor);
      add(Math.round(dividend / (divisor + 1)));
      add(Math.round(dividend / (divisor - 1)));
      add(dividend - divisor * quotient + quotient);
    } else if (op === 'missing') {
      const mf = answer, known = a, product = q.product;
      add(mf + 1); add(mf - 1);
      add(mf + 2); add(mf - 2);
      add(mf + known); add(mf - known);
      add(known + 1); add(known - 1);
      add(Math.round(product / (mf + 1)) + 1);
      add(Math.round(product / (mf - 1 || 1)));
    }

    const spread = Math.max(3, Math.floor(answer * 0.25) + 2);
    let guard = 0;
    while (pool.size < 3 && guard < 80) {
      add(answer + randInt(-spread, spread));
      guard++;
    }
    const wrong = this._shuffle(Array.from(pool)).slice(0, 3);
    while (wrong.length < 3) {
      const cand = answer + randInt(-spread, spread);
      if (cand > 0 && cand !== answer && !wrong.includes(cand)) wrong.push(cand);
    }
    return this._shuffle([answer, wrong[0], wrong[1], wrong[2]]);
  }

  submit(picked, currentScore = 0) {
    if (!this.active) return { correct: false, gainedXp: 0, turbo: false };
    const q = this.active;
    const isCorrect = picked === q.answer;

    const ts = this.tableStats[q.table] || (this.tableStats[q.table] = { seen: 0, correct: 0 });
    ts.seen++; if (isCorrect) ts.correct++;
    const os = this.opStats[q.op] || (this.opStats[q.op] = { seen: 0, correct: 0 });
    os.seen++; if (isCorrect) os.correct++;
    this._saveTableStats();
    this._saveOpStats();

    this.session.answered++;
    let gainedXp = 0;
    let result;
    if (isCorrect) {
      this.session.correct++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const opBonus = (q.op === 'word') ? 15 : (q.op === 'square' || q.op === 'divide') ? 8 : 0;
      const diffBonus = Math.round(this._difficulty * 4);
      gainedXp = CONFIG.MATH_CORRECT_XP
        + CONFIG.MATH_STREAK_XP_BONUS * Math.min(this.streak, 10)
        + opBonus + diffBonus;
      this.session.xp += gainedXp;
      if (this.account) this.account.addXp(gainedXp);
      result = { correct: true, gainedXp, turbo: true };
    } else {
      this.session.wrong++;
      this.streak = 0;
      result = { correct: false, gainedXp: 0, turbo: false, penaltyMs: CONFIG.MATH_WRONG_PENALTY_MS };
    }
    this.active = null;
    this._nextQuestionAt = (currentScore || 0) + this._nextGap();
    return result;
  }

  _nextGap() {
    const base = CONFIG.MATH_WINDOW_BASE;
    const growth = CONFIG.MATH_WINDOW_GROWTH;
    const n = Math.min(this.session.answered, 14);
    const exp = n * 0.35;
    let gap = base * 0.5 * Math.pow(growth, exp);
    const streakFactor = 1 - Math.min(this.streak, 10) * 0.025;
    gap *= clamp(streakFactor, 0.7, 1);
    return Math.max(200, gap);
  }

  timeLeft() {
    if (!this.active) return 0;
    return Math.max(0, this.active.deadline - performance.now());
  }

  timeout(currentScore) {
    if (!this.active) return null;
    const q = this.active;
    const ts = this.tableStats[q.table] || (this.tableStats[q.table] = { seen: 0, correct: 0 });
    ts.seen++;
    const os = this.opStats[q.op] || (this.opStats[q.op] = { seen: 0, correct: 0 });
    os.seen++;
    this._saveTableStats();
    this._saveOpStats();
    this.session.answered++;
    this.session.wrong++;
    this.streak = 0;
    this.active = null;
    this._nextQuestionAt = (currentScore || 0) + this._nextGap();
    return { correct: false, gainedXp: 0, timeout: true, penaltyMs: CONFIG.MATH_WRONG_PENALTY_MS };
  }

  resetCooldown(currentScore) {
    this._nextQuestionAt = currentScore || 0;
    this.active = null;
  }
}