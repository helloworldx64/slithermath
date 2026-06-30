// UI controller: Hebrew RTL menu, server picker, skin shop with unlocks,
// stats screen, settings, in-game HUD (score/length/level/streak/leaderboard),
// math question overlay, pause, and death screen.
const UI = {
  el: {},
  account: null,
  onPlay: null,
  onRespawn: null,
  onQuit: null,
  onAnswer: null,
  onToggleSound: null,
  onToggleMusic: null,
  onPause: null,
  onResume: null,

  init(account) {
    this.account = account;
    this.el = {
      menu: document.getElementById('menu'),
      hud: document.getElementById('hud'),
      dead: document.getElementById('dead'),
      shop: document.getElementById('shop'),
      stats: document.getElementById('statsScreen'),
      settings: document.getElementById('settings'),
      pause: document.getElementById('pause'),
      math: document.getElementById('mathOverlay'),
      loading: document.getElementById('loading'),
    };
    this._buildSkinPicker();
    this._buildServerPicker();
    this._buildStats();
    this._buildSettings();
    this._wireButtons();
    this._updateProfile();
  },

  show(id) { if (this.el[id]) this.el[id].classList.remove('hidden'); },
  hide(id) { if (this.el[id]) this.el[id].classList.add('hidden'); },

  // ---- Profile bar (level + XP) ----
  _updateProfile() {
    const a = this.account;
    const lvlEl = document.getElementById('profileLevel');
    const xpEl = document.getElementById('profileXp');
    const barEl = document.getElementById('profileBar');
    if (lvlEl) lvlEl.textContent = a.level;
    if (xpEl) xpEl.textContent = `${fmtNum(a.xp)} / ${fmtNum(a.level * 250)}`;
    if (barEl) barEl.style.width = (a.xpProgress() * 100).toFixed(1) + '%';
  },

  // ---- Skin picker (menu) + Shop ----
  _buildSkinPicker() {
    const grid = document.getElementById('skins');
    if (!grid) return;
    grid.innerHTML = '';
    SKINS.forEach((skin, idx) => {
      const sw = this._makeSkinSwatch(skin, idx);
      grid.appendChild(sw);
    });
  },

  _makeSkinSwatch(skin, idx) {
    const a = this.account;
    const unlocked = a.isUnlocked(idx);
    const sw = document.createElement('div');
    sw.className = 'skin-swatch' + (unlocked ? '' : ' locked') + (a.selectedSkin === idx ? ' sel' : '');
    sw.title = unlocked ? skin.name : `${I18N.unlockAt} ${skin.unlock}`;
    const c = document.createElement('canvas');
    c.width = 56; c.height = 56;
    const cx = c.getContext('2d');
    if (unlocked) {
      cx.fillStyle = (skin.body === 'rainbow') ? '#9b59b6' : skin.body;
      cx.lineWidth = 9; cx.lineCap = 'round';
      cx.strokeStyle = (skin.body === 'rainbow') ? '#9b59b6' : skin.body;
      cx.beginPath(); cx.moveTo(8, 48); cx.quadraticCurveTo(48, 48, 48, 16); cx.stroke();
      cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(48, 16, 4, 0, TAU); cx.fill();
      cx.fillStyle = '#000'; cx.beginPath(); cx.arc(49, 16, 2, 0, TAU); cx.fill();
    } else {
      cx.fillStyle = '#2a2f45';
      cx.beginPath(); cx.arc(28, 28, 22, 0, TAU); cx.fill();
      cx.fillStyle = '#6f7ba0'; cx.font = 'bold 22px sans-serif';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText('🔒', 28, 30);
    }
    sw.appendChild(c);
    const label = document.createElement('span');
    label.className = 'skin-name';
    label.textContent = unlocked ? skin.name : `רמה ${skin.unlock}`;
    sw.appendChild(label);
    if (unlocked) {
      sw.addEventListener('click', () => {
        a.selectSkin(idx);
        document.querySelectorAll('#skins .skin-swatch').forEach(e => e.classList.remove('sel'));
        sw.classList.add('sel');
        Audio.click();
        this._updateProfile();
      });
    }
    return sw;
  },

  // ---- Server picker ----
  _buildServerPicker() {
    const sel = document.getElementById('serverSelect');
    if (!sel) return;
    sel.innerHTML = '';
    CONFIG.SERVERS.forEach(srv => {
      const opt = document.createElement('div');
      opt.className = 'server-opt' + (this.account.server === srv.id ? ' sel' : '');
      opt.innerHTML = `<span class="srv-name">${srv.name}</span><span class="srv-ping">${srv.ping}ms</span>`;
      opt.addEventListener('click', () => {
        this.account.server = srv.id;
        document.querySelectorAll('.server-opt').forEach(e => e.classList.remove('sel'));
        opt.classList.add('sel');
        Audio.click();
      });
      sel.appendChild(opt);
    });
  },

  // ---- Stats screen ----
  _buildStats() {
    const box = document.getElementById('statsBox');
    if (!box) return;
    const s = this.account.stats;
    const acc = s.correct + s.wrong > 0 ? Math.round((s.correct / (s.correct + s.wrong)) * 100) : 0;
    box.innerHTML = `
      <div class="stat-row"><span>${I18N.totalGames}</span><b>${fmtNum(s.games)}</b></div>
      <div class="stat-row"><span>${I18N.totalCorrect}</span><b>${fmtNum(s.correct)}</b></div>
      <div class="stat-row"><span>${I18N.accuracy}</span><b>${acc}%</b></div>
      <div class="stat-row"><span>${I18N.totalFood}</span><b>${fmtNum(s.foodEaten)}</b></div>
      <div class="stat-row"><span>${I18N.bestScore}</span><b>${fmtNum(s.bestScore)}</b></div>
      <div class="stat-row"><span>${I18N.bestRank}</span><b>${s.bestRank >= 9999 ? '-' : '#' + s.bestRank}</b></div>
      <div class="stat-row"><span>רצף שיא</span><b>${fmtNum(s.bestStreak)}</b></div>
      <div class="stat-row"><span>${I18N.level}</span><b>${this.account.level}</b></div>
    `;
  },

  // ---- Settings ----
  _buildSettings() {
    const soundChk = document.getElementById('soundToggle');
    const musicChk = document.getElementById('musicToggle');
    if (soundChk) soundChk.checked = Audio.enabled;
    if (musicChk) musicChk.checked = Audio.musicEnabled;
  },

  toggleSettings() {
    const s = this.el.settings;
    if (s.classList.contains('hidden')) { this.hide('stats'); this.show('settings'); }
    else this.hide('settings');
  },
  toggleStats() {
    const s = this.el.stats;
    if (s.classList.contains('hidden')) { this._buildStats(); this.hide('settings'); this.show('stats'); }
    else this.hide('stats');
  },

  // ---- Buttons ----
  _wireButtons() {
    document.getElementById('playBtn').addEventListener('click', () => {
      Audio.init(); Audio.click(); Audio.startMusic();
      const name = (document.getElementById('nameInput').value || '').trim() || 'שחקן';
      this.account.name = name;
      if (this.onPlay) this.onPlay(name, this.account.selectedSkin);
    });
    document.getElementById('respawnBtn').addEventListener('click', () => {
      Audio.click();
      if (this.onRespawn) this.onRespawn();
    });
    document.getElementById('backBtn').addEventListener('click', () => {
      Audio.click();
      this.hide('dead'); this.show('menu'); this._updateProfile();
      if (this.onQuit) this.onQuit();
    });
    document.getElementById('shopBtn').addEventListener('click', () => { Audio.click(); this.toggleShop(); });
    document.getElementById('shopClose').addEventListener('click', () => { Audio.click(); this.toggleShop(); });
    document.getElementById('statsBtn').addEventListener('click', () => { Audio.click(); this.toggleStats(); });
    document.getElementById('statsClose').addEventListener('click', () => { Audio.click(); this.hide('stats'); });
    document.getElementById('settingsBtn').addEventListener('click', () => { Audio.click(); this.toggleSettings(); });
    document.getElementById('settingsClose').addEventListener('click', () => { Audio.click(); this.hide('settings'); });
    document.getElementById('pauseBtn').addEventListener('click', () => { Audio.click(); if (this.onPause) this.onPause(); });
    document.getElementById('resumeBtn').addEventListener('click', () => { Audio.click(); if (this.onResume) this.onResume(); });
    document.getElementById('quitBtn').addEventListener('click', () => {
      Audio.click(); this.hide('pause'); this.show('menu'); this._updateProfile();
      if (this.onQuit) this.onQuit();
    });
    const soundChk = document.getElementById('soundToggle');
    const musicChk = document.getElementById('musicToggle');
    if (soundChk) soundChk.addEventListener('change', () => {
      Audio.setSound(soundChk.checked); if (soundChk.checked) { Audio.init(); Audio.click(); }
    });
    if (musicChk) musicChk.addEventListener('change', () => {
      Audio.setMusic(musicChk.checked); if (musicChk.checked) { Audio.init(); Audio.startMusic(); }
    });
  },

  toggleShop() {
    const s = this.el.shop;
    if (s.classList.contains('hidden')) { this._buildShop(); this.show('shop'); }
    else this.hide('shop');
  },

  _buildShop() {
    const grid = document.getElementById('shopSkins');
    if (!grid) return;
    grid.innerHTML = '';
    SKINS.forEach((skin, idx) => {
      const sw = this._makeSkinSwatch(skin, idx);
      grid.appendChild(sw);
    });
  },

  // ---- In-game HUD ----
  updateHud(score, length, level, streak, board, player, fps) {
    const s = document.getElementById('hudScore');
    const l = document.getElementById('hudLen');
    const lv = document.getElementById('hudLevel');
    const st = document.getElementById('hudStreak');
    if (s) s.textContent = fmtNum(score);
    if (l) l.textContent = fmtNum(length);
    if (lv) lv.textContent = level;
    if (st) st.textContent = streak > 0 ? `🔥 ${streak}` : '';
    const fpsEl = document.getElementById('fps');
    if (fpsEl) fpsEl.textContent = fps;
    const lb = document.getElementById('hudBoard');
    if (lb) {
      lb.innerHTML = board.map((sn, i) => {
        const me = sn === player;
        return `<li class="${me ? 'me' : ''}"><span class="rk">${i + 1}</span>
          <span class="nm">${escapeHtml(sn.name)}</span>
          <span class="sc">${fmtNum(sn.score)}</span></li>`;
      }).join('');
    }
  },

  // ---- Math question overlay ----
  showMathQuestion(q, timeLeftMs) {
    const ov = this.el.math;
    if (!ov) return;
    // Render the question based on operation type
    const qEl = document.getElementById('mathQuestion');
    const opSym = { multiply: '×', divide: '÷', missing: '×', square: '×', word: '' }[q.op] || '×';
    let html;
    if (q.op === 'word' && q.prompt) {
      // word problem: show the Hebrew prompt, big and clear
      html = `<div class="mq-word">${escapeHtml(q.prompt)}</div>`;
    } else if (q.op === 'divide') {
      // a ÷ b = ?
      html = `<span class="mq-a">${q.a}</span> <span class="mq-op">÷</span> <span class="mq-b">${q.b}</span> <span class="mq-eq">=</span> <span class="mq-q">?</span>`;
    } else if (q.op === 'missing') {
      // a × ? = product
      html = `<span class="mq-a">${q.a}</span> <span class="mq-op">×</span> <span class="mq-q">?</span> <span class="mq-eq">=</span> <span class="mq-b">${q.product}</span>`;
    } else if (q.op === 'square') {
      // a² = ?
      html = `<span class="mq-a">${q.a}</span><span class="mq-op">²</span> <span class="mq-eq">=</span> <span class="mq-q">?</span>`;
    } else {
      // multiply: a × b = ?
      html = `<span class="mq-a">${q.a}</span> <span class="mq-op">×</span> <span class="mq-b">${q.b}</span> <span class="mq-eq">=</span> <span class="mq-q">?</span>`;
    }
    qEl.innerHTML = html;
    const opts = document.getElementById('mathOptions');
    opts.innerHTML = '';
    q.options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'math-opt';
      b.textContent = opt;
      b.addEventListener('click', () => { Audio.click(); if (this.onAnswer) this.onAnswer(opt); });
      opts.appendChild(b);
    });
    this._mathTimerStart = performance.now();
    this._mathTimerTotal = timeLeftMs;
    ov.classList.remove('hidden');
  }
  ,
  hideMath() { if (this.el.math) this.el.math.classList.add('hidden'); },

  updateMathTimer() {
    const bar = document.getElementById('mathTimerBar');
    if (!bar || !this._mathTimerStart) return;
    const elapsed = performance.now() - this._mathTimerStart;
    const left = clamp(1 - elapsed / this._mathTimerTotal, 0, 1);
    bar.style.width = (left * 100) + '%';
    bar.className = 'math-timer-bar' + (left < 0.33 ? ' low' : '');
  },

  // Correct / wrong flash feedback
  showFeedback(correct, xp) {
    const f = document.getElementById('mathFeedback');
    if (!f) return;
    f.textContent = correct ? `${I18N.correct}${xp} ✨` : `${I18N.wrong} ❌`;
    f.className = 'math-feedback ' + (correct ? 'good' : 'bad') + ' show';
    setTimeout(() => { f.className = 'math-feedback'; }, 900);
  },

  showTurbo() {
    const t = document.getElementById('turboFlash');
    if (!t) return;
    t.className = 'turbo-flash show';
    setTimeout(() => { t.className = 'turbo-flash'; }, 1000);
  },

  // ---- Death screen ----
  updateDeath(score, length, rank, mathStats) {
    document.getElementById('deadScore').textContent = fmtNum(score);
    document.getElementById('deadLen').textContent = fmtNum(length);
    document.getElementById('deadRank').textContent = '#' + rank;
    const acc = mathStats.answered > 0 ? Math.round((mathStats.correct / mathStats.answered) * 100) : 0;
    document.getElementById('deadMath').innerHTML =
      `תשובות נכונות: <b>${mathStats.correct}/${mathStats.answered}</b> · דיוק: <b>${acc}%</b> · רצף שיא: <b>${mathStats.bestStreak}</b>`;
  },

  showLoading(text) {
    const l = this.el.loading;
    if (!l) return;
    if (text) document.getElementById('loadingText').textContent = text;
    l.classList.remove('hidden');
  },
  hideLoading() { if (this.el.loading) this.el.loading.classList.add('hidden'); },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}