const DEFAULT_FACING = Object.freeze({ x: 0, y: 1 });
const DEFAULT_DIRECTION = 'S';
const FACING_LERP_FACTOR = 0.2;

const DIRECTION_BUCKETS = [
  { key: 'E', angle: 0 },
  { key: 'SE', angle: Math.PI / 4 },
  { key: 'S', angle: Math.PI / 2 },
  { key: 'SW', angle: (3 * Math.PI) / 4 },
  { key: 'W', angle: Math.PI },
  { key: 'NW', angle: -(3 * Math.PI) / 4 },
  { key: 'N', angle: -Math.PI / 2 },
  { key: 'NE', angle: -Math.PI / 4 },
];

export function ensureEntityFacing(entity) {
  if (!entity) return DEFAULT_FACING;
  const facing = entity.facing;
  const x = Number.isFinite(facing?.x) ? facing.x : DEFAULT_FACING.x;
  const y = Number.isFinite(facing?.y) ? facing.y : DEFAULT_FACING.y;
  const normalized = normalizeFacingVector(x, y, DEFAULT_FACING);
  entity.facing = normalized;
  entity.direction = facingToDirection8(normalized, entity.direction ?? DEFAULT_DIRECTION);
  return entity.facing;
}

export function normalizeFacingVector(x, y, fallback = DEFAULT_FACING) {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 1e-9) {
    return {
      x: Number.isFinite(fallback?.x) ? fallback.x : DEFAULT_FACING.x,
      y: Number.isFinite(fallback?.y) ? fallback.y : DEFAULT_FACING.y,
    };
  }

  return { x: x / length, y: y / length };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function updateFacingFromVector(entity, x, y, options = {}) {
  if (!entity) return;
  const current = ensureEntityFacing(entity);
  const next = normalizeFacingVector(x, y, current);
  const smoothing = Number.isFinite(options.smoothing) ? options.smoothing : FACING_LERP_FACTOR;
  const smoothed = normalizeFacingVector(
    lerp(current.x, next.x, Math.max(0, Math.min(1, smoothing))),
    lerp(current.y, next.y, Math.max(0, Math.min(1, smoothing))),
    current,
  );

  entity.facing = smoothed;
  entity.direction = facingToDirection8(smoothed, entity.direction ?? DEFAULT_DIRECTION);
}

export function updateFacingFromVelocity(entity, threshold = 0.01, options = {}) {
  if (!entity) return;
  const vx = entity.vx ?? 0;
  const vy = entity.vy ?? 0;
  if (Math.hypot(vx, vy) <= threshold) {
    ensureEntityFacing(entity);
    return;
  }
  updateFacingFromVector(entity, vx, vy, options);
}

export function updateFacingTowardTarget(entity, target, options = {}) {
  if (!entity || !target) return;
  const tx = Number.isFinite(target.x) ? target.x : null;
  const ty = Number.isFinite(target.y) ? target.y : null;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
  updateFacingFromVector(entity, tx - entity.x, ty - entity.y, options);
}

export function facingToDirection8(facing, fallback = DEFAULT_DIRECTION) {
  const x = Number.isFinite(facing?.x) ? facing.x : 0;
  const y = Number.isFinite(facing?.y) ? facing.y : 0;
  if (Math.hypot(x, y) <= 1e-9) return fallback;

  const angle = Math.atan2(y, x);
  let closest = DIRECTION_BUCKETS[0];
  let smallestDelta = Number.POSITIVE_INFINITY;

  for (const bucket of DIRECTION_BUCKETS) {
    const rawDelta = Math.abs(angle - bucket.angle);
    const delta = Math.min(rawDelta, (Math.PI * 2) - rawDelta);
    if (delta < smallestDelta) {
      smallestDelta = delta;
      closest = bucket;
    }
  }

  return closest.key;
}

export function directionToArrow(direction) {
  switch (direction) {
    case 'N': return '↑';
    case 'NE': return '↗';
    case 'E': return '→';
    case 'SE': return '↘';
    case 'S': return '↓';
    case 'SW': return '↙';
    case 'W': return '←';
    case 'NW': return '↖';
    default: return '•';
  }
}

export function toCardinalDirection(direction, fallback = 'S') {
  switch (direction) {
    case 'N':
    case 'NE':
    case 'NW':
      return 'N';
    case 'S':
    case 'SE':
    case 'SW':
      return 'S';
    case 'E':
      return 'E';
    case 'W':
      return 'W';
    default:
      return fallback;
  }
}
