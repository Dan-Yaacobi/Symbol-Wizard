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

function chooseSlideAxis(dx, dy, canMoveX, canMoveY) {
  if (canMoveX && !canMoveY) return 'x';
  if (canMoveY && !canMoveX) return 'y';
  if (!canMoveX && !canMoveY) return null;

  if (Math.abs(dx) > Math.abs(dy)) return 'x';
  if (Math.abs(dy) > Math.abs(dx)) return 'y';

  return 'x';
}

export function attemptSlideMove(entity, dx, dy, canOccupy) {
  if (dx === 0 && dy === 0) return { movedX: false, movedY: false, blocked: false };

  const startX = entity.x;
  const startY = entity.y;
  const canMoveTo = (nextX, nextY) => canOccupy(nextX, nextY);

  const canMoveFull = canMoveTo(startX + dx, startY + dy);
  if (canMoveFull) {
    entity.x = startX + dx;
    entity.y = startY + dy;
    return {
      movedX: dx !== 0,
      movedY: dy !== 0,
      blocked: false,
    };
  }

  const canMoveX = dx !== 0 && canMoveTo(startX + dx, startY);
  const canMoveY = dy !== 0 && canMoveTo(startX, startY + dy);
  const slideAxis = chooseSlideAxis(dx, dy, canMoveX, canMoveY);

  if (slideAxis === 'x') {
    entity.x = startX + dx;
    entity.y = startY;
    return { movedX: true, movedY: false, blocked: false };
  }

  if (slideAxis === 'y') {
    entity.x = startX;
    entity.y = startY + dy;
    return { movedX: false, movedY: true, blocked: false };
  }

  return {
    movedX: false,
    movedY: false,
    blocked: true,
  };
}

export function collides(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = (a.radius || 1) + (b.radius || 1);
  return dx * dx + dy * dy <= r * r;
}
