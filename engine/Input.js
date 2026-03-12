import { clamp } from '../input/CoordinateSystem.js';

export class Input {
  constructor(canvas, viewport, camera, cellW = 8, cellH = 8) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.camera = camera;
    this.cellW = cellW;
    this.cellH = cellH;
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      e: false,
    };
    this.mouse = {
      screenX: 0,
      screenY: 0,
      canvasX: 0,
      canvasY: 0,
      canvasCellX: 0,
      canvasCellY: 0,
      worldX: 0,
      worldY: 0,
      left: false,
      clicked: false,
    };

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      this.#updatePointer(e);
    });

    canvas.addEventListener('mousedown', (e) => {
      this.#updatePointer(e);
      if (e.button === 0) {
        this.mouse.left = true;
        this.mouse.clicked = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
    });
  }

  #updatePointer(e) {
    const canvasPos = this.viewport.screenToCanvas(e.clientX, e.clientY);
    const maxCanvasCellX = Math.max(0, Math.ceil(this.viewport.canvasWidth / this.cellW) - 1);
    const maxCanvasCellY = Math.max(0, Math.ceil(this.viewport.canvasHeight / this.cellH) - 1);
    const canvasCellX = clamp(Math.floor(canvasPos.x / this.cellW), 0, maxCanvasCellX);
    const canvasCellY = clamp(Math.floor(canvasPos.y / this.cellH), 0, maxCanvasCellY);
    const worldPos = {
      x: canvasCellX + this.camera.x,
      y: canvasCellY + this.camera.y
    };

    this.mouse.screenX = e.clientX;
    this.mouse.screenY = e.clientY;
    this.mouse.canvasX = canvasPos.x;
    this.mouse.canvasY = canvasPos.y;
    this.mouse.canvasCellX = canvasCellX;
    this.mouse.canvasCellY = canvasCellY;
    this.mouse.worldX = worldPos.x;
    this.mouse.worldY = worldPos.y;
  }

  getMouseWorldPosition() {
    const worldPos = this.viewport.canvasToWorld(this.mouse.canvasX, this.mouse.canvasY, this.camera, this.cellW, this.cellH);
    this.mouse.worldX = worldPos.x;
    this.mouse.worldY = worldPos.y;
    return { x: worldPos.x, y: worldPos.y };
  }

  isDown(key) {
    return Boolean(this.keys[key.toLowerCase()]);
  }

  endFrame() {
    this.mouse.clicked = false;
  }
}
