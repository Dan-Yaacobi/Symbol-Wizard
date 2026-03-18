import { CONFIG_FIELDS } from './RuntimeConfig.js';

const ENEMY_TUNING_LAYOUT = [
  {
    type: 'spider',
    label: 'Spider',
    fields: [
      { key: 'aggroRadius', label: 'Aggro Radius', min: 2, max: 60, step: 0.1 },
      { key: 'hp', label: 'HP', min: 1, max: 200, step: 1 },
      { key: 'speed', label: 'Speed', min: 1, max: 30, step: 0.1 },
      { key: 'attackRange', label: 'Attack Range', min: 1, max: 20, step: 0.1 },
      { key: 'attackDamage', label: 'Attack Damage', min: 0, max: 20, step: 0.1 },
      { key: 'attackCooldown', label: 'Attack Cooldown', min: 0.1, max: 5, step: 0.05 },
      { key: 'attackWindup', label: 'Attack Windup', min: 0.05, max: 5, step: 0.05 },
      { key: 'attackDuration', label: 'Attack Duration', min: 0.05, max: 5, step: 0.05 },
      { key: 'attackHitTime', label: 'Attack Hit Time', min: 0.01, max: 5, step: 0.01 },
      { key: 'hitKnockback', label: 'Hit Knockback', min: 0, max: 30, step: 0.1 },
      { key: 'radius', label: 'Radius', min: 0.5, max: 5, step: 0.05 },
    ],
  },
  {
    type: 'wasp',
    label: 'Wasp',
    fields: [
      { key: 'aggroRadius', label: 'Aggro Radius', min: 2, max: 60, step: 0.1 },
      { key: 'hp', label: 'HP', min: 1, max: 200, step: 1 },
      { key: 'speed', label: 'Speed', min: 1, max: 30, step: 0.1 },
      { key: 'attackRange', label: 'Attack Range', min: 1, max: 20, step: 0.1 },
      { key: 'attackDamage', label: 'Attack Damage', min: 0, max: 20, step: 0.1 },
      { key: 'attackCooldown', label: 'Attack Cooldown', min: 0.1, max: 5, step: 0.05 },
      { key: 'attackWindup', label: 'Attack Windup', min: 0.05, max: 5, step: 0.05 },
      { key: 'attackDuration', label: 'Attack Duration', min: 0.05, max: 5, step: 0.05 },
      { key: 'attackHitTime', label: 'Attack Hit Time', min: 0.01, max: 5, step: 0.01 },
      { key: 'hitKnockback', label: 'Hit Knockback', min: 0, max: 30, step: 0.1 },
      { key: 'radius', label: 'Radius', min: 0.5, max: 5, step: 0.05 },
      { key: 'orbitRadius', label: 'Orbit Radius', min: 1, max: 20, step: 0.1 },
      { key: 'orbitRepositionThreshold', label: 'Orbit Arrival Threshold', min: 0.1, max: 5, step: 0.05 },
      { key: 'orbitPlayerDriftThreshold', label: 'Orbit Drift Threshold', min: 0.1, max: 10, step: 0.1 },
      { key: 'orbitWaitDuration', label: 'Orbit Wait Duration', min: 0, max: 3, step: 0.05 },
    ],
  },
  {
    type: 'swarm_bug',
    label: 'Swarm Bug',
    fields: [
      { key: 'aggroRadius', label: 'Aggro Radius', min: 2, max: 60, step: 0.1 },
      { key: 'hp', label: 'HP', min: 1, max: 200, step: 1 },
      { key: 'speed', label: 'Speed', min: 1, max: 30, step: 0.1 },
      { key: 'attackRange', label: 'Attack Range', min: 1, max: 20, step: 0.1 },
      { key: 'attackDamage', label: 'Attack Damage', min: 0, max: 20, step: 0.1 },
      { key: 'attackCooldown', label: 'Attack Cooldown', min: 0.1, max: 5, step: 0.05 },
      { key: 'attackWindup', label: 'Attack Windup', min: 0.05, max: 5, step: 0.05 },
      { key: 'attackDuration', label: 'Attack Duration', min: 0.05, max: 5, step: 0.05 },
      { key: 'attackHitTime', label: 'Attack Hit Time', min: 0.01, max: 5, step: 0.01 },
      { key: 'hitKnockback', label: 'Hit Knockback', min: 0, max: 30, step: 0.1 },
      { key: 'radius', label: 'Radius', min: 0.5, max: 5, step: 0.05 },
    ],
  },
  {
    type: 'forest_beetle',
    label: 'Forest Beetle',
    fields: [
      { key: 'aggroRadius', label: 'Aggro Radius', min: 2, max: 60, step: 0.1 },
      { key: 'hp', label: 'HP', min: 1, max: 200, step: 1 },
      { key: 'speed', label: 'Speed', min: 1, max: 30, step: 0.1 },
      { key: 'attackRange', label: 'Attack Range', min: 1, max: 20, step: 0.1 },
      { key: 'attackDamage', label: 'Attack Damage', min: 0, max: 20, step: 0.1 },
      { key: 'attackCooldown', label: 'Attack Cooldown', min: 0.1, max: 5, step: 0.05 },
      { key: 'attackWindup', label: 'Attack Windup', min: 0.05, max: 5, step: 0.05 },
      { key: 'attackDuration', label: 'Attack Duration', min: 0.05, max: 5, step: 0.05 },
      { key: 'attackHitTime', label: 'Attack Hit Time', min: 0.01, max: 5, step: 0.01 },
      { key: 'hitKnockback', label: 'Hit Knockback', min: 0, max: 30, step: 0.1 },
      { key: 'radius', label: 'Radius', min: 0.5, max: 5, step: 0.05 },
    ],
  },
  {
    type: 'forest_mantis',
    label: 'Forest Mantis',
    fields: [
      { key: 'aggroRadius', label: 'Aggro Radius', min: 2, max: 60, step: 0.1 },
      { key: 'hp', label: 'HP', min: 1, max: 200, step: 1 },
      { key: 'speed', label: 'Speed', min: 1, max: 30, step: 0.1 },
      { key: 'attackRange', label: 'Attack Range', min: 1, max: 20, step: 0.1 },
      { key: 'attackDamage', label: 'Attack Damage', min: 0, max: 20, step: 0.1 },
      { key: 'attackCooldown', label: 'Attack Cooldown', min: 0.1, max: 5, step: 0.05 },
      { key: 'attackWindup', label: 'Attack Windup', min: 0.05, max: 5, step: 0.05 },
      { key: 'attackDuration', label: 'Attack Duration', min: 0.05, max: 5, step: 0.05 },
      { key: 'attackHitTime', label: 'Attack Hit Time', min: 0.01, max: 5, step: 0.01 },
      { key: 'hitKnockback', label: 'Hit Knockback', min: 0, max: 30, step: 0.1 },
      { key: 'radius', label: 'Radius', min: 0.5, max: 5, step: 0.05 },
      { key: 'flankOrbitSpeed', label: 'Flank Orbit Speed', min: 0.1, max: 10, step: 0.05 },
    ],
  },
];

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
  'Object Generation',
  'Enemy Generation',
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
    this.sectionOpenState = new Map();
    this.interactionLocks = new Set();
    this.pendingRender = false;
    this.fieldDraftValues = new Map();
    this.enemyDraftValues = new Map();
    this.mapTools = {
      getSeed: () => '',
      setSeed: () => {},
      regenerate: () => {},
      spawnEnemyGroup: () => {},
      killAllEnemies: () => {},
      toggleEnemyAi: () => false,
    };
    this.enemyTuningTools = {
      getValue: () => undefined,
      isOverridden: () => false,
      setOverride: () => {},
      clearAllOverrides: () => {},
      getApplyToExistingEnemies: () => false,
      setApplyToExistingEnemies: () => {},
    };

    this.root = document.createElement('aside');
    this.root.className = 'devtools-panel hidden';
    this.root.tabIndex = 0;
    document.body.appendChild(this.root);

    this.statsHud = document.createElement('div');
    this.statsHud.className = 'devtools-stats hidden';
    document.body.appendChild(this.statsHud);

    this.root.addEventListener('keydown', (event) => this.#handlePanelKeys(event));
    this.config.subscribe(() => {
      if (this.interactionLocks.size > 0) {
        this.pendingRender = true;
        return;
      }
      this.render();
    });
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

  setMapTools({ getSeed, setSeed, regenerate, spawnEnemyGroup, killAllEnemies, toggleEnemyAi } = {}) {
    if (typeof getSeed === 'function') this.mapTools.getSeed = getSeed;
    if (typeof setSeed === 'function') this.mapTools.setSeed = setSeed;
    if (typeof regenerate === 'function') this.mapTools.regenerate = regenerate;
    if (typeof spawnEnemyGroup === 'function') this.mapTools.spawnEnemyGroup = spawnEnemyGroup;
    if (typeof killAllEnemies === 'function') this.mapTools.killAllEnemies = killAllEnemies;
    if (typeof toggleEnemyAi === 'function') this.mapTools.toggleEnemyAi = toggleEnemyAi;
    this.render();
  }


  setEnemyTuningTools({
    getValue,
    isOverridden,
    setOverride,
    clearAllOverrides,
    getApplyToExistingEnemies,
    setApplyToExistingEnemies,
  } = {}) {
    if (typeof getValue === 'function') this.enemyTuningTools.getValue = getValue;
    if (typeof isOverridden === 'function') this.enemyTuningTools.isOverridden = isOverridden;
    if (typeof setOverride === 'function') this.enemyTuningTools.setOverride = setOverride;
    if (typeof clearAllOverrides === 'function') this.enemyTuningTools.clearAllOverrides = clearAllOverrides;
    if (typeof getApplyToExistingEnemies === 'function') this.enemyTuningTools.getApplyToExistingEnemies = getApplyToExistingEnemies;
    if (typeof setApplyToExistingEnemies === 'function') this.enemyTuningTools.setApplyToExistingEnemies = setApplyToExistingEnemies;
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
      showEnemySpawnZones: enabled('debug.showEnemySpawnZones'),
      selectedEntityRef: this.selectedEntity,
      selectedTileRef: this.selectedTile,
      aggroRange: this.config.get('enemies.aggroRange'),
    };
  }

  render() {
    this.#captureSectionState();
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

    for (const section of SECTION_ORDER.slice(1, 13)) {
      this.root.appendChild(this.#sectionBlock(section, grouped.get(section) ?? []));
    }
    this.root.appendChild(this.#sectionBlock('Debug / Overlays', grouped.get('Debug / Overlays') ?? []));
    this.root.appendChild(this.#enemyTuningBlock());
    this.root.appendChild(this.#mapToolsBlock());
    this.root.appendChild(this.#inspectorBlock('Selected Entity Inspector', this.selectedEntity));
    this.root.appendChild(this.#inspectorBlock('Selected Tile / Cell Inspector', this.selectedTile));
    this.root.appendChild(this.#sectionBlock('Performance', grouped.get('Performance') ?? []));
    this.root.appendChild(this.#presetsBlock());
  }

  #captureSectionState() {
    for (const details of this.root.querySelectorAll('details[data-section-key]')) {
      this.sectionOpenState.set(details.dataset.sectionKey, details.open);
    }
  }

  #rememberSectionState(details, key, defaultOpen = true) {
    details.dataset.sectionKey = key;
    details.open = this.sectionOpenState.get(key) ?? defaultOpen;
    details.addEventListener('toggle', () => {
      this.sectionOpenState.set(key, details.open);
    });
  }

  #startInteraction(lockKey) {
    this.interactionLocks.add(lockKey);
  }

  #endInteraction(lockKey) {
    this.interactionLocks.delete(lockKey);
    if (this.interactionLocks.size === 0 && this.pendingRender) {
      this.pendingRender = false;
      this.render();
    }
  }


  #enemyTuningBlock() {
    const details = document.createElement('details');
    details.className = 'devtools-section';
    this.#rememberSectionState(details, 'enemy-tuning', true);
    details.innerHTML = '<summary>Enemy Tuning</summary>';

    const applyRow = document.createElement('div');
    applyRow.className = 'devtools-field';
    applyRow.innerHTML = '<label>Apply changes to existing enemies</label>';
    const applyBtn = document.createElement('button');
    const applyEnabled = Boolean(this.enemyTuningTools.getApplyToExistingEnemies());
    applyBtn.textContent = applyEnabled ? 'ON' : 'OFF';
    applyBtn.addEventListener('click', () => this.enemyTuningTools.setApplyToExistingEnemies(!applyEnabled));
    applyRow.appendChild(applyBtn);
    const applyMeta = document.createElement('small');
    applyMeta.textContent = 'When enabled, updates current enemies instantly.';
    applyRow.appendChild(applyMeta);
    details.appendChild(applyRow);

    const resetButton = document.createElement('button');
    resetButton.className = 'devtools-action';
    resetButton.textContent = 'Reset Enemy Values';
    resetButton.addEventListener('click', () => this.enemyTuningTools.clearAllOverrides());
    details.appendChild(resetButton);

    for (const enemy of ENEMY_TUNING_LAYOUT) {
      const enemyDetails = document.createElement('details');
      enemyDetails.className = 'devtools-section';
      this.#rememberSectionState(enemyDetails, `enemy-tuning:${enemy.type}`, false);
      enemyDetails.innerHTML = `<summary>${enemy.label}</summary>`;

      for (const field of enemy.fields) {
        const value = this.enemyTuningTools.getValue(enemy.type, field.key);
        const overridden = this.enemyTuningTools.isOverridden(enemy.type, field.key);
        enemyDetails.appendChild(this.#enemyTuningFieldRow(enemy.type, field, value, overridden));
      }

      details.appendChild(enemyDetails);
    }

    return details;
  }

  #enemyTuningFieldRow(enemyType, field, value, overridden) {
    const row = document.createElement('div');
    row.className = 'devtools-field';
    if (overridden) row.classList.add('dirty');
    row.innerHTML = `<label>${field.label}</label>`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(field.min);
    slider.max = String(field.max);
    slider.step = String(field.step);
    slider.value = String(value);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.value = String(value);

    const draftKey = `${enemyType}:${field.key}`;
    const interactionKey = `enemy:${draftKey}`;

    const applyValue = (raw) => {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return;
      const clamped = Math.min(field.max, Math.max(field.min, parsed));
      this.enemyTuningTools.setOverride(enemyType, field.key, clamped);
    };

    const stopToggle = (event) => event.stopPropagation();
    for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'input', 'change']) {
      slider.addEventListener(type, stopToggle);
    }

    slider.addEventListener('pointerdown', () => this.#startInteraction(interactionKey));
    slider.addEventListener('pointerup', () => this.#endInteraction(interactionKey));
    slider.addEventListener('blur', () => this.#endInteraction(interactionKey));

    slider.addEventListener('input', () => {
      const nextValue = Number(slider.value);
      input.value = slider.value;
      this.enemyDraftValues.set(draftKey, slider.value);
      if (Number.isFinite(nextValue)) applyValue(nextValue);
    });
    slider.addEventListener('change', () => {
      this.enemyDraftValues.delete(draftKey);
      applyValue(slider.value);
    });

    const commitInput = () => {
      this.enemyDraftValues.delete(draftKey);
      applyValue(input.value);
      slider.value = input.value;
    };
    const cancelInput = () => {
      const committedValue = this.enemyTuningTools.getValue(enemyType, field.key);
      const normalized = String(committedValue);
      this.enemyDraftValues.delete(draftKey);
      input.value = normalized;
      slider.value = normalized;
      input.blur();
    };

    input.addEventListener('focus', () => {
      this.#startInteraction(interactionKey);
      input.select();
    });
    input.addEventListener('click', () => input.select());
    input.addEventListener('input', () => this.enemyDraftValues.set(draftKey, input.value));
    input.addEventListener('blur', () => {
      commitInput();
      this.#endInteraction(interactionKey);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitInput();
        input.blur();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelInput();
      }
    });

    row.appendChild(slider);
    row.appendChild(input);

    const meta = document.createElement('small');
    meta.textContent = `${overridden ? 'overridden' : 'default'} (${Number(value).toFixed(2)})`;
    row.appendChild(meta);

    const reset = document.createElement('button');
    reset.textContent = '↺';
    reset.title = 'Reset enemy parameter';
    reset.addEventListener('click', () => this.enemyTuningTools.setOverride(enemyType, field.key, null));
    row.appendChild(reset);

    return row;
  }

  #mapToolsBlock() {
    const details = document.createElement('details');
    details.className = 'devtools-section';
    this.#rememberSectionState(details, 'map-tools', true);
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

    const actions = [
      ['Regenerate Map', () => this.mapTools.regenerate()],
      ['Spawn Enemy Group', () => this.mapTools.spawnEnemyGroup()],
      ['Kill All Enemies', () => this.mapTools.killAllEnemies()],
      ['Toggle Enemy AI', () => this.mapTools.toggleEnemyAi()],
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
    this.#rememberSectionState(details, `section:${sectionName}`, true);

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
      const interactionKey = `field:${field.path}`;
      const commit = () => {
        if (!this.fieldDraftValues.has(field.path)) return;
        this.config.set(field.path, editor.value);
        this.fieldDraftValues.delete(field.path);
      };
      const cancel = () => {
        const committedValue = this.config.get(field.path);
        editor.value = committedValue;
        this.fieldDraftValues.delete(field.path);
      };

      editor.addEventListener('focus', () => {
        this.#startInteraction(interactionKey);
        if (field.type === 'number') editor.select();
      });
      editor.addEventListener('click', () => {
        if (field.type === 'number') editor.select();
      });
      editor.addEventListener('input', () => this.fieldDraftValues.set(field.path, editor.value));
      editor.addEventListener('blur', () => {
        commit();
        this.#endInteraction(interactionKey);
      });
      editor.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
          editor.blur();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
          editor.blur();
          return;
        }
        if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && field.type === 'number') {
          const direction = event.key === 'ArrowUp' ? 1 : -1;
          const baseStep = Number(field.step) || 1;
          const step = event.shiftKey ? baseStep * 10 : (event.altKey ? baseStep * 0.2 : baseStep);
          const numeric = Number(editor.value);
          if (!Number.isFinite(numeric)) return;
          event.preventDefault();
          const next = Math.min(field.max ?? Number.POSITIVE_INFINITY, Math.max(field.min ?? Number.NEGATIVE_INFINITY, numeric + (direction * step)));
          editor.value = String(next);
          this.fieldDraftValues.set(field.path, editor.value);
        }
      });
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
    this.#rememberSectionState(details, `inspector:${title}`, true);
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
    this.#rememberSectionState(details, 'presets', true);
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
