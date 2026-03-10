import { collides } from './CollisionSystem.js';

export function updateProjectiles(projectiles, map, enemies, dt, combatTextSystem = null) {
  const deadProjectiles = new Set();
  const slain = [];

  for (const p of projectiles) {
    p.ttl -= dt;
    p.x += p.dx * p.speed * dt;
    p.y += p.dy * p.speed * dt;

    if (p.ttl <= 0) deadProjectiles.add(p);

    const tx = Math.round(p.x);
    const ty = Math.round(p.y);
    if (!map[ty] || !map[ty][tx] || !map[ty][tx].walkable) deadProjectiles.add(p);

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (collides({ ...p, radius: p.radius ?? 0.8 }, enemy)) {
        const isCritical = Math.random() < 0.2;
        const damage = isCritical ? p.damage * 2 : p.damage;
        enemy.hp -= damage;
        combatTextSystem?.spawnDamageText(enemy, damage, isCritical);
        deadProjectiles.add(p);
        if (enemy.hp <= 0) {
          enemy.alive = false;
          slain.push(enemy);
        }
      }
    }
  }

  return {
    projectiles: projectiles.filter((p) => !deadProjectiles.has(p)),
    slain,
  };
}

export function updateEnemyPlayerInteractions(enemies, player, dt, combatTextSystem = null) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    enemy.attackTimer = Math.max(0, (enemy.attackTimer ?? 0) - dt);
    if (!collides(enemy, player) || enemy.attackTimer > 0) continue;

    const damage = enemy.attackDamage ?? 1;
    player.hp = Math.max(0, player.hp - damage);
    combatTextSystem?.spawnDamageText(player, damage, false);

    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    const push = enemy.hitKnockback ?? 8;

    enemy.x += (dx / len) * push * dt;
    enemy.y += (dy / len) * push * dt;

    enemy.attackTimer = enemy.attackCooldown ?? 0.6;
  }
}
