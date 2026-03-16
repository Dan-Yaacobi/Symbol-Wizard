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
    this.smoothingFactor = 0.14;
    this.zoom = 1;
    this.pixelSnapping = true;
    this.baseX = 0;
    this.baseY = 0;
    this.hasFollowTarget = false;
  }

  #clampToWorld(x, y) {
    const maxX = Math.max(0, this.worldW - this.viewW);
    const maxY = Math.max(0, this.worldH - this.viewH);
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }

  follow(target) {
    const targetX = target.x - this.viewW / 2;
    const targetY = target.y - this.viewH / 2;
    const clampedTarget = this.#clampToWorld(targetX, targetY);

    if (!this.hasFollowTarget) {
      this.baseX = clampedTarget.x;
      this.baseY = clampedTarget.y;
      this.hasFollowTarget = true;
    } else {
      this.baseX += (clampedTarget.x - this.baseX) * this.smoothingFactor;
      this.baseY += (clampedTarget.y - this.baseY) * this.smoothingFactor;
    }

    const clampedBase = this.#clampToWorld(this.baseX, this.baseY);
    this.baseX = clampedBase.x;
    this.baseY = clampedBase.y;

    const shaken = this.#clampToWorld(this.baseX + this.shakeX, this.baseY + this.shakeY);
    this.x = shaken.x;
    this.y = shaken.y;
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
    const rawX = (wx - this.x) * this.zoom;
    const rawY = (wy - this.y) * this.zoom;
    return this.pixelSnapping ? { x: Math.round(rawX), y: Math.round(rawY) } : { x: rawX, y: rawY };
  }

  screenToWorld(sx, sy) {
    return { x: sx + this.x, y: sy + this.y };
  }
}
