// Smooth-follow camera with dynamic zoom + screen shake support.
class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.zoom = CONFIG.ZOOM_BASE;
    this.targetZoom = CONFIG.ZOOM_BASE;
    this.width = 0; this.height = 0;
    this.shake = 0; this.shakeX = 0; this.shakeY = 0;
  }
  resize(w, h) { this.width = w; this.height = h; }
  follow(target, radius, dt) {
    this.x = lerp(this.x, target.x, Math.min(1, CONFIG.CAMERA_LERP * 60 * dt));
    this.y = lerp(this.y, target.y, Math.min(1, CONFIG.CAMERA_LERP * 60 * dt));
    const want = clamp(CONFIG.ZOOM_MAX - radius * CONFIG.ZOOM_TARGET_PER_RADIUS,
      CONFIG.ZOOM_MIN, CONFIG.ZOOM_MAX);
    this.targetZoom = want;
    this.zoom = lerp(this.zoom, this.targetZoom, Math.min(1, 0.08 * 60 * dt));
  }
  addShake(amount) { this.shake = Math.min(28, this.shake + amount); }
  updateShake(dt) {
    if (this.shake > 0.1) {
      this.shakeX = (Math.random() - 0.5) * this.shake;
      this.shakeY = (Math.random() - 0.5) * this.shake;
      this.shake *= Math.pow(0.001, dt); // fast decay
    } else { this.shakeX = 0; this.shakeY = 0; this.shake = 0; }
  }
  worldToScreen(x, y) {
    return { x: (x - this.x) * this.zoom + this.width / 2 + this.shakeX,
             y: (y - this.y) * this.zoom + this.height / 2 + this.shakeY };
  }
  screenToWorld(x, y) {
    return { x: (x - this.width / 2 - this.shakeX) / this.zoom + this.x,
             y: (y - this.height / 2 - this.shakeY) / this.zoom + this.y };
  }
  visibleBounds() {
    const halfW = (this.width / 2) / this.zoom;
    const halfH = (this.height / 2) / this.zoom;
    return { minX: this.x - halfW, maxX: this.x + halfW,
             minY: this.y - halfH, maxY: this.y + halfH };
  }
}