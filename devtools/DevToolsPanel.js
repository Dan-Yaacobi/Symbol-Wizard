import { CONFIG_FIELDS } from './RuntimeConfig.js';

const SECTION_ORDER = [
  'Search / Filter',
  'Favorites / Pinned Fields',
  'Gameplay',
  'Player',
  'Enemies',
  'Combat',
  'Camera',
  'Visual',
  'Palette / Colors',
  'Sprites / Animation',
  'World / Generation',
  'Debug / Overlays',
  'Selected Entity Inspector',
  'Selected Tile / Cell Inspector',
  'Performance',
  'Presets / Persistence',
];

export class DevToolsPanel {
  constructor(config) {
    this.config = config;
    this.open = false;
    this.filter = '';
    this.hoveredPath = null;
    this.selectedEntity = null;
    this.selectedTile = null;
    this.fieldElements = new Map();
    this.mapTools = {
      getSeed: () => '',
      setSeed: () => {},
      regenerate: () => {},
    };

    this.root = document.createElement('aside');
    this.root.className = 'devtools-panel hidden';
    this.root.tabIndex = 0;
    document.body.appendChild(this.root);

    this.statsHud = document.createElement('div');
    this.statsHud.className = 'devtools-stats hidden';
    document.body.appendChild(this.statsHud);

    this.root.addEventListener('keydown', (event) => this.#handlePanelKeys(event));
    this.config.subscribe(() => this.render());
    this.render();
  }

  setOpen(open) {
    this.open = open;
    this.root.classList.toggle('hidden', !open);
    if (open) this.root.focus();
  }

  toggleOpen() { this.setOpen(!this.open); }
  isCapturingInput() {
    if (!this.open) return false;
    const active = document.activeElement;
    return this.root.contains(active) || active === this.root;
  }

  setInspectorData({ selectedEntity, selectedTile }) {
    this.selectedEntity = selectedEntity;
    this.selectedTile = selectedTile;
    this.render();
  }

  setMapTools({ getSeed, setSeed, regenerate } = {}) {
    if (typeof getSeed === 'function') this.mapTools.getSeed = getSeed;
    if (typeof setSeed === 'function') this.mapTools.setSeed = setSeed;
    if (typeof regenerate === 'function') this.mapTools.regenerate = regenerate;
    this.render();
  }

  updateStats(text) {
    const enabled = this.config.get('debug.showStatsHud');
    this.statsHud.classList.toggle('hidden', !enabled);
    if (enabled) this.statsHud.textContent = text;
  }

  getRenderDebugOptions() {
    const overlaysEnabled = this.config.get('debug.overlaysEnabled');
    const enabled = (path) => overlaysEnabled && this.config.get(path);
    return {
      overlaysEnabled,
      collisionBounds: enabled('debug.collisionBounds'),
      entityFootprints: enabled('debug.entityFootprints'),
      attackRanges: enabled('debug.attackRanges'),
      aggroRanges: enabled('debug.aggroRanges'),
      projectileCollision: enabled('debug.projectileCollision'),
      chaseLines: enabled('debug.chaseLines'),
      cameraCenter: enabled('debug.cameraCenter'),
      grid: enabled('debug.grid'),
      selectedEntity: enabled('debug.selectedEntity'),
      selectedTile: enabled('debug.selectedTile'),
      layerLabels: enabled('debug.layerLabels'),
      facingMarker: enabled('debug.facingMarker'),
      showExitAnchors: enabled('debug.showExitAnchors'),
      showReservedCorridors: enabled('debug.showReservedCorridors'),
      showLandingTiles: enabled('debug.showLandingTiles'),
      selectedEntityRef: this.selectedEntity,
      selectedTileRef: this.selectedTile,
      aggroRange: this.config.get('enemies.aggroRange'),
    };
  }

  render() {
    this.root.classList.toggle('compact', this.config.get('gameplay.compactMode'));
    const showOnlyDirty = this.config.get('gameplay.showOnlyDirty');

    const fields = CONFIG_FIELDS.filter((field) => {
      const haystack = `${field.path} ${field.label} ${field.section}`.toLowerCase();
      const matches = !this.filter || haystack.includes(this.filter.toLowerCase());
      if (!matches) return false;
      if (!showOnlyDirty) return true;
      return this.config.isDirty(field.path);
    });

    const grouped = new Map();
    for (const section of SECTION_ORDER) grouped.set(section, []);
    for (const field of fields) grouped.get(field.section)?.push(field);

    const favorites = this.config.pinned.map((path) => CONFIG_FIELDS.find((field) => field.path === path)).filter(Boolean);
    grouped.set('Favorites / Pinned Fields', favorites);

    this.root.innerHTML = '';
    this.root.appendChild(this.#searchSection());

    for (const section of SECTION_ORDER.slice(1, 11)) {
      this.root.appendChild(this.#sectionBlock(section, grouped.get(section) ?? []));
    }
    this.root.appendChild(this.#sectionBlock('Debug / Overlays', grouped.get('Debug / Overlays') ?? []));
    this.root.appendChild(this.#mapToolsBlock());
    this.root.appendChild(this.#inspectorBlock('Selected Entity Inspector', this.selectedEntity));
    this.root.appendChild(this.#inspectorBlock('Selected Tile / Cell Inspector', this.selectedTile));
    this.root.appendChild(this.#sectionBlock('Performance', grouped.get('Performance') ?? []));
    this.root.appendChild(this.#presetsBlock());
  }

  #mapToolsBlock() {
    const details = document.createElement('details');
    details.className = 'devtools-section';
    details.open = true;
    details.innerHTML = '<summary>Map Tools</summary>';

    const seedRow = document.createElement('div');
    seedRow.className = 'devtools-field';
    seedRow.innerHTML = '<label>Seed</label>';

    const seedInput = document.createElement('input');
    seedInput.type = 'text';
    seedInput.placeholder = 'blank = random seed';
    seedInput.value = this.mapTools.getSeed();
    seedInput.addEventListener('input', () => this.mapTools.setSeed(seedInput.value));
    seedRow.appendChild(seedInput);

    const seedMeta = document.createElement('small');
    seedMeta.textContent = 'Set a seed, then click regenerate.';
    seedRow.appendChild(seedMeta);
    details.appendChild(seedRow);

    const regenerateButton = document.createElement('button');
    regenerateButton.className = 'devtools-action';
    regenerateButton.textContent = 'Regenerate Map';
    regenerateButton.addEventListener('click', () => this.mapTools.regenerate());
    details.appendChild(regenerateButton);

    return details;
  }

  #searchSection() {
    const wrap = document.createElement('section');
    wrap.className = 'devtools-section';
    wrap.innerHTML = `<h3>Search / Filter</h3>`;
    const input = document.createElement('input');
    input.className = 'devtools-search';
    input.placeholder = 'type to filter (/, speed, smoothing, projectile...)';
    input.value = this.filter;
    input.addEventListener('input', () => {
      this.filter = input.value;
      this.render();
    });
    input.dataset.role = 'search';
    wrap.appendChild(input);
    return wrap;
  }

  #sectionBlock(sectionName, fields) {
    const details = document.createElement('details');
    details.className = 'devtools-section';
    details.open = true;

    const dirtyCount = fields.filter((field) => this.config.isDirty(field.path)).length;
    details.innerHTML = `<summary>${sectionName}${dirtyCount > 0 ? ` <span class="dirty-pill">${dirtyCount}*</span>` : ''}</summary>`;

    for (const field of fields) details.appendChild(this.#fieldRow(field));

    if (fields.length > 0) {
      const resetButton = document.createElement('button');
      resetButton.textContent = `Reset ${sectionName}`;
      resetButton.className = 'devtools-action';
      resetButton.addEventListener('click', () => this.config.resetSection(sectionName));
      details.appendChild(resetButton);
    }

    return details;
  }

  #fieldRow(field) {
    const row = document.createElement('div');
    row.className = 'devtools-field';
    row.dataset.path = field.path;
    const current = this.config.get(field.path);
    const def = this.config.getDefault(field.path);
    const dirty = this.config.isDirty(field.path);

    row.innerHTML = `<label title="${field.tooltip ?? ''}">${field.label}</label>`;

    let editor;
    if (field.type === 'boolean') {
      editor = document.createElement('button');
      editor.textContent = current ? 'ON' : 'OFF';
      editor.addEventListener('click', () => this.config.set(field.path, !current));
    } else if (field.type === 'enum') {
      editor = document.createElement('select');
      for (const option of field.options) {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        optionElement.selected = option === current;
        editor.appendChild(optionElement);
      }
      editor.addEventListener('input', () => this.config.set(field.path, editor.value));
    } else {
      editor = document.createElement('input');
      editor.value = current;
      editor.type = field.type === 'number' ? 'number' : 'text';
      if (field.type === 'number') {
        if (Number.isFinite(field.min)) editor.min = field.min;
        if (Number.isFinite(field.max)) editor.max = field.max;
        if (Number.isFinite(field.step)) editor.step = field.step;
      }
      editor.addEventListener('input', () => this.config.set(field.path, editor.value));
    }

    editor.title = `${field.path}\nDefault: ${def}`;
    row.appendChild(editor);

    if (field.type === 'color') {
      const swatch = document.createElement('span');
      swatch.className = 'devtools-swatch';
      swatch.style.background = current;
      row.appendChild(swatch);
    }

    const meta = document.createElement('small');
    meta.textContent = `default ${def}`;
    row.appendChild(meta);

    const pin = document.createElement('button');
    pin.textContent = this.config.pinned.includes(field.path) ? '★' : '☆';
    pin.title = 'Pin field';
    pin.addEventListener('click', () => this.config.togglePin(field.path));
    row.appendChild(pin);

    const reset = document.createElement('button');
    reset.textContent = '↺';
    reset.title = 'Reset field';
    reset.addEventListener('click', () => this.config.resetField(field.path));
    row.appendChild(reset);

    if (dirty) row.classList.add('dirty');
    this.fieldElements.set(field.path, row);
    return row;
  }

  #inspectorBlock(title, data) {
    const details = document.createElement('details');
    details.className = 'devtools-section';
    details.open = true;
    details.innerHTML = `<summary>${title}</summary>`;

    const pre = document.createElement('pre');
    pre.className = 'devtools-inspector';
    pre.textContent = data ? JSON.stringify(data, null, 2) : 'No selection';
    details.appendChild(pre);
    return details;
  }

  #presetsBlock() {
    const details = document.createElement('details');
    details.className = 'devtools-section';
    details.open = true;
    details.innerHTML = '<summary>Presets / Persistence</summary>';

    const nameInput = document.createElement('input');
    nameInput.placeholder = 'preset name';
    nameInput.value = this.config.lastPresetName ?? '';
    details.appendChild(nameInput);

    const actions = [
      ['Save Current (F5)', () => this.config.saveCurrentConfig()],
      ['Load Saved (F9)', () => this.config.loadSavedConfig()],
      ['Quick Save Named (F6)', () => this.config.savePreset(nameInput.value || `preset-${Date.now()}`)],
      ['Load Named', () => this.config.loadPreset(nameInput.value)],
      ['Restore Defaults (Shift+F9)', () => this.config.resetAll()],
      ['Undo (Ctrl+Z)', () => this.config.undo()],
      ['Redo (Ctrl+Y)', () => this.config.redo()],
    ];

    for (const [label, callback] of actions) {
      const button = document.createElement('button');
      button.className = 'devtools-action';
      button.textContent = label;
      button.addEventListener('click', callback);
      details.appendChild(button);
    }

    return details;
  }

  #handlePanelKeys(event) {
    if (event.key === '/') {
      event.preventDefault();
      this.root.querySelector('[data-role="search"]')?.focus();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.config.undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.config.redo();
      return;
    }

    const activeRow = document.activeElement?.closest?.('.devtools-field');
    if (!activeRow) return;
    const path = activeRow.dataset.path;
    const field = CONFIG_FIELDS.find((entry) => entry.path === path);
    if (!field) return;

    const current = this.config.get(path);
    const direction = event.key === 'ArrowRight' ? 1 : (event.key === 'ArrowLeft' ? -1 : 0);
    if (direction !== 0 && field.type === 'number') {
      event.preventDefault();
      const baseStep = field.step ?? 1;
      const step = event.shiftKey ? baseStep * 10 : (event.altKey ? baseStep * 0.2 : baseStep);
      this.config.set(path, Number(current) + direction * step);
      return;
    }

    if (event.code === 'Space' && field.type === 'boolean') {
      event.preventDefault();
      this.config.set(path, !current);
      return;
    }

    if (event.key === 'F8') {
      event.preventDefault();
      this.config.resetField(path);
    }
  }
}
