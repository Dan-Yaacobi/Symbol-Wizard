import { CellBuffer } from './CellBuffer.js';

export class Renderer {
  constructor(canvas, cols, rows, cellW = 8, cellH = 8) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = cols;
    this.rows = rows;
    this.cellW = cellW;
    this.cellH = cellH;
    this.buffer = new CellBuffer(cols, rows, { char: ' ', fg: '#9aa0aa', bg: '#0a0d10' });

    this.ctx.font = `${cellH}px monospace`;
    this.ctx.textBaseline = 'top';
  }

  clear() {
    this.buffer.clear();
  }

  draw() {
    const { ctx, cols, rows, cellW, cellH } = this;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const c = this.buffer.get(x, y);
        ctx.fillStyle = c.bg;
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        if (c.char !== ' ') {
          ctx.fillStyle = c.fg;
          ctx.fillText(c.char, x * cellW, y * cellH);
        }
      }
    }
  }
}
