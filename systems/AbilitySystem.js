import { Projectile } from '../entities/Projectile.js';

export class AbilitySystem {
  constructor({
    definitions,
    player,
    enemies,
    map,
    camera,
    spawnProjectile,
    spendGold,
    reportDamage,
    onEnemySlain,
  }) {
    this.definitions = new Map(definitions.map((ability) => [ability.id, ability]));
    this.player = player;
    this.enemies = enemies;
    this.map = map;
    this.camera = camera;
    this.spawnProjectile = spawnProjectile;
    this.spendGold = spendGold;
    this.reportDamage = reportDamage;
    this.onEnemySlain = onEnemySlain;

    this.cooldowns = new Map();
    this.upgrades = new Map();
    this.slots = [null, null, null, null];
    this.effects = [];

    this.activeFreeze = null;

    for (const ability of definitions) {
      this.upgrades.set(ability.id, 1);
      this.cooldowns.set(ability.id, 0);
    }
  }

  tick(dt) {
    for (const [abilityId, value] of this.cooldowns.entries()) {
      this.cooldowns.set(abilityId, Math.max(0, value - dt));
    }

    this.effects = this.effects
      .map((effect) => ({ ...effect, ttl: effect.ttl - dt }))
      .filter((effect) => effect.ttl > 0);

    this.updateFreeze(dt);
  }

  updateFreeze(dt) {
    if (!this.activeFreeze) return;

    this.activeFreeze.remaining -= dt;

    if (this.activeFreeze.chainFreeze) {
      this.freezeVisibleEnemies(this.activeFreeze, false);
    }

    if (this.activeFreeze.remaining <= 0) {
      this.endFreeze(this.activeFreeze);
      this.activeFreeze = null;
    }
  }

  isEnemyInFreezeRange(enemy, radiusPadding = 0) {
    const left = this.camera.x - radiusPadding;
    const top = this.camera.y - radiusPadding;
    const right = this.camera.x + this.camera.viewW + radiusPadding;
    const bottom = this.camera.y + this.camera.viewH + radiusPadding;
    return enemy.x >= left && enemy.x <= right && enemy.y >= top && enemy.y <= bottom;
  }

  freezeEnemy(enemy, freezeData, resetTimer = true) {
    if (!enemy || !enemy.alive || enemy.frozen) return false;

    enemy.frozen = true;
    enemy.freezeTint = '#9edbff';
    enemy.freezeGlow = '#d8f4ff';
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.isAttacking = false;
    enemy.attackElapsed = 0;
    enemy.attackDamageApplied = false;

    if (resetTimer) {
      enemy.attackTimer = Math.max(enemy.attackTimer ?? 0, freezeData.freezeDuration * 0.5);
    }

    freezeData.targets.add(enemy);

    this.spawnEffect({
      type: 'freeze-burst',
      x: enemy.x,
      y: enemy.y,
      radius: 2,
      color: '#a8e7ff',
      ttl: 0.16,
    });

    return true;
  }

  freezeVisibleEnemies(freezeData, resetTimer) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (!this.isEnemyInFreezeRange(enemy, freezeData.radiusPadding)) continue;
      this.freezeEnemy(enemy, freezeData, resetTimer);
    }
  }

  endFreeze(freezeData) {
    for (const enemy of freezeData.targets) {
      if (!enemy.alive) continue;
      enemy.frozen = false;
      enemy.freezeTint = null;
      enemy.freezeGlow = null;

      if (freezeData.shatterDamage > 0) {
        this.damageEnemy(enemy, freezeData.shatterDamage);
      }
    }
  }

  applyTimeFreeze({ freezeDuration, cooldownReduction, shatterDamage, vulnerabilityMultiplier, radiusPadding, chainFreeze }) {
    const ability = this.definitions.get('time-freeze');
    if (!ability) return;

    this.cooldowns.set('time-freeze', Math.max(1, ability.cooldown - cooldownReduction));

    if (this.activeFreeze) {
      this.endFreeze(this.activeFreeze);
      this.activeFreeze = null;
    }

    this.activeFreeze = {
      remaining: freezeDuration,
      freezeDuration,
      shatterDamage,
      vulnerabilityMultiplier,
      radiusPadding,
      chainFreeze,
      targets: new Set(),
    };

    this.spawnEffect({
      type: 'freeze-wave',
      x: this.player.x,
      y: this.player.y,
      radius: Math.max(this.camera.viewW, this.camera.viewH) * 0.5 + radiusPadding,
      color: '#9adfff',
      ttl: 0.22,
    });

    this.freezeVisibleEnemies(this.activeFreeze, true);
  }

  getDamageMultiplier(enemy) {
    if (!enemy || !enemy.alive || !enemy.frozen || !this.activeFreeze) return 1;
    return this.activeFreeze.vulnerabilityMultiplier ?? 1;
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

    try {
      ability.cast({ ...context, system: this, abilityLevel: level, ability });
    } catch (error) {
      this.player.mana = Math.min(this.player.maxMana, this.player.mana + ability.manaCost);
      this.cooldowns.set(ability.id, 0);
      console.error(`[AbilitySystem] Failed to cast ability "${ability.id}".`, error);
      return { ok: false, reason: 'cast-error', abilityId: ability.id };
    }

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
    const hasValidPosition = Number.isFinite(x) && Number.isFinite(y);
    const hasValidDirection = Number.isFinite(dx) && Number.isFinite(dy);

    if (!hasValidPosition || !hasValidDirection) {
      console.error('[AbilitySystem] Projectile creation aborted: invalid position or direction.', { x, y, dx, dy, overrides });
      return null;
    }

    if (typeof this.spawnProjectile !== 'function') {
      console.error('[AbilitySystem] Projectile creation aborted: spawnProjectile callback is missing.');
      return null;
    }

    const projectile = new Projectile(x, y, dx, dy);
    if (overrides && typeof overrides === 'object') Object.assign(projectile, overrides);

    if (!Array.isArray(projectile.spriteFrames) || projectile.spriteFrames.length === 0) {
      console.error('[AbilitySystem] Projectile creation aborted: projectile spriteFrames are missing.', projectile);
      return null;
    }

    this.spawnProjectile(projectile);
    return projectile;
  }

  spawnEffect(effect) {
    if (!effect || typeof effect !== 'object') return;
    this.effects.push({ ttl: 0.2, ...effect });
  }

  getActiveEffects() {
    return this.effects;
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
    const scaled = amount * this.getDamageMultiplier(enemy);
    const damage = Math.max(0, scaled);
    enemy.hp -= damage;
    this.reportDamage?.(enemy, damage, false);
    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.onEnemySlain?.(enemy);
    }
    return true;
  }

  isWalkable(x, y) {
    const tx = Math.round(x);
    const ty = Math.round(y);
    return Boolean(this.map[ty]?.[tx]?.walkable);
  }
}
