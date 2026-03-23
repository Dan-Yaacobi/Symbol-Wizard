import { clamp } from '../input/CoordinateSystem.js';

const MOUSE_BUTTON_MAP = {
  0: 'left',
  1: 'middle',
  2: 'right',
};

export class Input {
  constructor(canvas, viewport, camera, cellW = 8, cellH = 8) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.camera = camera;
    this.cellW = cellW;
    this.cellH = cellH;

    this.keys = { w: false, a: false, s: false, d: false, e: false };

    this.mouse = {
      screenX: 0,
      screenY: 0,
      canvasX: 0,
      canvasY: 0,
      logicalX: 0,
      logicalY: 0,
      logicalCellX: 0,
      logicalCellY: 0,
      canvasCellX: 0,
      canvasCellY: 0,
      worldX: 0,
      worldY: 0,
      insideViewport: false,
      left: false,
      middle: false,
      right: false,
      clicked: false,
    };

    this.mouseButtonsPressed = {
      left: false,
      middle: false,
      right: false,
    };

    window.addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()] = false;
    });

    canvas.addEventListener('contextmenu', e => {
      this.#updatePointer(e);
      e.preventDefault();
    });

    canvas.addEventListener('mousemove', e => {
      this.#updatePointer(e);
    });

    canvas.addEventListener('mousedown', e => {
      this.#updatePointer(e);
      this.#setMouseButtonState(e.button, true);
      e.preventDefault();
    });

    canvas.addEventListener('mouseup', e => {
      this.#updatePointer(e);
      this.#setMouseButtonState(e.button, false);
      e.preventDefault();
    });

    canvas.addEventListener('auxclick', e => {
      this.#updatePointer(e);
      if (e.button === 1) e.preventDefault();
    });

    window.addEventListener('mouseup', e => {
      this.#setMouseButtonState(e.button, false);
    });
  }

  #setMouseButtonState(button, isDown) {
    const mouseButton = MOUSE_BUTTON_MAP[button];
    if (!mouseButton) return;

    this.mouse[mouseButton] = isDown;
    if (isDown) {
      this.mouseButtonsPressed[mouseButton] = true;
      if (mouseButton === 'left') this.mouse.clicked = true;
    }
  }

  #updatePointer(e) {
    const canvasPos = this.viewport.screenToCanvas(e.clientX, e.clientY);

    const maxCanvasCellX = Math.max(0, Math.ceil(this.viewport.canvasWidth / this.cellW) - 1);
    const maxCanvasCellY = Math.max(0, Math.ceil(this.viewport.canvasHeight / this.cellH) - 1);

    const canvasCellX = clamp(Math.floor(canvasPos.x / this.cellW), 0, maxCanvasCellX);
    const canvasCellY = clamp(Math.floor(canvasPos.y / this.cellH), 0, maxCanvasCellY);

    const worldPos = this.viewport.canvasToWorld(
      canvasPos.x,
      canvasPos.y,
      this.camera,
      this.cellW,
      this.cellH
    );
    const maxLogicalCellX = Math.max(0, Math.ceil(worldPos.logicalWidth / this.cellW) - 1);
    const maxLogicalCellY = Math.max(0, Math.ceil(worldPos.logicalHeight / this.cellH) - 1);
    const logicalCellX = clamp(Math.floor(worldPos.logicalX / this.cellW), 0, maxLogicalCellX);
    const logicalCellY = clamp(Math.floor(worldPos.logicalY / this.cellH), 0, maxLogicalCellY);

    this.mouse.screenX = e.clientX;
    this.mouse.screenY = e.clientY;
    this.mouse.canvasX = canvasPos.x;
    this.mouse.canvasY = canvasPos.y;
    this.mouse.logicalX = worldPos.logicalX;
    this.mouse.logicalY = worldPos.logicalY;
    this.mouse.logicalCellX = logicalCellX;
    this.mouse.logicalCellY = logicalCellY;
    this.mouse.canvasCellX = canvasCellX;
    this.mouse.canvasCellY = canvasCellY;
    this.mouse.worldX = worldPos.x;
    this.mouse.worldY = worldPos.y;
    this.mouse.insideViewport = worldPos.inside;
  }

  getMouseWorldPosition() {
    return { x: this.mouse.worldX, y: this.mouse.worldY };
  }

  consumeMouseButtonPress(button) {
    const mouseButton = button.toLowerCase();
    const pressed = Boolean(this.mouseButtonsPressed[mouseButton]);
    this.mouseButtonsPressed[mouseButton] = false;
    return pressed;
  }

  clearMouseButtonPresses() {
    this.mouseButtonsPressed.left = false;
    this.mouseButtonsPressed.middle = false;
    this.mouseButtonsPressed.right = false;
  }

  isDown(key) {
    return Boolean(this.keys[key.toLowerCase()]);
  }

  endFrame() {
    this.mouse.clicked = false;
  }
}
