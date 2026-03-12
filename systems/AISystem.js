export function updateEnemies(enemies, player, dt) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    if (enemy.frozen) {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.isWindingUp = false;
      enemy.isAttacking = false;
      enemy.attackElapsed = 0;
      enemy.attackDamageApplied = false;
      continue;
    }

    enemy.attackTimer = Math.max(0, (enemy.attackTimer ?? 0) - dt);

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const len = distance || 1;
    const attackRange = enemy.attackRange ?? 3;
    const inAttackRange = distance <= attackRange;

    if (!inAttackRange) {
      enemy.isWindingUp = false;
      enemy.isAttacking = false;
      enemy.attackElapsed = 0;
      enemy.attackDamageApplied = false;

      const jitter = enemy.kind === 'slime' ? Math.sin(performance.now() * 0.01 + enemy.x) * 0.3 : 0;
      enemy.vx = (dx / len) * enemy.speed + jitter;
      enemy.vy = (dy / len) * enemy.speed;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      continue;
    }

    enemy.vx = 0;
    enemy.vy = 0;

    if (enemy.isWindingUp) {
      enemy.attackElapsed = (enemy.attackElapsed ?? 0) + dt;
      if (enemy.attackElapsed >= (enemy.attackWindup ?? 0.4)) {
        enemy.isWindingUp = false;
        enemy.isAttacking = true;
        enemy.attackElapsed = 0;
        enemy.attackDamageApplied = false;
      }
      continue;
    }

    if (enemy.isAttacking) {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.attackElapsed = (enemy.attackElapsed ?? 0) + dt;

      if (enemy.attackElapsed >= (enemy.attackDuration ?? 0.3)) {
        enemy.isAttacking = false;
        enemy.attackElapsed = 0;
        enemy.attackDamageApplied = false;
        enemy.attackTimer = enemy.attackCooldown ?? 0.8;
      }
      continue;
    }

    if ((enemy.attackTimer ?? 0) <= 0) {
      enemy.isWindingUp = true;
      enemy.attackElapsed = 0;
      enemy.attackDamageApplied = false;
    }
  }
}
