// Global configuration for "כפל רויאל" (Multiplication Royale) — a Hebrew math-learning slither game.
const CONFIG = {
  WORLD_RADIUS: 14000,
  FOOD_COUNT: 6000,
  FOOD_MIN_R: 3.2,
  FOOD_MAX_R: 9.5,
  FOOD_BIG_R: 14,
  FOOD_BIG_CHANCE: 0.06,
  FOOD_SPACING: 55,

  // Snake growth / mass
  START_LENGTH: 8,
  START_SCORE: 10,
  SEGMENT_SPACING: 5.0,
  SEGMENT_BASE_R: 11,
  HEAD_RADIUS_BASE: 11,
  RADIUS_PER_SCORE: 0.0065,
  RADIUS_MAX: 33,
  LENGTH_PER_FOOD: 8.5,
  BOOST_DRAIN_PER_SEC: 14,
  BOOST_MIN_SCORE: 30,
  BOOST_SPEED_MULT: 2.18,
  BASE_SPEED: 210,
  TURN_RATE: 7.6,
  BOOST_TURBO_MULT: 2.6,        // extra speed from answered-correctly turbo
  TURBO_DURATION_MS: 2600,      // turbo boost after correct answer

  // Bots
  BOT_COUNT: 24,

  // Math / progression
  MATH_MIN_TABLE: 2,
  MATH_MAX_TABLE: 10,
  MATH_TIME_LIMIT_MS: 9000,     // per-question timer; 0 = disabled
  MATH_CORRECT_XP: 50,
  MATH_STREAK_XP_BONUS: 12,     // extra XP per streak level
  MATH_WRONG_PENALTY_MS: 1400,  // brief slow on wrong answer
  MATH_WINDOW_FRAMES: 8,        // how often to show a question (scaled by score)
  MATH_WINDOW_BASE: 1100,       // base score before first question
  MATH_WINDOW_GROWTH: 1.55,     // each next question requires this factor more score

  // Servers (simulated zones)
  SERVERS: [
    { id: 'eu', name: 'אירופה', ping: 28 },
    { id: 'na', name: 'אמריקה', ping: 96 },
    { id: 'as', name: 'אסיה', ping: 142 },
    { id: 'il', name: 'ישראל', ping: 12 },
  ],

  // Camera
  CAMERA_LERP: 0.14,
  ZOOM_BASE: 1.0,
  ZOOM_MIN: 0.62,
  ZOOM_MAX: 1.32,
  ZOOM_TARGET_PER_RADIUS: 0.055,

  // Rendering
  BG_GRID: 64,
  FPS_TARGET: 60,
  PARTICLE_MAX: 700,

  // Misc
  RESPAWN_DELAY_MS: 1200,
  LEADERBOARD_SIZE: 10,
  INVULN_MS: 2200,
};

// Hebrew UI strings (RTL)
const I18N = {
  title: 'כפל רויאל',
  subtitle: 'תרגול כפל בסגנון משחק אקשן',
  play: 'שחק',
  playAgain: 'שחק שוב',
  changeSkin: 'החלף עיצוב',
  nickname: 'כינוי',
  spawnLength: 'אורך התחלתי (0 = ברירת מחדל)',
  chooseSkin: 'בחר עיצוב',
  score: 'ניקוד',
  length: 'אורך',
  rank: 'מקום',
  leaderboard: 'טבלת מובילים',
  finalScore: 'ניקוד סופי',
  youDied: 'נהרגת!',
  level: 'רמה',
  xp: 'נקודות',
  streak: 'רצף',
  combo: 'קומבו',
  server: 'שרת',
  settings: 'הגדרות',
  sound: 'צליל',
  music: 'מוזיקה',
  back: 'חזרה',
  shop: 'חנות עיצובים',
  locked: 'נעול',
  unlockAt: 'נפתח ברמה',
  stats: 'סטטיסטיקה',
  totalGames: 'משחקים',
  totalCorrect: 'תשובות נכונות',
  totalFood: 'אוכל נאכל',
  bestScore: 'ניקוד שיא',
  bestRank: 'מקום שיא',
  accuracy: 'דיוק',
  tutorial: 'איך משחקים',
  tutorialMove: 'גרור כדי לנווט · לחץ לדש',
  tutorialMath: 'פתח תיבת כפל כדורית · ענה נכון לטורבו',
  tutorialEat: 'אכול כדורים כדי לגדול',
  tutorialAvoid: 'אל תפגע בנחשים אחרים!',
  correct: 'נכון! +',
  wrong: 'טעות',
  timeUp: 'נגמר הזמן',
  turbo: 'טורבו!',
  pause: 'השהה',
  resume: 'המשך',
  quit: 'יציאה',
  answer: 'ענה',
  loading: 'טוען...',
  connecting: 'מתחבר לשרת',
};