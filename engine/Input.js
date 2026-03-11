export class Input {
  constructor(canvas, cols, rows) {
    this.canvas = canvas;
    this.cols = cols;
    this.rows = rows;
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      e: false,
    };
    this.mouse = {
      x: 0,
      y: 0,
      canvasX: 0,
      canvasY: 0,
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
      const rect = canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      const clampedLocalX = Math.max(0, Math.min(localX, rect.width));
      const clampedLocalY = Math.max(0, Math.min(localY, rect.height));

      const widthScale = canvas.width / Math.max(1, canvas.clientWidth);
      const heightScale = canvas.height / Math.max(1, canvas.clientHeight);

      const scaledX = clampedLocalX * widthScale;
      const scaledY = clampedLocalY * heightScale;

      const cellWidth = canvas.width / Math.max(1, cols);
      const cellHeight = canvas.height / Math.max(1, rows);

      this.mouse.canvasX = scaledX;
      this.mouse.canvasY = scaledY;
      this.mouse.x = Math.max(0, Math.min(cols - 1, scaledX / cellWidth));
      this.mouse.y = Math.max(0, Math.min(rows - 1, scaledY / cellHeight));
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
