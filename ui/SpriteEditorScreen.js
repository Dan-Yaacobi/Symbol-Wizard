import { Renderer } from '../engine/Renderer.js';
import {
  createEmptyCell,
  createEmptyFrame,
  createEmptySpriteAsset,
  ensureRequiredAnimations,
  isOccupiedSpriteCell,
  normalizeSpriteAsset,
  validateSpriteAsset,
  resizeFrame,
  resizeAnimationFrames,
  resizeSpriteAsset,
} from '../data/SpriteAssetSchema.js';
import { getAllSpriteAssets, getSpriteAsset, registerSpriteAsset, saveSpriteAsset } from '../data/SpriteAssetLoader.js';
import { convertXpToSpriteAsset } from '../data/SpriteXpImporter.js';

const PALETTE = ['#ffffff', '#d7e9ff', '#8ac3ff', '#ffd37c', '#73c57e', '#5faa66', '#bb4f4f', '#1b1b1b', '#173a1f', '#23374d', '#11263a', '#000000'];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function downloadText(fileName, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export class SpriteEditorScreen {
  constructor() {
    this.isOpen = false;
    this.asset = createEmptySpriteAsset('new-sprite', 7, 7);
    this.currentAnimation = 'idle';
    this.currentFrameIndex = 0;
    this.previewTimer = 0;
    this.previewFrameIndex = 0;
    this.previewPlaying = true;
    this.renderer = null;
    this.events = null;
    this.brush = { ch: '#', fg: '#ffffff', bg: null, paintChar: true, paintFg: true, paintBg: false };
    this.elements = this.#createUi();
  }

  async initialize() { this.#refreshSpriteList(); this.#syncUiFromAsset(); this.#renderEditor(); }
  open() { if (!this.isOpen) { this.isOpen = true; this.elements.root.hidden = false; this.#bindEvents(); this.#refreshSpriteList(); this.#renderEditor(); } }
  close() { if (this.isOpen) { this.isOpen = false; this.elements.root.hidden = true; this.events?.abort(); this.events = null; } }
  toggle() { this.isOpen ? this.close() : this.open(); }

  tick(dt = 0.016) {
    if (!this.isOpen || !this.previewPlaying) return;
    const frames = this.getCurrentAnimationFrames();
    if (frames.length <= 1) return;
    this.previewTimer += dt;
    if (this.previewTimer >= 0.2) {
      this.previewTimer = 0;
      this.previewFrameIndex = (this.previewFrameIndex + 1) % frames.length;
      this.#renderEditor();
    }
  }

  getCurrentAnimationFrames() { return this.asset.animations[this.currentAnimation] ?? []; }
  getCurrentFrame() { return this.getCurrentAnimationFrames()[this.currentFrameIndex] ?? null; }
  getPreviewFrame() { return this.getCurrentAnimationFrames()[this.previewFrameIndex] ?? this.getCurrentFrame(); }

  #bindEvents() {
    if (this.events) return;
    this.events = new AbortController();
    const { signal } = this.events;
    this.elements.closeButton.addEventListener('click', () => this.close(), { signal });
    this.elements.newButton.addEventListener('click', () => this.#loadAsset(createEmptySpriteAsset('new-sprite', 7, 7)), { signal });
    this.elements.spriteSelect.addEventListener('change', () => {
      const asset = getSpriteAsset(this.elements.spriteSelect.value);
      if (asset) this.#loadAsset(asset);
    }, { signal });
    this.elements.idInput.addEventListener('input', () => { const previousId = this.asset.id; this.asset.id = this.elements.idInput.value.trim() || 'sprite'; if (!this.asset.meta.enemyId || this.asset.meta.enemyId === previousId) this.asset.meta.enemyId = this.asset.id; this.#renderEditor(); }, { signal });
    this.elements.animationSelect.addEventListener('change', () => this.#switchAnimation(this.elements.animationSelect.value), { signal });
    this.elements.seedAction.addEventListener('click', () => this.#seedEmptyAnimation(), { signal });
    this.elements.copyFirstButton.addEventListener('click', () => this.#copyFromAnimation('first'), { signal });
    this.elements.copyAllButton.addEventListener('click', () => this.#copyFromAnimation('all'), { signal });
    this.elements.copyCurrentButton.addEventListener('click', () => this.#copyCurrentFrameToAnimation(), { signal });
    this.elements.addFrameButton.addEventListener('click', () => this.#insertFrame(createEmptyFrame(this.asset.defaultGrid.width, this.asset.defaultGrid.height)), { signal });
    this.elements.duplicateFrameButton.addEventListener('click', () => this.#insertFrame(clone(this.getCurrentFrame() ?? createEmptyFrame(this.asset.defaultGrid.width, this.asset.defaultGrid.height))), { signal });
    this.elements.removeFrameButton.addEventListener('click', () => this.#deleteCurrentFrame(), { signal });
    this.elements.prevFrameButton.addEventListener('click', () => this.#setFrameIndex(this.currentFrameIndex - 1), { signal });
    this.elements.nextFrameButton.addEventListener('click', () => this.#setFrameIndex(this.currentFrameIndex + 1), { signal });
    this.elements.frameSelect.addEventListener('change', () => this.#setFrameIndex(Number(this.elements.frameSelect.value) || 0), { signal });
    this.elements.clearFrameButton.addEventListener('click', () => { const frame = this.getCurrentFrame(); if (!frame) return; frame.cells = frame.cells.map((row) => row.map(() => createEmptyCell())); this.#renderEditor(); }, { signal });
    this.elements.playToggle.addEventListener('click', () => { this.previewPlaying = !this.previewPlaying; this.elements.playToggle.textContent = this.previewPlaying ? 'Pause Preview' : 'Play Preview'; }, { signal });
    this.elements.enemyToggle.addEventListener('change', () => { this.asset.meta.isEnemy = this.elements.enemyToggle.checked; if (!this.asset.meta.enemyId) this.asset.meta.enemyId = this.asset.id; this.#renderEditor(); }, { signal });
    this.elements.enemyId.addEventListener('input', () => { this.asset.meta.enemyId = this.elements.enemyId.value.trim() || this.asset.id || 'sprite'; this.#renderEditor(); }, { signal });
    this.elements.biomes.addEventListener('change', () => { this.asset.meta.biomes = [...this.elements.biomes.selectedOptions].map((option) => option.value); this.#renderEditor(); }, { signal });
    this.elements.spawnWeight.addEventListener('input', () => { this.asset.meta.spawnWeight = Math.max(1, Number(this.elements.spawnWeight.value) || 1); this.#renderEditor(); }, { signal });
    this.elements.anchorX.addEventListener('input', () => { this.asset.anchor.x = Number(this.elements.anchorX.value) || 0; this.#renderEditor(); }, { signal });
    this.elements.anchorY.addEventListener('input', () => { this.asset.anchor.y = Number(this.elements.anchorY.value) || 0; this.#renderEditor(); }, { signal });
    this.elements.offsetY.addEventListener('input', () => { const frame = this.getCurrentFrame(); if (frame) frame.offsetY = Number(this.elements.offsetY.value) || 0; this.#renderEditor(); }, { signal });
    this.elements.gridWidth.addEventListener('input', () => this.#syncResizePreview(), { signal });
    this.elements.gridHeight.addEventListener('input', () => this.#syncResizePreview(), { signal });
    this.elements.resizeScope.addEventListener('change', () => this.#syncResizePreview(), { signal });
    this.elements.resizeButton.addEventListener('click', () => this.#applyResize(), { signal });
    this.elements.charInput.addEventListener('input', () => { this.brush.ch = (this.elements.charInput.value || ' ')[0]; }, { signal });
    this.elements.fgInput.addEventListener('input', () => { this.brush.fg = this.elements.fgInput.value || null; }, { signal });
    this.elements.bgInput.addEventListener('input', () => { this.brush.bg = this.elements.bgInput.value || null; }, { signal });
    this.elements.paintChar.addEventListener('change', () => { this.brush.paintChar = this.elements.paintChar.checked; }, { signal });
    this.elements.paintFg.addEventListener('change', () => { this.brush.paintFg = this.elements.paintFg.checked; }, { signal });
    this.elements.paintBg.addEventListener('change', () => { this.brush.paintBg = this.elements.paintBg.checked; }, { signal });
    this.elements.eraseButton.addEventListener('click', () => { this.brush = { ...this.brush, ch: ' ', fg: null, bg: null, paintChar: true, paintFg: true, paintBg: true }; this.#syncBrushUi(); }, { signal });
    this.elements.exportButton.addEventListener('click', async () => { const text = await saveSpriteAsset(this.asset); this.elements.jsonArea.value = text; downloadText(`${this.asset.id}.json`, text); registerSpriteAsset(this.asset); this.#refreshSpriteList(); this.#setStatus(`Exported ${this.asset.id}.json`, false); }, { signal });
    this.elements.importJsonButton.addEventListener('click', () => { try { this.#loadAsset(JSON.parse(this.elements.jsonArea.value)); } catch (error) { this.#setStatus(error.message, true); } }, { signal });
    this.elements.xpInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const arrayBuffer = await file.arrayBuffer();
      const imported = await convertXpToSpriteAsset(arrayBuffer, { id: this.asset.id || file.name.replace(/\.xp$/i, ''), animation: this.currentAnimation, existingAsset: this.asset });
      this.#loadAsset(imported, this.currentAnimation);
      this.#setStatus(`Imported ${file.name} into ${this.currentAnimation}.`, false);
    }, { signal });
    this.elements.importXpButton.addEventListener('click', () => this.elements.xpInput.click(), { signal });
    this.elements.showAnchor.addEventListener('change', () => this.#renderEditor(), { signal });
    this.elements.showOccupied.addEventListener('change', () => this.#renderEditor(), { signal });
    this.elements.canvas.addEventListener('click', (event) => this.#paintAt(event), { signal });
  }

  #loadAsset(asset, animation = null) {
    this.asset = ensureRequiredAnimations(normalizeSpriteAsset(clone(asset)));
    this.currentAnimation = this.asset.animations[animation] ? animation : (this.currentAnimation in this.asset.animations ? this.currentAnimation : 'idle');
    this.currentFrameIndex = Math.min(this.currentFrameIndex, Math.max(0, this.getCurrentAnimationFrames().length - 1));
    this.previewFrameIndex = this.currentFrameIndex;
    this.#syncUiFromAsset();
    this.#renderEditor();
  }

  #switchAnimation(animationName) {
    this.currentAnimation = animationName;
    if (this.getCurrentAnimationFrames().length === 0) this.currentFrameIndex = 0;
    else this.currentFrameIndex = Math.min(this.currentFrameIndex, this.getCurrentAnimationFrames().length - 1);
    this.previewFrameIndex = this.currentFrameIndex;
    this.#syncUiFromAsset();
    this.#renderEditor();
  }

  #seedEmptyAnimation() {
    const frames = this.getCurrentAnimationFrames();
    if (frames.length > 0) return;
    const source = this.asset.animations[this.elements.copySource.value] ?? [];
    if (source.length > 0) {
      this.asset.animations[this.currentAnimation] = [clone(source[0])];
    } else {
      this.asset.animations[this.currentAnimation] = [createEmptyFrame(this.asset.defaultGrid.width, this.asset.defaultGrid.height)];
    }
    this.currentFrameIndex = 0;
    this.previewFrameIndex = 0;
    this.#renderEditor();
  }

  #copyFromAnimation(mode) {
    const sourceAnimation = this.elements.copySource.value;
    const sourceFrames = this.asset.animations[sourceAnimation] ?? [];
    if (!sourceFrames.length) return this.#setStatus(`Animation ${sourceAnimation} has no frames to copy.`, true);
    this.asset.animations[this.currentAnimation] = mode === 'all' ? clone(sourceFrames) : [clone(sourceFrames[0])];
    this.currentFrameIndex = 0;
    this.previewFrameIndex = 0;
    this.#renderEditor();
  }

  #copyCurrentFrameToAnimation() {
    const targetAnimation = this.elements.copyTarget.value;
    const frame = this.getCurrentFrame();
    if (!frame || !targetAnimation) return;
    this.asset.animations[targetAnimation].push(clone(frame));
    this.#setStatus(`Copied current frame to ${targetAnimation}.`, false);
    this.#syncUiFromAsset();
    this.#renderEditor();
  }

  #insertFrame(frame) {
    const frames = this.getCurrentAnimationFrames();
    const insertAt = frames.length ? this.currentFrameIndex + 1 : 0;
    frames.splice(insertAt, 0, frame);
    this.currentFrameIndex = insertAt;
    this.previewFrameIndex = insertAt;
    this.#renderEditor();
  }

  #deleteCurrentFrame() {
    const frames = this.getCurrentAnimationFrames();
    if (!frames.length) return;
    frames.splice(this.currentFrameIndex, 1);
    this.currentFrameIndex = Math.max(0, Math.min(this.currentFrameIndex, frames.length - 1));
    this.previewFrameIndex = this.currentFrameIndex;
    this.#renderEditor();
  }

  #setFrameIndex(index) {
    const frames = this.getCurrentAnimationFrames();
    if (!frames.length) return;
    this.currentFrameIndex = (index + frames.length) % frames.length;
    this.previewFrameIndex = this.currentFrameIndex;
    this.#renderEditor();
  }

  #syncResizePreview() {
    this.elements.resizeHint.textContent = 'Resize uses top-left pinning; existing art stays aligned to the upper-left and new cells are empty.';
  }

  #applyResize() {
    const width = Number(this.elements.gridWidth.value) || this.asset.defaultGrid.width;
    const height = Number(this.elements.gridHeight.value) || this.asset.defaultGrid.height;
    const scope = this.elements.resizeScope.value;
    if (scope === 'current frame') {
      const frame = this.getCurrentFrame();
      if (!frame) return;
      this.asset.animations[this.currentAnimation][this.currentFrameIndex] = resizeFrame(frame, width, height, { pin: 'top-left' });
      this.asset.defaultGrid = { width, height };
    } else if (scope === 'current animation') {
      this.asset.animations[this.currentAnimation] = resizeAnimationFrames(this.getCurrentAnimationFrames(), width, height, { pin: 'top-left' });
      this.asset.defaultGrid = { width, height };
    } else {
      this.asset = resizeSpriteAsset(this.asset, width, height, 'whole sprite asset', { pin: 'top-left' });
    }
    this.#syncUiFromAsset();
    this.#renderEditor();
  }

  #paintAt(event) {
    const frame = this.getCurrentFrame();
    if (!frame) return;
    const rect = this.elements.canvas.getBoundingClientRect();
    const scale = this.elements.canvas.width / rect.width;
    const x = Math.floor(((event.clientX - rect.left) * scale - 16) / 24);
    const y = Math.floor(((event.clientY - rect.top) * scale - 16) / 24);
    if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return;
    const cell = { ...frame.cells[y][x] };
    if (this.brush.paintChar) cell.ch = this.brush.ch ?? ' ';
    if (this.brush.paintFg) cell.fg = this.brush.fg;
    if (this.brush.paintBg) cell.bg = this.brush.bg;
    frame.cells[y][x] = cell;
    this.#renderEditor();
  }

  #setStatus(message, error = false) { this.elements.status.textContent = message; this.elements.status.dataset.error = error ? '1' : '0'; }

  #syncEnemyMetaUi() {
    this.elements.enemyToggle.checked = Boolean(this.asset.meta?.isEnemy);
    this.elements.enemyId.value = this.asset.meta?.enemyId ?? this.asset.id;
    this.elements.spawnWeight.value = String(this.asset.meta?.spawnWeight ?? 1);
    const selectedBiomes = new Set(this.asset.meta?.biomes ?? []);
    for (const option of this.elements.biomes.options) option.selected = selectedBiomes.has(option.value);
  }
  #syncBrushUi() {
    this.elements.charInput.value = this.brush.ch === ' ' ? '' : this.brush.ch;
    this.elements.fgInput.value = this.brush.fg ?? '#ffffff';
    this.elements.bgInput.value = this.brush.bg ?? '#000000';
    this.elements.paintChar.checked = this.brush.paintChar;
    this.elements.paintFg.checked = this.brush.paintFg;
    this.elements.paintBg.checked = this.brush.paintBg;
  }

  #refreshSpriteList() {
    const current = this.elements.spriteSelect.value;
    const assets = getAllSpriteAssets().sort((a, b) => a.id.localeCompare(b.id));
    this.elements.spriteSelect.innerHTML = '<option value="">Load sprite…</option>' + assets.map((asset) => `<option value="${asset.id}">${asset.id}</option>`).join('');
    this.elements.spriteSelect.value = current;
  }

  #syncUiFromAsset() {
    ensureRequiredAnimations(this.asset);
    this.elements.idInput.value = this.asset.id;
    this.#syncEnemyMetaUi();
    this.elements.anchorX.value = String(this.asset.anchor.x ?? 0);
    this.elements.anchorY.value = String(this.asset.anchor.y ?? 0);
    this.elements.animationSelect.innerHTML = Object.keys(this.asset.animations).map((name) => `<option value="${name}">${name}</option>`).join('');
    this.elements.animationSelect.value = this.currentAnimation;
    this.elements.copySource.innerHTML = Object.keys(this.asset.animations).filter((name) => name !== this.currentAnimation).map((name) => `<option value="${name}">${name}</option>`).join('');
    this.elements.copyTarget.innerHTML = Object.keys(this.asset.animations).filter((name) => name !== this.currentAnimation).map((name) => `<option value="${name}">${name}</option>`).join('');
    this.elements.frameSelect.innerHTML = this.getCurrentAnimationFrames().map((_, index) => `<option value="${index}">Frame ${index + 1}</option>`).join('');
    if (this.getCurrentAnimationFrames().length > 0) this.elements.frameSelect.value = String(this.currentFrameIndex);
    this.elements.frameLabel.textContent = `${this.currentFrameIndex + 1}/${Math.max(1, this.getCurrentAnimationFrames().length)}`;
    this.elements.offsetY.value = String(this.getCurrentFrame()?.offsetY ?? 0);
    this.elements.gridWidth.value = String(this.asset.defaultGrid.width);
    this.elements.gridHeight.value = String(this.asset.defaultGrid.height);
    this.elements.emptyAnimationActions.hidden = this.getCurrentAnimationFrames().length > 0;
    this.#syncBrushUi();
    const validation = validateSpriteAsset(this.asset);
    this.#setStatus(validation.valid ? 'Sprite asset ready.' : validation.errors.join(' '), !validation.valid);
    this.elements.jsonArea.value = JSON.stringify(this.asset, null, 2);
  }

  #renderEditor() {
    this.#syncUiFromAsset();
    const editorFrame = this.getCurrentFrame() ?? createEmptyFrame(this.asset.defaultGrid.width, this.asset.defaultGrid.height);
    const previewFrame = this.getPreviewFrame() ?? editorFrame;
    const cellPx = 24;
    const padding = 16;
    this.elements.canvas.width = editorFrame.width * cellPx + padding * 2;
    this.elements.canvas.height = editorFrame.height * cellPx + padding * 2;
    const ctx = this.elements.canvas.getContext('2d');
    ctx.fillStyle = '#0b1016';
    ctx.fillRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
    for (let y = 0; y < editorFrame.height; y += 1) {
      for (let x = 0; x < editorFrame.width; x += 1) {
        const px = padding + x * cellPx;
        const py = padding + y * cellPx;
        const cell = editorFrame.cells[y][x];
        ctx.fillStyle = cell.bg ?? '#101826';
        ctx.fillRect(px, py, cellPx - 1, cellPx - 1);
        ctx.strokeStyle = '#30415d';
        ctx.strokeRect(px + 0.5, py + 0.5, cellPx - 1, cellPx - 1);
        if (cell.ch && cell.ch !== ' ') {
          ctx.fillStyle = cell.fg ?? '#ffffff';
          ctx.font = '18px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cell.ch, px + cellPx / 2, py + cellPx / 2);
        }
      }
    }
    const previewCanvas = this.elements.previewCanvas;
    const renderCols = previewFrame.width + 4;
    const renderRows = previewFrame.height + 4;
    previewCanvas.width = renderCols * 16;
    previewCanvas.height = renderRows * 16;
    if (!this.renderer || this.renderer.cols !== renderCols || this.renderer.rows !== renderRows || this.renderer.cellW !== 16) {
      this.renderer = new Renderer(previewCanvas, renderCols, renderRows, 16, 16);
    }
    this.renderer.beginFrame();
    this.renderer.background.ctx.fillStyle = '#0b1016';
    this.renderer.background.ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    for (let y = 0; y < previewFrame.height; y += 1) {
      for (let x = 0; x < previewFrame.width; x += 1) {
        const cell = previewFrame.cells[y][x];
        if (cell.bg || (cell.ch && cell.ch !== ' ')) this.renderer.drawEntityGlyph(cell.ch ?? ' ', cell.fg ?? '#ffffff', cell.bg, x + 2, y + 2);
        if (isOccupiedSpriteCell(cell) && this.elements.showOccupied.checked) this.renderer.drawEntityGlyph('·', '#6dff8d', null, x + 2, y + 2);
      }
    }
    if (this.elements.showAnchor.checked) this.renderer.drawEntityGlyph('◎', '#ff7ee2', null, 2 + (this.asset.anchor.x ?? 0), 2 + (this.asset.anchor.y ?? 0));
    this.renderer.composite();
  }

  #createUi() {
    const root = document.createElement('aside');
    root.className = 'sprite-editor';
    root.hidden = true;
    root.innerHTML = `
      <div class="sprite-editor__panel">
        <header><h2>Sprite Editor (F7)</h2><div class="sprite-editor__toolbar"><button type="button" data-new>New</button><button type="button" data-close>Close</button></div></header>
        <section class="sprite-editor__left">
          <label>Load Existing <select data-sprite-select></select></label>
          <label>Sprite ID <input data-id type="text"></label>
          <div class="sprite-editor__row"><label><input data-enemy-toggle type="checkbox"> Enemy</label><label>Enemy ID <input data-enemy-id type="text" placeholder="Defaults to sprite id"></label><label>Spawn Weight <input data-spawn-weight type="number" min="1" step="1"></label></div>
          <div class="sprite-editor__row"><label>Biomes <select data-biomes multiple size="4"><option value="forest">forest</option><option value="cave">cave</option><option value="river">river</option><option value="mountain">mountain</option></select></label></div>
          <div class="sprite-editor__row"><label>Anchor X <input data-anchor-x type="number"></label><label>Anchor Y <input data-anchor-y type="number"></label><label>Frame offsetY <input data-offset-y type="number"></label></div>
          <div class="sprite-editor__row"><label>Animation <select data-animation></select></label><button type="button" data-import-xp>Import XP</button><input data-xp-input type="file" accept=".xp" hidden></div>
          <div data-empty-animation-actions class="sprite-editor__stack" hidden>
            <strong>Empty animation tools</strong>
            <div class="sprite-editor__row"><label>Copy source <select data-copy-source></select></label><button type="button" data-seed-action>Create from source</button></div>
            <div class="sprite-editor__row"><button type="button" data-copy-first>Copy first frame</button><button type="button" data-copy-all>Copy all frames</button></div>
          </div>
          <div class="sprite-editor__row"><button type="button" data-prev-frame>◀</button><select data-frame-select></select><span data-frame-label>1/1</span><button type="button" data-next-frame>▶</button><button type="button" data-add-frame>Add</button><button type="button" data-duplicate-frame>Duplicate</button><button type="button" data-remove-frame>Remove</button><button type="button" data-clear-frame>Clear</button></div>
          <div class="sprite-editor__row"><label>Copy current to <select data-copy-target></select></label><button type="button" data-copy-current>Copy frame</button></div>
          <div class="sprite-editor__stack"><strong>Grid resize</strong><div class="sprite-editor__row"><label>Width <input data-grid-width type="number" min="1"></label><label>Height <input data-grid-height type="number" min="1"></label><label>Scope <select data-resize-scope><option>current frame</option><option>current animation</option><option selected>whole sprite asset</option></select></label><button type="button" data-resize>Resize</button></div><div data-resize-hint class="sprite-editor__hint"></div></div>
          <canvas data-editor-canvas></canvas>
          <div class="sprite-editor__brush">
            <label>Char <input data-char type="text" maxlength="1"></label>
            <label>FG <input data-fg type="color" value="#ffffff"></label>
            <label>BG <input data-bg type="color" value="#000000"></label>
            <label><input data-paint-char type="checkbox" checked> paint char</label>
            <label><input data-paint-fg type="checkbox" checked> paint fg</label>
            <label><input data-paint-bg type="checkbox"> paint bg</label>
            <button type="button" data-erase>Erase Brush</button>
          </div>
          <div class="sprite-editor__swatches">${PALETTE.map((color) => `<button type="button" class="sprite-editor__swatch" data-color="${color}" style="background:${color}"></button>`).join('')}</div>
        </section>
        <section class="sprite-editor__right">
          <div class="sprite-editor__row"><button type="button" data-play-toggle>Pause Preview</button><label><input data-show-anchor type="checkbox" checked> show anchor</label><label><input data-show-occupied type="checkbox" checked> show occupied</label></div>
          <canvas data-preview-canvas></canvas>
          <div class="sprite-editor__row"><button type="button" data-export>Export JSON</button><button type="button" data-import-json>Load JSON</button></div>
          <textarea data-json rows="18"></textarea>
          <div data-status class="sprite-editor__status"></div>
        </section>
      </div>`;
    document.body.appendChild(root);
    const elements = {
      root,
      closeButton: root.querySelector('[data-close]'),
      newButton: root.querySelector('[data-new]'),
      spriteSelect: root.querySelector('[data-sprite-select]'),
      idInput: root.querySelector('[data-id]'),
      enemyToggle: root.querySelector('[data-enemy-toggle]'),
      enemyId: root.querySelector('[data-enemy-id]'),
      biomes: root.querySelector('[data-biomes]'),
      spawnWeight: root.querySelector('[data-spawn-weight]'),
      anchorX: root.querySelector('[data-anchor-x]'),
      anchorY: root.querySelector('[data-anchor-y]'),
      offsetY: root.querySelector('[data-offset-y]'),
      animationSelect: root.querySelector('[data-animation]'),
      emptyAnimationActions: root.querySelector('[data-empty-animation-actions]'),
      copySource: root.querySelector('[data-copy-source]'),
      copyTarget: root.querySelector('[data-copy-target]'),
      seedAction: root.querySelector('[data-seed-action]'),
      copyFirstButton: root.querySelector('[data-copy-first]'),
      copyAllButton: root.querySelector('[data-copy-all]'),
      copyCurrentButton: root.querySelector('[data-copy-current]'),
      prevFrameButton: root.querySelector('[data-prev-frame]'),
      nextFrameButton: root.querySelector('[data-next-frame]'),
      frameSelect: root.querySelector('[data-frame-select]'),
      frameLabel: root.querySelector('[data-frame-label]'),
      addFrameButton: root.querySelector('[data-add-frame]'),
      duplicateFrameButton: root.querySelector('[data-duplicate-frame]'),
      removeFrameButton: root.querySelector('[data-remove-frame]'),
      clearFrameButton: root.querySelector('[data-clear-frame]'),
      gridWidth: root.querySelector('[data-grid-width]'),
      gridHeight: root.querySelector('[data-grid-height]'),
      resizeScope: root.querySelector('[data-resize-scope]'),
      resizeButton: root.querySelector('[data-resize]'),
      resizeHint: root.querySelector('[data-resize-hint]'),
      canvas: root.querySelector('[data-editor-canvas]'),
      charInput: root.querySelector('[data-char]'),
      fgInput: root.querySelector('[data-fg]'),
      bgInput: root.querySelector('[data-bg]'),
      paintChar: root.querySelector('[data-paint-char]'),
      paintFg: root.querySelector('[data-paint-fg]'),
      paintBg: root.querySelector('[data-paint-bg]'),
      eraseButton: root.querySelector('[data-erase]'),
      importXpButton: root.querySelector('[data-import-xp]'),
      xpInput: root.querySelector('[data-xp-input]'),
      previewCanvas: root.querySelector('[data-preview-canvas]'),
      playToggle: root.querySelector('[data-play-toggle]'),
      showAnchor: root.querySelector('[data-show-anchor]'),
      showOccupied: root.querySelector('[data-show-occupied]'),
      exportButton: root.querySelector('[data-export]'),
      importJsonButton: root.querySelector('[data-import-json]'),
      jsonArea: root.querySelector('[data-json]'),
      status: root.querySelector('[data-status]'),
    };
    root.querySelectorAll('.sprite-editor__swatch').forEach((button) => button.addEventListener('click', () => { this.brush.fg = button.dataset.color; elements.fgInput.value = button.dataset.color; }));
    return elements;
  }
}
