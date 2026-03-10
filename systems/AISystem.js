export function updateEnemies(enemies, player, dt) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const jitter = enemy.kind === 'slime' ? Math.sin(performance.now() * 0.01 + enemy.x) * 0.3 : 0;
    enemy.vx = (dx / len) * enemy.speed + jitter;
    enemy.vy = (dy / len) * enemy.speed;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  }
}
