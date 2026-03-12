export class Viewport {
  constructor(canvas) {
    this.canvas = canvas;
  }

  screenToCanvas(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (screenX - rect.left) * scaleX,
      y: (screenY - rect.top) * scaleY,
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
