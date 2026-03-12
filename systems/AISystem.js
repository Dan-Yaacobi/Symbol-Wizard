export function updateEnemies(enemies, player, dt) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    if (enemy.hitFlashTimer > 0) {
      enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
    }

    if (enemy.hitKnockbackTimer > 0) {
      enemy.x += enemy.hitKnockbackX * dt;
      enemy.y += enemy.hitKnockbackY * dt;
      enemy.hitKnockbackTimer = Math.max(0, enemy.hitKnockbackTimer - dt);
      if (enemy.hitKnockbackTimer === 0) {
        enemy.hitKnockbackX = 0;
        enemy.hitKnockbackY = 0;
      }
    }

    if (enemy.frozen) {
      enemy.vx = 0;
      enemy.vy = 0;
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

    if (enemy.isAttacking) {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.attackElapsed = (enemy.attackElapsed ?? 0) + dt;

      if (enemy.attackElapsed >= (enemy.attackDuration ?? 0.3)) {
        enemy.isAttacking = false;
        enemy.attackElapsed = 0;
        enemy.attackDamageApplied = false;
      }
      continue;
    }

    if (inAttackRange) {
      enemy.vx = 0;
      enemy.vy = 0;

      if ((enemy.attackTimer ?? 0) <= 0) {
        enemy.isAttacking = true;
        enemy.attackElapsed = 0;
        enemy.attackDamageApplied = false;
        enemy.attackTimer = enemy.attackCooldown ?? 0.6;
      }
      continue;
    }

    const jitter = enemy.kind === 'slime' ? Math.sin(performance.now() * 0.01 + enemy.x) * 0.3 : 0;
    enemy.vx = (dx / len) * enemy.speed + jitter;
    enemy.vy = (dy / len) * enemy.speed;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  }
}
