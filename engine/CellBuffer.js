export class CellBuffer {
  constructor(width, height, baseCell) {
    this.width = width;
    this.height = height;
    this.baseCell = baseCell;
    this.cells = Array.from({ length: width * height }, () => ({ ...baseCell }));
  }

  clear() {
    for (let i = 0; i < this.cells.length; i += 1) {
      const cell = this.cells[i];
      cell.char = this.baseCell.char;
      cell.fg = this.baseCell.fg;
      cell.bg = this.baseCell.bg;
    }
  }

  set(x, y, char, fg, bg) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    const cell = this.cells[i];
    cell.char = char;
    cell.fg = fg;
    cell.bg = bg;
  }

  get(x, y) {
    return this.cells[y * this.width + x];
  }
}
