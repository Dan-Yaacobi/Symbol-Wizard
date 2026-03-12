export class Camera {
  constructor(viewW, viewH, worldW, worldH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.worldW = worldW;
    this.worldH = worldH;
    this.x = 0;
    this.y = 0;
    this.shakeTimer = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  follow(target) {
    const snappedTargetX = Math.round(target.x);
    const snappedTargetY = Math.round(target.y);

    const baseX = snappedTargetX - Math.floor(this.viewW / 2);
    const baseY = snappedTargetY - Math.floor(this.viewH / 2);

    this.x = Math.max(0, Math.min(baseX + this.shakeX, this.worldW - this.viewW));
    this.y = Math.max(0, Math.min(baseY + this.shakeY, this.worldH - this.viewH));
  }

  startShake(duration = 0.1, intensity = 0.4) {
    this.shakeTimer = Math.max(this.shakeTimer, duration);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  update(dt) {
    if (this.shakeTimer <= 0) {
      this.shakeX = 0;
      this.shakeY = 0;
      return;
    }

    this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    const progress = this.shakeDuration <= 0 ? 0 : this.shakeTimer / this.shakeDuration;
    const currentIntensity = this.shakeIntensity * progress;

    this.shakeX = (Math.random() * 2 - 1) * currentIntensity;
    this.shakeY = (Math.random() * 2 - 1) * currentIntensity;

    if (this.shakeTimer === 0) {
      this.shakeDuration = 0;
      this.shakeIntensity = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  worldToScreen(wx, wy) {
    return { x: Math.round(wx - this.x), y: Math.round(wy - this.y) };
  }

  screenToWorld(sx, sy) {
    return { x: sx + this.x, y: sy + this.y };
  }
}
