export function resolveMapCollision(entity, map) {
  const x = Math.round(entity.x);
  const y = Math.round(entity.y);
  if (!map[y] || !map[y][x] || !map[y][x].walkable) {
    entity.x -= entity.vx * 0.016;
    entity.y -= entity.vy * 0.016;
    entity.vx *= 0.2;
    entity.vy *= 0.2;
  }
}

export function collides(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = (a.radius || 1) + (b.radius || 1);
  return dx * dx + dy * dy <= r * r;
}
