export function resolveMapCollision(entity, map, isWalkableAt = null) {
  const x = Math.round(entity.x);
  const y = Math.round(entity.y);
  const blocked = typeof isWalkableAt === 'function'
    ? !isWalkableAt(entity.x, entity.y)
    : !map[y] || !map[y][x] || !map[y][x].walkable;

  if (blocked) {
    entity.x -= entity.vx * 0.016;
    entity.y -= entity.vy * 0.016;
    entity.vx *= 0.2;
    entity.vy *= 0.2;
  }
}

export function attemptSlideMove(entity, dx, dy, canOccupy) {
  if (dx === 0 && dy === 0) return { movedX: false, movedY: false, blocked: false };

  const tryMoveTo = (nextX, nextY) => {
    if (!canOccupy(nextX, nextY)) return false;
    entity.x = nextX;
    entity.y = nextY;
    return true;
  };

  const startX = entity.x;
  const startY = entity.y;
  if (tryMoveTo(startX + dx, startY + dy)) {
    return {
      movedX: dx !== 0,
      movedY: dy !== 0,
      blocked: false,
    };
  }

  const movedX = dx !== 0 && tryMoveTo(startX + dx, startY);
  const movedY = dy !== 0 && tryMoveTo(entity.x, startY + dy);

  return {
    movedX,
    movedY,
    blocked: !movedX && !movedY,
  };
}

export function collides(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = (a.radius || 1) + (b.radius || 1);
  return dx * dx + dy * dy <= r * r;
}
