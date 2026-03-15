import { toSafeGlyph, visualTheme } from '../data/VisualTheme.js';

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

    this.fontAtlas = new Image();
    this.fontLoadFailed = false;
    this.debugFontAtlas = Boolean(globalThis?.location?.search?.includes('debugFontAtlas=1'));
    this.fontAtlas.src = 'assets/fonts/cp437_8x8.png';
    this.fontReady = false;
    this.fontAtlas.onload = () => {
      const width = this.fontAtlas.naturalWidth;
      const height = this.fontAtlas.naturalHeight;

      if (width > 0 && height > 0) {
        this.glyphW = Math.max(1, Math.floor(width / this.fontCols));
        this.glyphH = Math.max(1, Math.floor(height / this.fontRows));
      }

      this.fontReady = true;
      this.glyphCache.clear();
      this.#logFontAtlasState('onload');
      this.#debugGlyphCoords();
    };
    this.fontAtlas.onerror = () => {
      this.fontLoadFailed = true;
      this.fontReady = false;
      this.glyphCache.clear();
      this.#logFontAtlasState('onerror');
    };
    this.fontCols = 16;
    this.fontRows = 16;
    this.glyphW = this.cellW;
    this.glyphH = this.cellH;

    this.ctx.imageSmoothingEnabled = false;
    this.background.ctx.imageSmoothingEnabled = false;
    this.entities.ctx.imageSmoothingEnabled = false;
    this.effects.ctx.imageSmoothingEnabled = false;
    this.ui.ctx.imageSmoothingEnabled = false;
  }

  static CP437_EXTENDED_MAP = {
    '☺': 1, '☻': 2, '♥': 3, '♦': 4, '♣': 5, '♠': 6, '•': 7,
    '◘': 8, '○': 9, '◙': 10, '♂': 11, '♀': 12, '♪': 13, '♫': 14, '☼': 15,
    '►': 16, '◄': 17, '↕': 18, '‼': 19, '¶': 20, '§': 21, '▬': 22, '↨': 23,
    '↑': 24, '↓': 25, '→': 26, '←': 27, '∟': 28, '↔': 29, '▲': 30, '▼': 31,
    'Ç': 128, 'ü': 129, 'é': 130, 'â': 131, 'ä': 132, 'à': 133, 'å': 134, 'ç': 135,
    'ê': 136, 'ë': 137, 'è': 138, 'ï': 139, 'î': 140, 'ì': 141, 'Ä': 142, 'Å': 143,
    'É': 144, 'æ': 145, 'Æ': 146, 'ô': 147, 'ö': 148, 'ò': 149, 'û': 150, 'ù': 151,
    'ÿ': 152, 'Ö': 153, 'Ü': 154, '¢': 155, '£': 156, '¥': 157, '₧': 158, 'ƒ': 159,
    'á': 160, 'í': 161, 'ó': 162, 'ú': 163, 'ñ': 164, 'Ñ': 165, 'ª': 166, 'º': 167,
    '¿': 168, '⌐': 169, '¬': 170, '½': 171, '¼': 172, '¡': 173, '«': 174, '»': 175,
    '░': 176, '▒': 177, '▓': 178, '│': 179, '┤': 180, '╡': 181, '╢': 182, '╖': 183,
    '╕': 184, '╣': 185, '║': 186, '╗': 187, '╝': 188, '╜': 189, '╛': 190, '┐': 191,
    '└': 192, '┴': 193, '┬': 194, '├': 195, '─': 196, '┼': 197, '╞': 198, '╟': 199,
    '╚': 200, '╔': 201, '╩': 202, '╦': 203, '╠': 204, '═': 205, '╬': 206, '╧': 207,
    '╨': 208, '╤': 209, '╥': 210, '╙': 211, '╘': 212, '╒': 213, '╓': 214, '╫': 215,
    '╪': 216, '┘': 217, '┌': 218, '█': 219, '▄': 220, '▌': 221, '▐': 222, '▀': 223,
    'α': 224, 'ß': 225, 'Γ': 226, 'π': 227, 'Σ': 228, 'σ': 229, 'µ': 230, 'τ': 231,
    'Φ': 232, 'Θ': 233, 'Ω': 234, 'δ': 235, '∞': 236, 'φ': 237, 'ε': 238, '∩': 239,
    '≡': 240, '±': 241, '≥': 242, '≤': 243, '⌠': 244, '⌡': 245, '÷': 246, '≈': 247,
    '°': 248, '∙': 249, '·': 250, '√': 251, 'ⁿ': 252, '²': 253, '■': 254, ' ': 255,
  };

  #logFontAtlasState(stage) {
    if (!this.debugFontAtlas) return;
    console.debug(`[Renderer] font atlas ${stage}`, {
      src: this.fontAtlas.src,
      complete: this.fontAtlas.complete,
      naturalWidth: this.fontAtlas.naturalWidth,
      naturalHeight: this.fontAtlas.naturalHeight,
      fontReady: this.fontReady,
      glyphW: this.glyphW,
      glyphH: this.glyphH,
    });
  }

  #debugGlyphCoords() {
    if (!this.debugFontAtlas) return;
    ['.', '#', '~', '♣'].forEach((char) => {
      const coords = this.#getGlyphCoords(char);
      console.debug('[Renderer] glyph coords', { char, ...(coords ?? { valid: false }) });
    });
  }

  #parseHexColorToRgb(color, fallbackHex = '#ffffff') {
    const source = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color ?? '') ? color : fallbackHex;
    const value = source.slice(1);
    if (value.length === 3) {
      return {
        r: Number.parseInt(value[0] + value[0], 16),
        g: Number.parseInt(value[1] + value[1], 16),
        b: Number.parseInt(value[2] + value[2], 16),
      };
    }
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
    };
  }

  #createLayer() {
    const canvas = document.createElement('canvas');
    canvas.width = this.cols * this.cellW;
    canvas.height = this.rows * this.cellH;
    const ctx = canvas.getContext('2d', { alpha: true });
    return { canvas, ctx };
  }

  #cacheKey(char, fg, bg) {
    return `${char}|${fg}|${bg}`;
  }

  #getGlyphCoords(char) {
    const code = this.#toCp437Code(char);
    if (!Number.isInteger(code) || code < 0 || code >= this.fontCols * this.fontRows) {
      return null;
    }

    const sx = (code % this.fontCols) * this.glyphW;
    const sy = Math.floor(code / this.fontCols) * this.glyphH;

    if (this.fontReady) {
      if (sx + this.glyphW > this.fontAtlas.naturalWidth) return null;
      if (sy + this.glyphH > this.fontAtlas.naturalHeight) return null;
    }

    return { code, sx, sy };
  }

  #toCp437Code(char) {
    if (!char || typeof char !== 'string') return 32;
    const ch = toSafeGlyph(char);
    const asciiCode = ch.charCodeAt(0);
    if (asciiCode >= 0 && asciiCode <= 127) {
      return asciiCode;
    }
    return Renderer.CP437_EXTENDED_MAP[ch] ?? 63;
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

    tctx.fillStyle = bg;
    tctx.fillRect(0, 0, this.cellW, this.cellH);

    if (this.fontReady && char !== ' ') {
      const coords = this.#getGlyphCoords(char);
      if (!coords) {
        return tile;
      }
      const { sx, sy } = coords;

      const glyphMask = document.createElement('canvas');
      glyphMask.width = this.cellW;
      glyphMask.height = this.cellH;
      const gctx = glyphMask.getContext('2d', { alpha: true });
      gctx.imageSmoothingEnabled = false;

      gctx.drawImage(
        this.fontAtlas,
        sx,
        sy,
        this.glyphW,
        this.glyphH,
        0,
        0,
        this.cellW,
        this.cellH,
      );

      if (this.debugFontAtlas && ['.', '#', '~', '♣'].includes(char)) {
        console.debug('[Renderer] drawImage sample region', {
          char,
          sx,
          sy,
          sourceW: this.glyphW,
          sourceH: this.glyphH,
          destW: this.cellW,
          destH: this.cellH,
        });
      }

      const glyphData = gctx.getImageData(0, 0, this.cellW, this.cellH);
      const pixels = glyphData.data;
      const { r, g, b } = this.#parseHexColorToRgb(fg);
      for (let i = 0; i < pixels.length; i += 4) {
        const mask = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = mask;
      }
      gctx.putImageData(glyphData, 0, 0);

      tctx.drawImage(glyphMask, 0, 0);
    } else if (char !== ' ') {
      tctx.font = `${this.cellH}px monospace`;
      tctx.fillStyle = fg;
      tctx.textBaseline = 'top';
      tctx.fillText(char, 0, 0);
    }

    if (!this.fontReady && !this.fontLoadFailed) {
      return tile;
    }

    this.glyphCache.set(key, tile);
    return tile;
  }

  #drawGlyphToLayer(layerCtx, char, fg, bg, cellX, cellY) {
    const pixelX = cellX * this.cellW;
    const pixelY = cellY * this.cellH;
    this.#drawGlyphToLayerPx(layerCtx, char, fg, bg, pixelX, pixelY);
  }

  #drawGlyphToLayerPx(layerCtx, char, fg, bg, pixelX, pixelY) {
    if (pixelX <= -this.cellW || pixelY <= -this.cellH) return;
    if (pixelX >= this.cols * this.cellW || pixelY >= this.rows * this.cellH) return;
    const tile = this.#getGlyph(char, fg, bg);
    layerCtx.drawImage(tile, Math.round(pixelX), Math.round(pixelY));
  }

  renderBackground(map, camera) {
    const cameraTileX = Math.floor(camera.x);
    const cameraTileY = Math.floor(camera.y);
    const cameraOffsetX = (camera.x - cameraTileX) * this.cellW;
    const cameraOffsetY = (camera.y - cameraTileY) * this.cellH;

    const ctx = this.background.ctx;
    ctx.clearRect(0, 0, this.background.canvas.width, this.background.canvas.height);

    const fallbackTile = { char: ' ', fg: visualTheme.colors.floorFg, bg: visualTheme.colors.worldBackground };
    const mapHeight = map?.length ?? 0;

    for (let screenY = -1; screenY <= this.rows; screenY += 1) {
      const worldY = cameraTileY + screenY;
      const row = worldY >= 0 && worldY < mapHeight ? map[worldY] : null;

      for (let screenX = -1; screenX <= this.cols; screenX += 1) {
        const worldX = cameraTileX + screenX;
        const tile = row?.[worldX] ?? fallbackTile;
        const pixelX = screenX * this.cellW - cameraOffsetX;
        const pixelY = screenY * this.cellH - cameraOffsetY;
        this.#drawGlyphToLayerPx(ctx, tile.char, tile.fg, tile.bg, pixelX, pixelY);
      }
    }
  }

  beginFrame() {
    this.entities.ctx.clearRect(0, 0, this.entities.canvas.width, this.entities.canvas.height);
    this.effects.ctx.clearRect(0, 0, this.effects.canvas.width, this.effects.canvas.height);
    this.ui.ctx.clearRect(0, 0, this.ui.canvas.width, this.ui.canvas.height);
  }

  drawEntityGlyph(char, fg, bg, x, y) {
    this.#drawGlyphToLayerPx(this.entities.ctx, char, fg, bg, x * this.cellW, y * this.cellH);
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

    for (let i = 0; i < text.length; i += 1) {
      const glyph = this.#getGlyph(text[i], fg, bg);
      const pixelX = (x + i) * this.cellW;
      const pixelY = y * this.cellH;
      const glyphWidth = this.cellW * fontScale;
      const glyphHeight = this.cellH * fontScale;
      ctx.drawImage(glyph, pixelX, pixelY, glyphWidth, glyphHeight);
    }

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
