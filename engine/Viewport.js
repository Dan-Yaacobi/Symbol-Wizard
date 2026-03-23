import { clamp } from '../input/CoordinateSystem.js';

export class Viewport {
  constructor(canvas, renderer = null) {
    this.canvas = canvas;
    this.renderer = renderer;
  }

  get canvasWidth() {
    return this.canvas.width;
  }

  get canvasHeight() {
    return this.canvas.height;
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

  canvasToLogical(canvasX, canvasY) {
    const compositeScale = this.renderer?.compositeScale ?? 1;
    const offsetX = this.renderer?.offsetX ?? 0;
    const offsetY = this.renderer?.offsetY ?? 0;
    const logicalWidth = this.renderer?.background?.canvas?.width ?? this.canvas.width;
    const logicalHeight = this.renderer?.background?.canvas?.height ?? this.canvas.height;
    const safeScale = compositeScale > 0 ? compositeScale : 1;
    const rawLogicalX = (canvasX - offsetX) / safeScale;
    const rawLogicalY = (canvasY - offsetY) / safeScale;
    const inside = rawLogicalX >= 0
      && rawLogicalY >= 0
      && rawLogicalX <= logicalWidth
      && rawLogicalY <= logicalHeight;

    return {
      x: clamp(rawLogicalX, 0, logicalWidth),
      y: clamp(rawLogicalY, 0, logicalHeight),
      rawX: rawLogicalX,
      rawY: rawLogicalY,
      inside,
      width: logicalWidth,
      height: logicalHeight,
      scale: safeScale,
      offsetX,
      offsetY,
    };
  }

  canvasToWorld(canvasX, canvasY, camera, cellW = 8, cellH = 8) {
    const logicalPos = this.canvasToLogical(canvasX, canvasY);
    return {
      x: logicalPos.x / cellW + camera.x,
      y: logicalPos.y / cellH + camera.y,
      logicalX: logicalPos.x,
      logicalY: logicalPos.y,
      rawLogicalX: logicalPos.rawX,
      rawLogicalY: logicalPos.rawY,
      inside: logicalPos.inside,
      logicalWidth: logicalPos.width,
      logicalHeight: logicalPos.height,
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
