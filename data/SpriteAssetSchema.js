export const EMPTY_CELL = Object.freeze({ ch: ' ', fg: null, bg: null });

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

export function createEmptyCell() {
  return { ch: ' ', fg: null, bg: null };
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
  const width = Math.max(1, Number(frame?.width ?? fallback.width ?? 1) | 0);
  const height = Math.max(1, Number(frame?.height ?? fallback.height ?? 1) | 0);
  const sourceRows = Array.isArray(frame?.cells) ? frame.cells : [];
  const cells = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => normalizeSpriteCell(sourceRows[y]?.[x])));
  return {
    width,
    height,
    offsetY: Number(frame?.offsetY ?? fallback.offsetY ?? 0) || 0,
    cells,
  };
}

export function normalizeSpriteAsset(asset) {
  const id = String(asset?.id ?? 'sprite').trim() || 'sprite';
  const anchor = {
    x: Number(asset?.anchor?.x ?? 0) || 0,
    y: Number(asset?.anchor?.y ?? 0) || 0,
  };
  const animations = {};
  const sourceAnimations = asset?.animations && typeof asset.animations === 'object' ? asset.animations : { idle: [] };
  for (const [animationName, frames] of Object.entries(sourceAnimations)) {
    const normalizedFrames = Array.isArray(frames) ? frames.map((frame) => normalizeSpriteFrame(frame)) : [];
    if (normalizedFrames.length > 0) animations[animationName] = normalizedFrames;
  }
  if (!animations.idle) {
    animations.idle = [normalizeSpriteFrame({ width: 1, height: 1, cells: [[createEmptyCell()]] })];
  }
  return { id, anchor, animations, meta: asset?.meta && typeof asset.meta === 'object' ? { ...asset.meta } : {} };
}

export function validateSpriteAsset(asset) {
  const errors = [];
  if (!asset || typeof asset !== 'object') errors.push('Asset must be an object.');
  if (!asset?.id) errors.push('Asset requires an id.');
  if (!asset?.animations || typeof asset.animations !== 'object') errors.push('Asset requires animations.');
  for (const [animationName, frames] of Object.entries(asset?.animations ?? {})) {
    if (!Array.isArray(frames) || frames.length === 0) {
      errors.push(`Animation "${animationName}" must contain at least one frame.`);
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

export function isOccupiedSpriteCell(cell) {
  return Boolean(cell && typeof cell.ch === 'string' && cell.ch !== ' ' && cell.ch !== '\0');
}
