export class Viewport {
  constructor(canvas) {
    this.canvas = canvas;
  }

  screenToCanvas(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const computed = getComputedStyle(this.canvas);
    const borderLeft = Number.parseFloat(computed.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(computed.borderRightWidth) || 0;
    const borderTop = Number.parseFloat(computed.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(computed.borderBottomWidth) || 0;

    const renderWidth = Math.max(1, rect.width - borderLeft - borderRight);
    const renderHeight = Math.max(1, rect.height - borderTop - borderBottom);
    const scaleX = this.canvas.width / renderWidth;
    const scaleY = this.canvas.height / renderHeight;

    return {
      x: (screenX - rect.left - borderLeft) * scaleX,
      y: (screenY - rect.top - borderTop) * scaleY,
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
