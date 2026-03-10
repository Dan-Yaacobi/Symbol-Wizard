export class Input {
  constructor(canvas, cellW, cellH) {
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
      this.mouse.x = Math.floor((e.clientX - rect.left) / cellW);
      this.mouse.y = Math.floor((e.clientY - rect.top) / cellH);
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
