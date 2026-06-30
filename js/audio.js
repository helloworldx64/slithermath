// Audio engine: all sound effects and music are synthesized via the Web Audio API
// so the game needs zero audio asset files. A simple looping arpeggio provides
// background music; one-shot tones handle eat/boost/correct/wrong/death/ui events.
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = Store.get('mr_sound', true);
    this.musicEnabled = Store.get('mr_music', true);
    this._musicTimer = null;
    this._musicStep = 0;
  }

  // Must be created/resumed from a user gesture (browser autoplay policy)
  init() {
    if (this.ctx) { this._resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);
    } catch { this.ctx = null; }
  }

  _resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setSound(on) { this.enabled = on; Store.set('mr_sound', on); }
  setMusic(on) {
    this.musicEnabled = on; Store.set('mr_music', on);
    if (on) this.startMusic(); else this.stopMusic();
  }

  // --- One-shot SFX ---
  _tone(freq, dur, type = 'sine', vol = 0.5, attack = 0.005, release = 0.08) {
    if (!this.enabled || !this.ctx) return;
    if (!isFinite(freq) || !isFinite(dur) || dur <= 0) return;
    vol = Math.max(0.0001, Math.min(1, isFinite(vol) ? vol : 0.5));
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  eat() { this._tone(880, 0.08, 'triangle', 0.22); }
  eatBig() {
    this._tone(660, 0.1, 'triangle', 0.3);
    setTimeout(() => this._tone(990, 0.12, 'triangle', 0.3), 60);
  }
  boost() { this._tone(220, 0.18, 'sawtooth', 0.18); }
  correct() {
    // happy ascending arpeggio
    this._tone(523, 0.1, 'triangle', 0.35);
    setTimeout(() => this._tone(659, 0.1, 'triangle', 0.35), 80);
    setTimeout(() => this._tone(784, 0.16, 'triangle', 0.4), 160);
  }
  wrong() {
    this._tone(196, 0.18, 'square', 0.25);
    setTimeout(() => this._tone(147, 0.22, 'square', 0.22), 90);
  }
  death() {
    this._tone(330, 0.12, 'sawtooth', 0.3);
    setTimeout(() => this._tone(220, 0.18, 'sawtooth', 0.3), 100);
    setTimeout(() => this._tone(110, 0.4, 'sawtooth', 0.35), 240);
  }
  click() { this._tone(520, 0.05, 'square', 0.16); }
  unlock() {
    this._tone(523, 0.1, 'triangle', 0.35);
    setTimeout(() => this._tone(784, 0.1, 'triangle', 0.35), 80);
    setTimeout(() => this._tone(1047, 0.2, 'triangle', 0.45), 160);
  }
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.14, 'triangle', 0.4), i * 90));
  }

  // --- Background music: gentle looping arpeggio in C major pentatonic ---
  startMusic() {
    if (!this.musicEnabled || !this.ctx) return;
    this._resume();
    if (this._musicTimer) return;
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];
    const bass = [130.81, 146.83, 164.81, 196.00];
    this._musicStep = 0;
    const tick = () => {
      if (!this.ctx || !this.musicEnabled) { this._musicTimer = null; return; }
      const t = this.ctx.currentTime;
      const step = this._musicStep++;
      // melody (keep index in-bounds)
      const idx = ((step * 3) % scale.length + (step % 2)) % scale.length;
      const note = scale[idx];
      if (!isFinite(note)) { this._musicTimer = setTimeout(tick, 300); return; }
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(t); osc.stop(t + 0.45);
      // bass every 4 steps
      if (step % 4 === 0) {
        const b = bass[(step / 4 | 0) % bass.length];
        const o2 = this.ctx.createOscillator(); const g2 = this.ctx.createGain();
        o2.type = 'triangle'; o2.frequency.value = b;
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        o2.connect(g2); g2.connect(this.musicGain);
        o2.start(t); o2.stop(t + 1.5);
      }
      this._musicTimer = setTimeout(tick, 300);
    };
    tick();
  }

  stopMusic() {
    if (this._musicTimer) { clearTimeout(this._musicTimer); this._musicTimer = null; }
  }
}

const Audio = new AudioEngine();