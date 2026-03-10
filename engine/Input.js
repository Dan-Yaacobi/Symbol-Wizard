export class Input {
  constructor(canvas, cellW, cellH) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, left: false, clicked: false };

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
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
    return this.keys.has(key);
  }

  endFrame() {
    this.mouse.clicked = false;
  }
}
