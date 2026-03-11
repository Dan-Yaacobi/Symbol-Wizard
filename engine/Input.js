export class Input {
  constructor(canvas, cols, rows) {
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      e: false,
    };
    this.mouse = { x: 0, y: 0, left: false, clicked: false };

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
      const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
      this.mouse.x = Math.max(0, Math.min(cols - 1, Math.floor(relX * cols)));
      this.mouse.y = Math.max(0, Math.min(rows - 1, Math.floor(relY * rows)));
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.left = true;
        this.mouse.clicked = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
    });
  }

  isDown(key) {
    return Boolean(this.keys[key.toLowerCase()]);
  }

  endFrame() {
    this.mouse.clicked = false;
  }
}
