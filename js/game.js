// Main game controller: ties together account, world, camera, input, renderer,
// UI, audio, and the math engine. State machine: loading -> menu -> playing -> dead.
class Game {
  constructor(canvas, account) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.account = account;
    this.camera = new Camera();
    this.world = new World(account.server);
    this.input = new Input(canvas, this.camera);
    this.renderer = new Renderer(this.ctx, this.camera);
    this.math = new MathEngine(account);
    this.state = 'menu';
    this.playerName = account.name;
    this.playerSkinIdx = account.selectedSkin;
    this.playerStartLength = 0;
    this.lastTime = 0;
    this.fps = 0; this._fpsAccum = 0; this._fpsCount = 0;
    this.paused = false;
    this._tutorialShown = false;

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.world.fillBots();

    // Wire UI callbacks
    UI.onPlay = (name, skinIdx, startLen) => this.start(name, skinIdx, startLen);
    UI.onRespawn = () => this.respawn();
    UI.onQuit = () => this.quitToMenu();
    UI.onAnswer = (picked) => this._answerMath(picked);
    UI.onPause = () => this.pause();
    UI.onResume = () => this.resume();
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.resize(w, h);
  }

  start(name, skinIdx, startLength) {
    this.playerName = name || this.account.name;
    this.playerSkinIdx = skinIdx || 0;
    this.playerStartLength = startLength || 0;
    if (this.world.player) {
      const i = this.world.snakes.indexOf(this.world.player);
      if (i >= 0) this.world.snakes.splice(i, 1);
    }
    this.world = new World(this.account.server);
    this.world.fillBots();
    this.world.player = this.world.spawnPlayer(this.playerName, SKINS[this.playerSkinIdx], this.playerStartLength);
    this.math = new MathEngine(this.account);
    this.math.resetCooldown(this.world.player.score);
    this.camera.x = this.world.player.head.x;
    this.camera.y = this.world.player.head.y;
    this.state = 'playing';
    UI.hide('menu'); UI.hide('dead'); UI.hide('math'); UI.show('hud');
    if (!this._tutorialShown && isMobile()) {
      this._tutorialShown = true;
    }
  }

  die() {
    const p = this.world.player;
    const rank = this.world.playerRank(p);
    this.account.recordGame(
      Math.floor(p.score), rank, Math.floor(p.targetLength),
      p.foodEaten, this.math.session.correct, this.math.session.wrong, this.math.bestStreak
    );
    UI.updateDeath(Math.floor(p.score), Math.floor(p.targetLength), rank, this.math.session);
    this.state = 'dead';
    UI.hide('hud'); UI.hide('math'); UI.show('dead');
    Audio.death();
    this.camera.addShake(14);
  }

  respawn() { this.start(this.playerName, this.playerSkinIdx, this.playerStartLength); }

  quitToMenu() {
    this.state = 'menu';
    this.paused = false;
    UI.hide('hud'); UI.hide('math'); UI.hide('pause');
    UI.show('menu');
    UI._buildStats();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.paused = true;
    UI.show('pause');
  }
  resume() { this.paused = false; UI.hide('pause'); }

  // ---- Math handling ----
  _answerMath(picked) {
    const p = this.world.player;
    const res = this.math.submit(picked, p.score);
    if (res.correct) {
      p.activateTurbo();
      Audio.correct();
      UI.showFeedback(true, res.gainedXp);
      UI.showTurbo();
      this.camera.addShake(3);
    } else {
      p.activateSlow();
      Audio.wrong();
      UI.showFeedback(false, 0);
      this.camera.addShake(6);
    }
    UI.hideMath();
    UI._updateProfile();
  }

  _maybeSpawnMath() {
    const p = this.world.player;
    if (!p || !p.alive) return;
    // Show a question only after the cooldown AND once a math orb is eaten.
    // The orb eating is signaled via world.events; here we just check cooldown.
    const q = this.math.maybeAsk(p.score, 0);
    if (q) {
      // Spawn a math orb for the player to grab; eating it opens the question.
      // For simplicity in this build, we open the question immediately so kids
      // aren't confused by the orb step.
      UI.showMathQuestion(q, CONFIG.MATH_TIME_LIMIT_MS);
      Audio.eatBig();
    }
  }

  tick(now) {
    if (!this.lastTime) this.lastTime = now;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.05) dt = 0.05;
    this.renderer.t = now;

    // FPS
    this._fpsAccum += dt; this._fpsCount++;
    if (this._fpsAccum >= 0.5) {
      this.fps = Math.round(this._fpsCount / this._fpsAccum);
      this._fpsAccum = 0; this._fpsCount = 0;
    }

    const simRunning = (this.state === 'playing' || this.state === 'menu' || this.state === 'dead') && !this.paused;
    if (simRunning) this.world.update(dt);

    if (this.state === 'playing' && this.world.player) {
      const p = this.world.player;
      if (p.alive) {
        p.setTarget(this.input.headingFrom(p.head));
        p.boosting = this.input.isBoosting() && p.score > CONFIG.BOOST_MIN_SCORE;
        this.camera.follow(p.head, p.radius, dt);
        UI.updateHud(Math.floor(p.score), Math.floor(p.targetLength),
          this.account.level, this.math.streak,
          this.world.leaderboard(10), p, this.fps);
        // Math: spawn question when cooldown elapses
        this._maybeSpawnMath();
        // Update math timer; timeout = wrong
        if (this.math.active) {
          UI.updateMathTimer();
          if (this.math.timeLeft() <= 0) {
            const res = this.math.timeout(p.score);
            p.activateSlow();
            Audio.wrong();
            UI.showFeedback(false, 0);
            UI.hideMath();
          }
        }
      } else {
        this.die();
      }
    } else if (this.state === 'menu' || this.state === 'dead') {
      const lb = this.world.leaderboard(1);
      const target = (lb[0] && lb[0].alive) ? lb[0].head : { x: 0, y: 0 };
      const r = (lb[0] && lb[0].alive) ? lb[0].radius : 20;
      this.camera.follow(target, r, dt);
    }

    // Process world events (sounds + shake)
    const events = this.world.drainEvents();
    for (const e of events) {
      if (e.type === 'eat') {
        if (e.snake === this.world.player) {
          if (e.food.kind === 'big' || e.food.kind === 'math') Audio.eatBig(); else Audio.eat();
        }
      } else if (e.type === 'death') {
        if (e.snake !== this.world.player) this.camera.addShake(2);
      }
    }

    this.camera.updateShake(dt);
    this.renderer.draw(this.world, this.input);
    this.renderer.drawUI(this.world, this.input);
    this.renderer.drawMinimap(this.ctx, this.world, this.world.player, 150);

    requestAnimationFrame((t) => this.tick(t));
  }
}