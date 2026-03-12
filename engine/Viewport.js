export class Viewport {
  constructor(canvas) {
    this.canvas = canvas;
    this.cssWidth = 1;
    this.cssHeight = 1;
    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;
    this.scaleX = 1;
    this.scaleY = 1;
    this.rect = canvas.getBoundingClientRect();
    this.update();
  }

  update() {
    this.rect = this.canvas.getBoundingClientRect();

    this.cssWidth = Math.max(1, this.rect.width);
    this.cssHeight = Math.max(1, this.rect.height);

    this.canvasWidth = this.canvas.width;
    this.canvasHeight = this.canvas.height;

    this.scaleX = this.canvasWidth / this.cssWidth;
    this.scaleY = this.canvasHeight / this.cssHeight;
  }

  screenToCanvas(screenX, screenY) {
    return {
      x: (screenX - this.rect.left) * this.scaleX,
      y: (screenY - this.rect.top) * this.scaleY,
    };
  }

  canvasToWorld(canvasX, canvasY, camera, cellW = 8, cellH = 8) {
    return {
      x: canvasX / cellW + camera.x,
      y: canvasY / cellH + camera.y,
    };
  }

  screenToWorld(screenX, screenY, camera, cellW = 8, cellH = 8) {
    const canvasPos = this.screenToCanvas(screenX, screenY);
    return this.canvasToWorld(canvasPos.x, canvasPos.y, camera, cellW, cellH);
  }
}
