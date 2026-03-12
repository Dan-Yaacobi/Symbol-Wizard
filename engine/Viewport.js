export class Viewport {
  constructor(canvas) {
    this.canvas = canvas;
  }

  get canvasWidth() {
    return this.canvas.width;
  }

  get canvasHeight() {
    return this.canvas.height;
  }

  screenToCanvas(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();

    const renderWidth = this.canvas.clientWidth || rect.width || 1;
    const renderHeight = this.canvas.clientHeight || rect.height || 1;
    const scaleX = this.canvas.width / renderWidth;
    const scaleY = this.canvas.height / renderHeight;

    return {
      x: (screenX - rect.left - this.canvas.clientLeft) * scaleX,
      y: (screenY - rect.top - this.canvas.clientTop) * scaleY,
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

    return this.canvasToWorld(
      canvasPos.x,
      canvasPos.y,
      camera,
      cellW,
      cellH
    );
  }
}
