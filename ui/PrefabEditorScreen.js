import { Renderer } from '../engine/Renderer.js';
import {
  DEFAULT_PREFAB_METADATA,
  buildPrefabFromXP,
  generateDestructionFrames,
  parseXPFromArrayBuffer,
} from '../world/PrefabPipeline.js';
import { registerPrefabObject, getObjectDefinition } from '../world/ObjectLibrary.js';

const BIOME_TAGS = ['forest', 'taiga', 'swamp', 'plains', 'mountain', 'cave', 'ruins', 'village'];
const MATERIALS = ['wood', 'stone', 'metal', 'crystal', 'bone', 'plant'];
const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rgb(color) {
  if (Array.isArray(color)) return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  return color ?? 'rgb(255,255,255)';
}

function readNumber(input, fallback) {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

async function saveTextFile(root, fileName, content) {
  const handle = await root.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

function downloadText(fileName, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export class PrefabEditorScreen {
  constructor() {
    this.isOpen = false;
    this.autoCrop = true;
    this.overlayVisual = true;
    this.overlayCollision = false;
    this.overlayInteraction = false;
    this.zoom = 2;
    this.loadedXp = null;
    this.prefab = null;
    this.currentFileName = '';
    this.registryIds = new Set();
    this.fsRoot = null;
    this.renderer = null;
    this.sessionEventsController = null;
    this.elements = this.#createUi();
  }

  async initialize() {
    try {
      const response = await fetch('./assets/objects/registry.json', { cache: 'no-cache' });
      if (response.ok) {
        const registry = await response.json();
        for (const file of registry.objects ?? []) {
          this.registryIds.add(String(file).replace(/\.json$/i, ''));
        }
      }
    } catch {
      // best effort only
    }
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.#bindEvents();
    this.elements.root.hidden = false;
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.#unbindEvents();
    this.elements.root.hidden = true;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  #bindEvents() {
    if (this.sessionEventsController) return;
    this.sessionEventsController = new AbortController();
    const { signal } = this.sessionEventsController;

    this.elements.importInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await this.#loadXpFile(file);
    }, { signal });

    this.elements.importButton.addEventListener('click', () => this.elements.importInput.click(), { signal });

    this.elements.saveButton.addEventListener('click', async () => {
      await this.#savePrefab();
    }, { signal });

    this.elements.zoomInput.addEventListener('input', () => {
      this.zoom = clamp(Number(this.elements.zoomInput.value) || 2, 1, 6);
      this.elements.zoomValue.textContent = `${this.zoom}x`;
      this.#renderPreview();
    }, { signal });

    this.elements.objectId.addEventListener('input', () => {
      this.#syncMetadata();
      this.#validateObjectId();
    }, { signal });

    const syncFields = [
      this.elements.spawnWeight,
      this.elements.clusterMin,
      this.elements.clusterMax,
      this.elements.clusterRadius,
      this.elements.hp,
      this.elements.material,
      this.elements.dropTable,
      this.elements.destructible,
      this.elements.autoCrop,
    ];
    syncFields.forEach((element) => element.addEventListener('change', () => this.#syncMetadata(), { signal }));

    this.elements.tags.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.#syncMetadata(), { signal });
    });

    this.elements.rarity.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.addEventListener('change', () => this.#syncMetadata(), { signal });
    });

    this.elements.overlayVisual.addEventListener('change', () => {
      this.overlayVisual = this.elements.overlayVisual.checked;
      this.#renderPreview();
    }, { signal });
    this.elements.overlayCollision.addEventListener('change', () => {
      this.overlayCollision = this.elements.overlayCollision.checked;
      this.#renderPreview();
    }, { signal });
    this.elements.overlayInteraction.addEventListener('change', () => {
      this.overlayInteraction = this.elements.overlayInteraction.checked;
      this.#renderPreview();
    }, { signal });

    this.elements.closeButton.addEventListener('click', () => this.close(), { signal });
  }

  #unbindEvents() {
    this.sessionEventsController?.abort();
    this.sessionEventsController = null;
  }

  #createUi() {
    const root = document.createElement('aside');
    root.className = 'prefab-editor';
    root.hidden = true;
    root.innerHTML = `
      <div class="prefab-editor__panel">
        <header><h2>Object Editor (F6)</h2><button type="button" data-close>Close</button></header>
        <section class="prefab-editor__preview">
          <div class="prefab-editor__preview-header">
            <strong>RexPaint Object Preview</strong>
            <div>Size: <span data-size>0x0</span></div>
          </div>
          <canvas data-preview-canvas width="384" height="256"></canvas>
          <div class="prefab-editor__toggles">
            <label><input type="checkbox" data-overlay-visual checked> Visual</label>
            <label><input type="checkbox" data-overlay-collision> Collision</label>
            <label><input type="checkbox" data-overlay-interaction> Interaction</label>
            <label>Zoom <input type="range" min="1" max="6" value="2" data-zoom> <span data-zoom-value>2x</span></label>
          </div>
        </section>
        <section class="prefab-editor__form"></section>
      </div>
    `;

    const form = root.querySelector('.prefab-editor__form');
    form.innerHTML = `
      <label>Object ID <input data-object-id type="text" placeholder="pine_tree"></label>
      <div data-object-id-warning class="prefab-editor__warning"></div>
      <div><strong>Tags</strong><div data-tags class="prefab-editor__tags"></div></div>
      <label>Spawn Weight <input data-spawn-weight type="number" value="10"></label>
      <label>Cluster Min <input data-cluster-min type="number" value="1"></label>
      <label>Cluster Max <input data-cluster-max type="number" value="3"></label>
      <label>Cluster Radius <input data-cluster-radius type="number" value="2"></label>
      <fieldset data-rarity><legend>Rarity</legend></fieldset>
      <label><input data-destructible type="checkbox" checked> Destructible</label>
      <label>HP <input data-hp type="number" value="10"></label>
      <label>Material
        <select data-material>${MATERIALS.map((material) => `<option value="${material}">${material}</option>`).join('')}</select>
      </label>
      <label>Drop Table <input data-drop-table type="text" value="none"></label>
      <label><input data-auto-crop type="checkbox" checked> Auto-crop sprite</label>
      <div class="prefab-editor__actions">
        <button type="button" data-import>IMPORT XP</button>
        <button type="button" data-save>SAVE PREFAB</button>
      </div>
      <div data-status class="prefab-editor__status"></div>
      <input data-import-input type="file" accept=".xp" hidden>
    `;

    const tagsRoot = form.querySelector('[data-tags]');
    BIOME_TAGS.forEach((tag) => {
      const label = document.createElement('label');
      label.className = 'prefab-editor__tag';
      label.innerHTML = `<input type="checkbox" value="${tag}"> ${tag}`;
      tagsRoot.appendChild(label);
    });

    const rarityRoot = form.querySelector('[data-rarity]');
    RARITIES.forEach((rarity, index) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="prefab-rarity" value="${rarity}" ${index === 0 ? 'checked' : ''}> ${rarity}`;
      rarityRoot.appendChild(label);
    });

    document.body.appendChild(root);

    return {
      root,
      previewCanvas: root.querySelector('[data-preview-canvas]'),
      previewSize: root.querySelector('[data-size]'),
      overlayVisual: root.querySelector('[data-overlay-visual]'),
      overlayCollision: root.querySelector('[data-overlay-collision]'),
      overlayInteraction: root.querySelector('[data-overlay-interaction]'),
      zoomInput: root.querySelector('[data-zoom]'),
      zoomValue: root.querySelector('[data-zoom-value]'),
      objectId: form.querySelector('[data-object-id]'),
      objectIdWarning: form.querySelector('[data-object-id-warning]'),
      tags: form.querySelector('[data-tags]'),
      spawnWeight: form.querySelector('[data-spawn-weight]'),
      clusterMin: form.querySelector('[data-cluster-min]'),
      clusterMax: form.querySelector('[data-cluster-max]'),
      clusterRadius: form.querySelector('[data-cluster-radius]'),
      rarity: form.querySelector('[data-rarity]'),
      destructible: form.querySelector('[data-destructible]'),
      hp: form.querySelector('[data-hp]'),
      material: form.querySelector('[data-material]'),
      dropTable: form.querySelector('[data-drop-table]'),
      autoCrop: form.querySelector('[data-auto-crop]'),
      importButton: form.querySelector('[data-import]'),
      saveButton: form.querySelector('[data-save]'),
      importInput: form.querySelector('[data-import-input]'),
      closeButton: root.querySelector('[data-close]'),
      status: form.querySelector('[data-status]'),
    };
  }

  async #loadXpFile(file) {
    const buffer = await file.arrayBuffer();
    const parsed = await parseXPFromArrayBuffer(buffer);
    this.loadedXp = parsed;
    this.currentFileName = file.name;

    const id = file.name.replace(/\.xp$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
    this.prefab = buildPrefabFromXP(parsed, {
      ...DEFAULT_PREFAB_METADATA,
      id,
      source: file.name,
    }, { autoCrop: this.autoCrop });

    this.#fillFormFromPrefab();
    this.#renderPreview();
    this.#setStatus(`Loaded ${file.name}`);
  }

  #fillFormFromPrefab() {
    if (!this.prefab) return;
    const { objectId, spawnWeight, clusterMin, clusterMax, clusterRadius, destructible, hp, material, dropTable, autoCrop } = this.elements;
    objectId.value = this.prefab.id;
    spawnWeight.value = this.prefab.spawnWeight;
    clusterMin.value = this.prefab.clusterMin;
    clusterMax.value = this.prefab.clusterMax;
    clusterRadius.value = this.prefab.clusterRadius;
    destructible.checked = Boolean(this.prefab.destructible);
    hp.value = this.prefab.hp;
    material.value = this.prefab.material;
    dropTable.value = this.prefab.dropTable;
    autoCrop.checked = this.autoCrop;

    this.elements.tags.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = this.prefab.tags.includes(checkbox.value);
    });

    this.elements.rarity.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.checked = radio.value === this.prefab.rarity;
    });

    this.#validateObjectId();
  }

  #syncMetadata() {
    if (!this.loadedXp) return;

    this.autoCrop = this.elements.autoCrop.checked;
    const rarity = this.elements.rarity.querySelector('input[type="radio"]:checked')?.value ?? 'common';
    const tags = Array.from(this.elements.tags.querySelectorAll('input[type="checkbox"]:checked')).map((node) => node.value);

    this.prefab = buildPrefabFromXP(this.loadedXp, {
      ...DEFAULT_PREFAB_METADATA,
      id: this.elements.objectId.value.trim(),
      source: this.currentFileName,
      tags,
      spawnWeight: readNumber(this.elements.spawnWeight, DEFAULT_PREFAB_METADATA.spawnWeight),
      clusterMin: readNumber(this.elements.clusterMin, DEFAULT_PREFAB_METADATA.clusterMin),
      clusterMax: readNumber(this.elements.clusterMax, DEFAULT_PREFAB_METADATA.clusterMax),
      clusterRadius: readNumber(this.elements.clusterRadius, DEFAULT_PREFAB_METADATA.clusterRadius),
      rarity,
      destructible: this.elements.destructible.checked,
      hp: readNumber(this.elements.hp, DEFAULT_PREFAB_METADATA.hp),
      material: this.elements.material.value,
      dropTable: this.elements.dropTable.value.trim() || 'none',
    }, { autoCrop: this.autoCrop });

    this.#validateObjectId();
    this.#renderPreview();
  }

  #validateObjectId() {
    const objectId = this.elements.objectId.value.trim();
    const exists = this.registryIds.has(objectId) || Boolean(getObjectDefinition(objectId));
    this.elements.objectIdWarning.textContent = exists ? `⚠ objectId "${objectId}" already exists.` : '';
  }

  #renderPreview() {
    const canvas = this.elements.previewCanvas;
    const ctx = canvas.getContext('2d');
    if (!this.prefab) {
      ctx.fillStyle = '#12131a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const visual = this.prefab.visual ?? [];
    const collision = this.prefab.collision ?? [];
    const interaction = this.prefab.interaction ?? [];

    const width = Math.max(1, ...visual.map((tile) => tile.x + 1), ...collision.map((tile) => tile.x + 1), ...interaction.map((tile) => tile.x + 1));
    const height = Math.max(1, ...visual.map((tile) => tile.y + 1), ...collision.map((tile) => tile.y + 1), ...interaction.map((tile) => tile.y + 1));
    this.elements.previewSize.textContent = `${width}x${height}`;

    const renderCols = width + 2;
    const renderRows = height + 2;

    if (!this.renderer || this.renderer.cols !== renderCols || this.renderer.rows !== renderRows || this.renderer.cellW !== this.zoom * 8) {
      canvas.width = renderCols * this.zoom * 8;
      canvas.height = renderRows * this.zoom * 8;
      this.renderer = new Renderer(canvas, renderCols, renderRows, this.zoom * 8, this.zoom * 8);
    }

    this.renderer.beginFrame();
    this.renderer.background.ctx.fillStyle = '#0b1016';
    this.renderer.background.ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.overlayVisual) {
      for (const tile of visual) {
        this.renderer.drawEntityGlyph(tile.char, rgb(tile.fg), rgb(tile.bg), tile.x + 1, tile.y + 1);
      }
    }

    if (this.overlayCollision) {
      for (const tile of collision) {
        this.renderer.drawEntityGlyph('█', 'rgba(255,80,80,0.8)', 'rgba(80,0,0,0.35)', tile.x + 1, tile.y + 1);
      }
    }

    if (this.overlayInteraction) {
      for (const tile of interaction) {
        this.renderer.drawEntityGlyph('▒', 'rgba(120,180,255,0.8)', 'rgba(20,40,80,0.35)', tile.x + 1, tile.y + 1);
      }
    }

    this.renderer.composite();
  }

  async #savePrefab() {
    this.#syncMetadata();
    if (!this.prefab?.id) {
      this.#setStatus('Object ID is required.', true);
      return;
    }

    const objectId = this.prefab.id;
    const prefabJson = {
      ...this.prefab,
      breakFrames: generateDestructionFrames(this.prefab.visual, 4),
    };

    registerPrefabObject(prefabJson);
    this.registryIds.add(objectId);

    const registryPayload = {
      generatedAt: new Date().toISOString(),
      objects: Array.from(this.registryIds).sort().map((id) => `${id}.json`),
    };

    const prefabText = `${JSON.stringify(prefabJson, null, 2)}\n`;
    const registryText = `${JSON.stringify(registryPayload, null, 2)}\n`;

    const supportsFs = typeof window.showDirectoryPicker === 'function';
    if (supportsFs) {
      try {
        if (!this.fsRoot) {
          this.fsRoot = await window.showDirectoryPicker({ mode: 'readwrite' });
        }
        const assets = await this.fsRoot.getDirectoryHandle('assets', { create: true });
        const objects = await assets.getDirectoryHandle('objects', { create: true });
        await saveTextFile(objects, `${objectId}.json`, prefabText);
        await saveTextFile(objects, 'registry.json', registryText);
        this.#setStatus(`Saved assets/objects/${objectId}.json and updated registry.json`);
        return;
      } catch {
        this.#setStatus('File-system save cancelled. Downloading JSON files instead.', true);
      }
    }

    downloadText(`${objectId}.json`, prefabText);
    downloadText('registry.json', registryText);
    this.#setStatus('Downloaded prefab + registry JSON. Move them into assets/objects/.');
  }

  #setStatus(message, isError = false) {
    this.elements.status.textContent = message;
    this.elements.status.dataset.error = isError ? '1' : '0';
  }
}
