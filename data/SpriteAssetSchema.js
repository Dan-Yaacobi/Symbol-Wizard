export const EMPTY_CELL = Object.freeze({ ch: ' ', fg: null, bg: null });
export const REQUIRED_GAMEPLAY_ANIMATIONS = Object.freeze(['idle', 'walk', 'attack']);

function normalizeColor(value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value) && value.length >= 3) {
    const [r, g, b] = value.map((entry) => Math.max(0, Math.min(255, Number(entry) || 0)));
    return `#${[r, g, b].map((entry) => entry.toString(16).padStart(2, '0')).join('')}`;
  }
  const normalized = String(value).trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    if (normalized.length === 4) {
      return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
    }
    return normalized.toLowerCase();
  }
  return normalized;
}

function clampPositiveInt(value, fallback = 1) {
  const numeric = Number(value ?? fallback) | 0;
  return Math.max(1, numeric);
}

function positiveIntOrZero(value) {
  const numeric = Number(value) | 0;
  return Math.max(0, numeric);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSpriteMeta(meta, spriteId = 'sprite') {
  const source = meta && typeof meta === 'object' ? meta : {};
  const enemyId = String(source.enemyId ?? spriteId).trim() || spriteId;
  const biomes = Array.isArray(source.biomes)
    ? [...new Set(source.biomes.map((entry) => String(entry ?? '').trim().toLowerCase()).filter(Boolean))]
    : [];
  const spawnWeight = Number(source.spawnWeight);
  return {
    ...source,
    isEnemy: Boolean(source.isEnemy),
    enemyId,
    biomes,
    spawnWeight: Number.isFinite(spawnWeight) && spawnWeight > 0 ? Math.max(1, Math.round(spawnWeight)) : 1,
  };
}

export function createEmptyCell() {
  return { ch: ' ', fg: null, bg: null };
}

export function createEmptyFrame(width = 1, height = 1) {
  const safeWidth = clampPositiveInt(width);
  const safeHeight = clampPositiveInt(height);
  return {
    width: safeWidth,
    height: safeHeight,
    offsetY: 0,
    cells: Array.from({ length: safeHeight }, () => Array.from({ length: safeWidth }, () => createEmptyCell())),
  };
}

export function normalizeSpriteCell(cell) {
  if (cell == null) return createEmptyCell();
  if (typeof cell === 'string') return { ch: cell[0] ?? ' ', fg: null, bg: null };
  return {
    ch: typeof cell.ch === 'string' && cell.ch.length > 0 ? cell.ch[0] : ' ',
    fg: normalizeColor(cell.fg),
    bg: normalizeColor(cell.bg),
  };
}

export function normalizeSpriteFrame(frame, fallback = {}) {
  const width = clampPositiveInt(frame?.width ?? fallback.width ?? 1);
  const height = clampPositiveInt(frame?.height ?? fallback.height ?? 1);
  const sourceRows = Array.isArray(frame?.cells) ? frame.cells : [];
  const cells = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => normalizeSpriteCell(sourceRows[y]?.[x])));
  return {
    width,
    height,
    offsetY: Number(frame?.offsetY ?? fallback.offsetY ?? 0) || 0,
    cells,
  };
}

export function ensureRequiredAnimations(asset, requiredAnimations = REQUIRED_GAMEPLAY_ANIMATIONS) {
  const target = asset && typeof asset === 'object' ? asset : {};
  target.animations ??= {};
  for (const animationName of requiredAnimations) {
    if (!Array.isArray(target.animations[animationName])) target.animations[animationName] = [];
  }
  return target;
}

export function createEmptySpriteAsset(id = 'sprite', width = 7, height = 7) {
  const safeWidth = clampPositiveInt(width, 7);
  const safeHeight = clampPositiveInt(height, 7);
  const asset = {
    id: String(id || 'sprite').trim() || 'sprite',
    anchor: { x: Math.floor(safeWidth / 2), y: Math.floor(safeHeight / 2) },
    defaultGrid: { width: safeWidth, height: safeHeight },
    animations: {
      idle: [createEmptyFrame(safeWidth, safeHeight)],
      walk: [],
      attack: [],
    },
    meta: {
      isEnemy: false,
      enemyId: String(id || 'sprite').trim() || 'sprite',
      biomes: [],
      spawnWeight: 1,
    },
  };
  return ensureRequiredAnimations(asset);
}

function inferDefaultGrid(asset) {
  const explicitWidth = positiveIntOrZero(asset?.defaultGrid?.width ?? 0);
  const explicitHeight = positiveIntOrZero(asset?.defaultGrid?.height ?? 0);
  if (explicitWidth > 0 && explicitHeight > 0) return { width: explicitWidth, height: explicitHeight };

  const firstFrame = Object.values(asset?.animations ?? {}).flat().find((frame) => frame);
  return {
    width: clampPositiveInt(firstFrame?.width ?? 7, 7),
    height: clampPositiveInt(firstFrame?.height ?? 7, 7),
  };
}

export function normalizeSpriteAsset(asset) {
  const id = String(asset?.id ?? 'sprite').trim() || 'sprite';
  const sourceAnimations = asset?.animations && typeof asset.animations === 'object' ? asset.animations : {};
  const inferredGrid = inferDefaultGrid(asset);
  const normalized = {
    id,
    anchor: {
      x: Number(asset?.anchor?.x ?? Math.floor(inferredGrid.width / 2)) || 0,
      y: Number(asset?.anchor?.y ?? Math.floor(inferredGrid.height / 2)) || 0,
    },
    defaultGrid: inferredGrid,
    animations: {},
    meta: normalizeSpriteMeta(asset?.meta, id),
  };

  for (const [animationName, frames] of Object.entries(sourceAnimations)) {
    normalized.animations[animationName] = Array.isArray(frames)
      ? frames.map((frame) => normalizeSpriteFrame(frame, inferredGrid))
      : [];
  }

  ensureRequiredAnimations(normalized);
  return normalized;
}

export function validateSpriteAsset(asset) {
  const errors = [];
  if (!asset || typeof asset !== 'object') errors.push('Asset must be an object.');
  if (!asset?.id) errors.push('Asset requires an id.');
  if (!asset?.defaultGrid || typeof asset.defaultGrid !== 'object') errors.push('Asset requires defaultGrid.');
  if (!asset?.animations || typeof asset.animations !== 'object') errors.push('Asset requires animations.');
  if (asset?.meta && typeof asset.meta !== 'object') errors.push('Asset meta must be an object.');
  if (asset?.meta?.biomes && !Array.isArray(asset.meta.biomes)) errors.push('Asset meta.biomes must be an array when provided.');

  for (const animationName of REQUIRED_GAMEPLAY_ANIMATIONS) {
    if (!Array.isArray(asset?.animations?.[animationName])) errors.push(`Animation "${animationName}" must exist as an array.`);
  }

  for (const [animationName, frames] of Object.entries(asset?.animations ?? {})) {
    if (!Array.isArray(frames)) {
      errors.push(`Animation "${animationName}" must be an array.`);
      continue;
    }
    frames.forEach((frame, frameIndex) => {
      if (!Number.isInteger(frame?.width) || frame.width <= 0) errors.push(`${animationName}[${frameIndex}] width must be a positive integer.`);
      if (!Number.isInteger(frame?.height) || frame.height <= 0) errors.push(`${animationName}[${frameIndex}] height must be a positive integer.`);
      if (!Array.isArray(frame?.cells) || frame.cells.length !== frame.height) errors.push(`${animationName}[${frameIndex}] cells must have one row per height.`);
      frame?.cells?.forEach((row, rowIndex) => {
        if (!Array.isArray(row) || row.length !== frame.width) errors.push(`${animationName}[${frameIndex}] row ${rowIndex} must have width cells.`);
      });
    });
  }
  return { valid: errors.length === 0, errors };
}

export function resizeFrame(frame, newWidth, newHeight, options = {}) {
  const source = normalizeSpriteFrame(frame);
  const width = clampPositiveInt(newWidth, source.width);
  const height = clampPositiveInt(newHeight, source.height);
  const pin = options.pin === 'center' ? 'center' : 'top-left';
  const resized = createEmptyFrame(width, height);
  resized.offsetY = source.offsetY ?? 0;

  const sourceOffsetX = pin === 'center' ? Math.floor((width - source.width) / 2) : 0;
  const sourceOffsetY = pin === 'center' ? Math.floor((height - source.height) / 2) : 0;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const targetX = x + sourceOffsetX;
      const targetY = y + sourceOffsetY;
      if (targetX < 0 || targetY < 0 || targetX >= width || targetY >= height) continue;
      resized.cells[targetY][targetX] = normalizeSpriteCell(source.cells[y][x]);
    }
  }
  return resized;
}

export function resizeAnimationFrames(frames, newWidth, newHeight, options = {}) {
  return (Array.isArray(frames) ? frames : []).map((frame) => resizeFrame(frame, newWidth, newHeight, options));
}

export function resizeSpriteAsset(asset, newWidth, newHeight, scope = 'whole sprite asset', options = {}) {
  const normalized = normalizeSpriteAsset(asset);
  const width = clampPositiveInt(newWidth, normalized.defaultGrid.width);
  const height = clampPositiveInt(newHeight, normalized.defaultGrid.height);
  const next = cloneJson(normalized);
  next.defaultGrid = { width, height };

  if (scope === 'whole sprite asset') {
    for (const [name, frames] of Object.entries(next.animations)) {
      next.animations[name] = resizeAnimationFrames(frames, width, height, options);
    }
  } else if (scope === 'current animation') {
    const animationName = options.animationName ?? 'idle';
    next.animations[animationName] = resizeAnimationFrames(next.animations[animationName], width, height, options);
  } else if (scope === 'current frame') {
    const animationName = options.animationName ?? 'idle';
    const frameIndex = Math.max(0, Number(options.frameIndex) | 0);
    const frames = next.animations[animationName] ?? [];
    if (frames[frameIndex]) frames[frameIndex] = resizeFrame(frames[frameIndex], width, height, options);
  }

  return normalizeSpriteAsset(next);
}

export function isOccupiedSpriteCell(cell) {
  return Boolean(cell && typeof cell.ch === 'string' && cell.ch !== ' ' && cell.ch !== '\0');
}


export function getSpriteCollisionOffsets(frame) {
  const normalized = normalizeSpriteFrame(frame);
  const offsets = [];
  for (let sy = 0; sy < normalized.height; sy += 1) {
    for (let sx = 0; sx < normalized.width; sx += 1) {
      if (!isOccupiedSpriteCell(normalized.cells[sy]?.[sx])) continue;
      offsets.push({ x: sx - Math.floor(normalized.width / 2), y: sy - (normalized.offsetY ?? 0) - Math.floor(normalized.height / 2) });
    }
  }
  return offsets;
}
