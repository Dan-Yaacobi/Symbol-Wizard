const PROJECTILE_DIRECTION_GLYPHS = {
  east: '─',
  west: '─',
  north: '|',
  south: '|',
  northeast: '/',
  southwest: '/',
  northwest: '\\',
  southeast: '\\',
};

export function resolveProjectileDirection(projectile) {
  const dx = projectile?.dx ?? 0;
  const dy = projectile?.dy ?? 0;

  const horizontal = Math.abs(dx) > 0.25 ? (dx > 0 ? 'east' : 'west') : '';
  const vertical = Math.abs(dy) > 0.25 ? (dy > 0 ? 'south' : 'north') : '';
  if (horizontal && vertical) return `${vertical}${horizontal}`;
  return horizontal || vertical || 'east';
}

export function resolveProjectileGlyph(projectile) {
  const direction = resolveProjectileDirection(projectile);
  return {
    direction,
    glyph: PROJECTILE_DIRECTION_GLYPHS[direction] ?? '─',
  };
}

export function assignDirectionalProjectileGlyph(projectile) {
  if (!projectile || projectile.projectileType !== 'stingerProjectile') return;
  const { direction, glyph } = resolveProjectileGlyph(projectile);
  projectile.direction = direction;
  projectile.glyph = glyph;
}
