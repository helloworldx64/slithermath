// Account & progression system. Persists to localStorage: nickname, XP, level,
// unlocked skins, lifetime stats, settings. XP comes from correct math answers
// and from game score. Levels unlock new skins (see skins.js).
class Account {
  constructor() {
    this.data = this._load();
  }

  _load() {
    const d = Store.get('mr_account', null);
    if (d && typeof d === 'object') return Object.assign(this._defaults(), d);
    return this._defaults();
  }
  _defaults() {
    return {
      nickname: 'שחקן',
      xp: 0,
      level: 1,
      selectedSkin: 0,
      unlockedSkins: [0],          // skin index 0 (starter) unlocked by default
      server: 'il',
      stats: {
        games: 0,
        correct: 0,
        wrong: 0,
        foodEaten: 0,
        bestScore: 0,
        bestRank: 9999,
        bestStreak: 0,
        totalLength: 0,
      },
    };
  }

  save() { Store.set('mr_account', this.data); }

  get name() { return this.data.nickname; }
  set name(v) { this.data.nickname = (v || 'שחקן').slice(0, 16); this.save(); }
  get xp() { return this.data.xp; }
  get level() { return this.data.level; }
  get selectedSkin() { return this.data.selectedSkin; }
  get server() { return this.data.server; }
  set server(id) { this.data.server = id; this.save(); }
  get stats() { return this.data.stats; }
  isUnlocked(skinIdx) { return this.data.unlockedSkins.includes(skinIdx); }

  selectSkin(skinIdx) {
    if (!this.isUnlocked(skinIdx)) return false;
    this.data.selectedSkin = skinIdx;
    this.save();
    return true;
  }

  // XP curve: each level needs level*250 XP. Returns {leveledUp, toNext}
  addXp(amount) {
    this.data.xp += amount;
    let leveledUp = false;
    const need = () => this.data.level * 250;
    while (this.data.xp >= need()) {
      this.data.xp -= need();
      this.data.level++;
      leveledUp = true;
      this._checkSkinUnlocks();
    }
    this.save();
    return { leveledUp, level: this.data.level };
  }

  _checkSkinUnlocks() {
    // Unlock any skin whose required level we just reached
    let newlyUnlocked = [];
    SKINS.forEach((s, i) => {
      if (!this.isUnlocked(i) && this.data.level >= (s.unlock || 1)) {
        this.data.unlockedSkins.push(i);
        newlyUnlocked.push(i);
      }
    });
    return newlyUnlocked;
  }

  // Called at end of a game with the run's results
  recordGame(score, rank, length, foodEaten, correct, wrong, bestStreak) {
    const s = this.data.stats;
    s.games++;
    s.foodEaten += foodEaten;
    s.correct += correct;
    s.wrong += wrong;
    s.totalLength += length;
    if (score > s.bestScore) s.bestScore = score;
    if (rank < s.bestRank) s.bestRank = rank;
    if (bestStreak > s.bestStreak) s.bestStreak = bestStreak;
    // score also grants a little XP so non-math progress still advances
    this.addXp(Math.floor(score * 0.5));
    this.save();
  }

  xpToNext() { return this.data.level * 250 - this.data.xp; }
  xpProgress() { return this.data.xp / (this.data.level * 250); }
}