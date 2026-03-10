import { Projectile } from '../entities/Projectile.js';

export class AbilitySystem {
  constructor({ definitions, player, enemies, map, camera, spawnProjectile, spendGold }) {
    this.definitions = new Map(definitions.map((ability) => [ability.id, ability]));
    this.player = player;
    this.enemies = enemies;
    this.map = map;
    this.camera = camera;
    this.spawnProjectile = spawnProjectile;
    this.spendGold = spendGold;

    this.cooldowns = new Map();
    this.upgrades = new Map();
    this.slots = [null, null, null, null];

    for (const ability of definitions) {
      this.upgrades.set(ability.id, 1);
      this.cooldowns.set(ability.id, 0);
    }
  }

  tick(dt) {
    for (const [abilityId, value] of this.cooldowns.entries()) {
      this.cooldowns.set(abilityId, Math.max(0, value - dt));
    }
  }

  assignAbilityToSlot(slotIndex, abilityId) {
    if (slotIndex < 0 || slotIndex > 3) return false;
    if (abilityId !== null && !this.definitions.has(abilityId)) return false;
    this.slots[slotIndex] = abilityId;
    return true;
  }

  swapSlots(slotA, slotB) {
    const value = this.slots[slotA];
    this.slots[slotA] = this.slots[slotB];
    this.slots[slotB] = value;
  }

  getAbilityBySlot(slotIndex) {
    const abilityId = this.slots[slotIndex];
    return abilityId ? this.definitions.get(abilityId) : null;
  }

  castSlot(slotIndex, context) {
    const ability = this.getAbilityBySlot(slotIndex);
    if (!ability) return { ok: false, reason: 'empty-slot' };

    const cooldown = this.cooldowns.get(ability.id) ?? 0;
    if (cooldown > 0) return { ok: false, reason: 'cooldown' };

    if (this.player.mana < ability.manaCost) return { ok: false, reason: 'mana' };

    this.player.mana -= ability.manaCost;
    this.cooldowns.set(ability.id, ability.cooldown);

    const level = this.upgrades.get(ability.id) ?? 1;
    ability.cast({ ...context, system: this, abilityLevel: level, ability });
    return { ok: true, reason: 'cast', abilityId: ability.id };
  }

  getCooldownPercent(abilityId) {
    const ability = this.definitions.get(abilityId);
    if (!ability) return 0;
    const remaining = this.cooldowns.get(abilityId) ?? 0;
    return ability.cooldown <= 0 ? 0 : remaining / ability.cooldown;
  }

  getUpgradeLevel(abilityId) {
    return this.upgrades.get(abilityId) ?? 1;
  }

  upgradeAbility(abilityId) {
    const ability = this.definitions.get(abilityId);
    if (!ability) return { ok: false, reason: 'unknown' };

    const level = this.upgrades.get(abilityId) ?? 1;
    const node = ability.upgrades[level];
    if (!node) return { ok: false, reason: 'maxed' };

    if (!this.spendGold(node.cost)) return { ok: false, reason: 'gold' };
    this.upgrades.set(abilityId, level + 1);
    return { ok: true };
  }

  getAbilities() {
    return [...this.definitions.values()];
  }

  createProjectile(x, y, dx, dy, overrides = {}) {
    const projectile = new Projectile(x, y, dx, dy);
    Object.assign(projectile, overrides);
    this.spawnProjectile(projectile);
  }

  findClosestEnemyInRange(x, y, range) {
    let best = null;
    let bestDist = Infinity;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dist = Math.hypot(enemy.x - x, enemy.y - y);
      if (dist <= range && dist < bestDist) {
        best = enemy;
        bestDist = dist;
      }
    }

    return best;
  }

  damageEnemy(enemy, amount) {
    if (!enemy || !enemy.alive) return false;
    enemy.hp -= amount;
    if (enemy.hp <= 0) enemy.alive = false;
    return true;
  }

  isWalkable(x, y) {
    const tx = Math.round(x);
    const ty = Math.round(y);
    return Boolean(this.map[ty]?.[tx]?.walkable);
  }
}
