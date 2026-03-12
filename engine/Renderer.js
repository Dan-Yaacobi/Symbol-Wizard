export class Renderer {
  constructor(canvas, cols, rows, cellW = 8, cellH = 8) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.cols = cols;
    this.rows = rows;
    this.cellW = cellW;
    this.cellH = cellH;

    this.background = this.#createLayer();
    this.entities = this.#createLayer();
    this.effects = this.#createLayer();
    this.ui = this.#createLayer();

    this.glyphCache = new Map();
    this.lastCameraX = Number.NaN;
    this.lastCameraY = Number.NaN;

    this.ctx.imageSmoothingEnabled = false;
    this.background.ctx.imageSmoothingEnabled = false;
    this.entities.ctx.imageSmoothingEnabled = false;
    this.effects.ctx.imageSmoothingEnabled = false;
    this.ui.ctx.imageSmoothingEnabled = false;

    this.#setTextStyle(this.background.ctx);
    this.#setTextStyle(this.entities.ctx);
    this.#setTextStyle(this.effects.ctx);
    this.#setTextStyle(this.ui.ctx);
  }

  #createLayer() {
    const canvas = document.createElement('canvas');
    canvas.width = this.cols * this.cellW;
    canvas.height = this.rows * this.cellH;
    const ctx = canvas.getContext('2d', { alpha: true });
    return { canvas, ctx };
  }

  #setTextStyle(ctx) {
    ctx.font = `${this.cellH}px monospace`;
    ctx.textBaseline = 'top';
  }

  #cacheKey(char, fg, bg) {
    return `${char}|${fg}|${bg}`;
  }

  #getGlyph(char, fg, bg) {
    const key = this.#cacheKey(char, fg, bg);
    const cached = this.glyphCache.get(key);
    if (cached) return cached;

    const tile = document.createElement('canvas');
    tile.width = this.cellW;
    tile.height = this.cellH;
    const tctx = tile.getContext('2d', { alpha: true });
    tctx.imageSmoothingEnabled = false;
    this.#setTextStyle(tctx);

    tctx.fillStyle = bg;
    tctx.fillRect(0, 0, this.cellW, this.cellH);
    if (char !== ' ') {
      tctx.fillStyle = fg;
      tctx.fillText(char, 0, 0);
    }

    this.glyphCache.set(key, tile);
    return tile;
  }

  #drawGlyphToLayer(layerCtx, char, fg, bg, cellX, cellY) {
    if (cellX < 0 || cellY < 0 || cellX >= this.cols || cellY >= this.rows) return;
    const tile = this.#getGlyph(char, fg, bg);
    layerCtx.drawImage(tile, cellX * this.cellW, cellY * this.cellH);
  }

  renderBackground(map, camera) {
    if (camera.x === this.lastCameraX && camera.y === this.lastCameraY) return;

    this.lastCameraX = camera.x;
    this.lastCameraY = camera.y;

    const ctx = this.background.ctx;
    ctx.clearRect(0, 0, this.background.canvas.width, this.background.canvas.height);

    for (let y = 0; y < this.rows; y += 1) {
      const wy = y + camera.y;
      const row = map[wy];
      if (!row) continue;
      for (let x = 0; x < this.cols; x += 1) {
        const tile = row[x + camera.x];
        if (!tile) continue;
        this.#drawGlyphToLayer(ctx, tile.char, tile.fg, tile.bg, x, y);
      }
    }
  }

  beginFrame() {
    this.entities.ctx.clearRect(0, 0, this.entities.canvas.width, this.entities.canvas.height);
    this.effects.ctx.clearRect(0, 0, this.effects.canvas.width, this.effects.canvas.height);
    this.ui.ctx.clearRect(0, 0, this.ui.canvas.width, this.ui.canvas.height);
  }

  drawEntityGlyph(char, fg, bg, x, y) {
    this.#drawGlyphToLayer(this.entities.ctx, char, fg, bg, x | 0, y | 0);
  }

  drawUiGlyph(char, fg, bg, x, y) {
    this.#drawGlyphToLayer(this.ui.ctx, char, fg, bg, x | 0, y | 0);
  }

  drawUiText(text, fg, bg, x, y) {
    for (let i = 0; i < text.length; i += 1) {
      this.drawUiGlyph(text[i], fg, bg, x + i, y);
    }
  }

  drawEffectText(text, fg, x, y, alpha = 1, bg = 'rgba(0,0,0,0)', style = null) {
    const ctx = this.effects.ctx;
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    if (clampedAlpha <= 0) return;

    const fontScale = Number.isFinite(style?.fontScale) ? style.fontScale : 1;
    const fontWeight = style?.fontWeight ?? '700';

    if (fontScale <= 1) {
      ctx.globalAlpha = clampedAlpha;
      for (let i = 0; i < text.length; i += 1) {
        this.#drawGlyphToLayer(ctx, text[i], fg, bg, (x + i) | 0, y | 0);
      }
      ctx.globalAlpha = 1;
      return;
    }

    ctx.save();
    ctx.globalAlpha = clampedAlpha;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `${fontWeight} ${Math.round(this.cellH * fontScale)}px monospace`;
    ctx.fillStyle = fg;
    ctx.fillText(text, x * this.cellW, y * this.cellH);
    ctx.restore();
  }

  composite() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.background.canvas, 0, 0);
    this.ctx.drawImage(this.entities.canvas, 0, 0);
    this.ctx.drawImage(this.effects.canvas, 0, 0);
    this.ctx.drawImage(this.ui.canvas, 0, 0);
  }
}
