import { collides } from './CollisionSystem.js';

export function updateProjectiles(projectiles, map, enemies, dt) {
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
      if (collides({ ...p, radius: 0.8 }, enemy)) {
        enemy.hp -= p.damage;
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
