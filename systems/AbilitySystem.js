import { Projectile } from '../entities/Projectile.js';
import { activateEnemyAggro } from './AISystem.js';
import { visualPalette } from '../data/VisualTheme.js';
import { castSpell, updateSpellInstances } from './spells/SpellCaster.js';
import { elementInteractionSystem } from './ElementInteractionSystem.js';
import { setEntityState } from './EntityStateSystem.js';

const STATUS_TICK_DAMAGE = {
  burn: 2,
  poison: 1,
};

export class AbilitySystem {
  constructor({ definitions, player, enemies, map, camera, spawnProjectile, reportDamage, onEnemySlain }) {
    this.definitions = new Map(definitions.map((spell) => [spell.id, spell]));
    this.player = player;
    this.enemies = enemies;
    this.map = map;
    this.camera = camera;
    this.spawnProjectile = spawnProjectile;
    this.reportDamage = reportDamage;
    this.onEnemySlain = onEnemySlain;

    this.cooldowns = new Map();
    this.slots = [null, null, null, null];
    this.effects = [];
    this.activeSpellInstances = [];
    this.activeFreeze = null;
    this.elementInteractionSystem = elementInteractionSystem;
    this.listeners = new Set();
    this.activeChannelCasts = new Map();
    this.pendingDoubleBlinkCasts = new Map();
    this.activePlayerSpeedBoost = null;

    for (const spell of definitions) {
      this.cooldowns.set(spell.id, 0);
    }
  }

  tick(dt, context = {}) {
    for (const [spellId, value] of this.cooldowns.entries()) {
      this.cooldowns.set(spellId, Math.max(0, value - dt));
    }

    this.effects = this.effects
      .map((effect) => this.updateEffect(effect, dt))
      .filter((effect) => effect.ttl > 0);

    this.updateStatusEffects(dt);
    this.updatePlayerSpeedBoost(dt);
    this.updatePendingDoubleBlink(dt);
    this.updateFreeze(dt);
    this.updatePlayerAction(dt);
    updateSpellInstances(this.activeSpellInstances, dt, {
      ...context,
      system: this,
      player: this.player,
      shouldChannelSpellStop: (instance) => this.shouldStopChanneling(instance),
    });
  }


  applyTemporaryPlayerSpeedBoost(multiplier = 1, duration = 0) {
    const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    const safeMultiplier = Number.isFinite(multiplier) ? Math.max(1, multiplier) : 1;
    if (safeDuration <= 0 || safeMultiplier <= 1) return false;

    const existing = this.activePlayerSpeedBoost;
    if (existing) {
      const remaining = Math.max(0, existing.remaining ?? 0);
      this.activePlayerSpeedBoost = {
        remaining: Math.max(remaining, safeDuration),
        multiplier: Math.max(existing.multiplier ?? 1, safeMultiplier),
      };
    } else {
      this.activePlayerSpeedBoost = { remaining: safeDuration, multiplier: safeMultiplier };
    }

    this.player.moveSpeedMultiplier = this.activePlayerSpeedBoost.multiplier;
    return true;
  }

  updatePlayerSpeedBoost(dt) {
    if (!this.player) return;
    if (!this.activePlayerSpeedBoost) {
      this.player.moveSpeedMultiplier = 1;
      return;
    }

    const nextRemaining = (this.activePlayerSpeedBoost.remaining ?? 0) - dt;
    if (nextRemaining <= 0) {
      this.activePlayerSpeedBoost = null;
      this.player.moveSpeedMultiplier = 1;
      return;
    }

    this.activePlayerSpeedBoost = { ...this.activePlayerSpeedBoost, remaining: nextRemaining };
    this.player.moveSpeedMultiplier = this.activePlayerSpeedBoost.multiplier ?? 1;
  }

  updatePendingDoubleBlink(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.pendingDoubleBlinkCasts.size === 0) return;
    for (const [spellId, pending] of this.pendingDoubleBlinkCasts.entries()) {
      const nextRemaining = (pending.remaining ?? 0) - dt;
      if (nextRemaining > 0) {
        this.pendingDoubleBlinkCasts.set(spellId, { ...pending, remaining: nextRemaining });
        continue;
      }
      const spell = this.definitions.get(spellId);
      const cooldown = this.getSpellCooldownValue(spell);
      this.cooldowns.set(spellId, cooldown);
      this.pendingDoubleBlinkCasts.delete(spellId);
      this.emitChange('double-blink-expired', { abilityId: spellId });
    }
  }

  getSpellManaCost(spell) {
    if (!spell) return 0;
    if (Number.isFinite(spell.parameters?.manaCost)) return Math.max(0, spell.parameters.manaCost);
    return Math.max(0, spell.manaCost ?? 0);
  }

  getSpellCooldownValue(spell) {
    if (!spell) return 0;
    if (Number.isFinite(spell.parameters?.cooldown)) return Math.max(0, spell.parameters.cooldown);
    return Math.max(0, spell.cooldown ?? 0);
  }

  spellHasAugment(spell, augmentId) {
    if (!spell || !augmentId) return false;
    const componentMatch = (spell.components ?? []).some((component) => (
      component === augmentId
      || component?.id === augmentId
      || component?.type === augmentId
    ));
    if (componentMatch) return true;
    return (spell.effects ?? []).some((effect) => effect?.id === augmentId || effect?.type === augmentId);
  }


  updatePlayerAction(dt) {
    const action = this.player?.activeAction;
    if (!action) return;

    action.elapsed = (action.elapsed ?? 0) + dt;
    if (action.elapsed >= (action.duration ?? 0)) {
      this.player.activeAction = null;
    }
  }

  updateEffect(effect, dt) {
    if (!effect || typeof effect !== 'object') return { ttl: 0 };

    if (effect.type === 'hit-particles') {
      const particles = (effect.particles ?? [])
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * dt,
          y: particle.y + particle.vy * dt,
          life: particle.life - dt,
        }))
        .filter((particle) => particle.life > 0);

      const ttl = particles.reduce((maxLife, particle) => Math.max(maxLife, particle.life), 0);
      return { ...effect, particles, ttl };
    }

    return { ...effect, ttl: effect.ttl - dt };
  }

  updateStatusEffects(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    const statusTargets = [this.player, ...this.enemies];
    for (const target of statusTargets) {
      if (!target?.statusEffects || !(target.statusEffects instanceof Map) || target.statusEffects.size === 0) {
        target.activeStatuses = [];
        continue;
      }

      const activeStatuses = [];
      for (const [type, status] of target.statusEffects.entries()) {
        const duration = Math.max(0, Number.isFinite(status?.duration) ? status.duration - dt : 0);
        if (duration <= 0) {
          target.statusEffects.delete(type);
          continue;
        }

        const nextTickTimer = (Number.isFinite(status?.tickTimer) ? status.tickTimer : 0) + dt;
        const nextPulseTimer = (Number.isFinite(status?.pulseTimer) ? status.pulseTimer : 0) + dt;
        const shouldPulse = nextPulseTimer >= 0.25;

        target.statusEffects.set(type, {
          ...status,
          type,
          duration,
          tickTimer: nextTickTimer >= 0.5 ? 0 : nextTickTimer,
          pulseTimer: shouldPulse ? 0 : nextPulseTimer,
          pulseFlash: shouldPulse ? 0.12 : Math.max(0, (status?.pulseFlash ?? 0) - dt),
        });

        activeStatuses.push(type);

        if (nextTickTimer >= 0.5) {
          const tickDamage = this.getStatusTickDamage(type, status, target);
          if (tickDamage > 0) {
            console.log('[STATUS DAMAGE]', type, tickDamage);
            this.applySpellDamage(target, tickDamage, {
              eventName: 'onTick',
              instance: { currentElement: type, base: { element: type } },
              sourceX: target.x,
              sourceY: target.y,
              hitParticleColor: type === 'burn' ? '#ffb36b' : '#9be36d',
            });
          }

          this.spawnEffect({
            type: 'status-tick',
            x: target.x,
            y: target.y - 1,
            statusType: type,
            ttl: 0.12,
          });
        }
      }

      target.activeStatuses = activeStatuses;
    }
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
    enemy.freezeTint = visualPalette.enemy.frozen;
    enemy.freezeGlow = '#d8f4ff';
    enemy.vx = 0;
    enemy.vy = 0;
    setEntityState(enemy, 'idle');

    if (resetTimer) {
      enemy.attackTimer = Math.max(enemy.attackTimer ?? 0, freezeData.freezeDuration * 0.5);
    }

    freezeData.targets.add(enemy);

    this.spawnEffect({
      type: 'freeze-burst',
      x: enemy.x,
      y: enemy.y,
      radius: 2,
      color: visualPalette.enemy.frozen,
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
      this.endFreezeOnTarget(enemy, freezeData);
    }
  }

  endFreezeOnTarget(enemy, freezeData = this.activeFreeze) {
    if (!enemy) return false;
    enemy.frozen = false;
    enemy.freezeTint = null;
    enemy.freezeGlow = null;
    freezeData?.targets?.delete?.(enemy);

    if (enemy.alive && (freezeData?.shatterDamage ?? 0) > 0) this.damageEnemy(enemy, freezeData.shatterDamage);
    return true;
  }

  applyTimeFreeze({ freezeDuration, cooldownReduction, shatterDamage, vulnerabilityMultiplier, radiusPadding, chainFreeze }) {
    const spell = this.definitions.get('time-freeze');
    if (!spell) return;

    this.cooldowns.set('time-freeze', Math.max(1, spell.cooldown - cooldownReduction));

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
      color: visualPalette.enemy.frozen,
      ttl: 0.22,
    });

    this.freezeVisibleEnemies(this.activeFreeze, true);
  }

  getDamageMultiplier(enemy) {
    if (!enemy || !enemy.alive || !enemy.frozen || !this.activeFreeze) return 1;
    return this.activeFreeze.vulnerabilityMultiplier ?? 1;
  }

  assignAbilityToSlot(slotIndex, spellId) {
    if (slotIndex < 0 || slotIndex > 3) return false;
    if (spellId !== null && !this.definitions.has(spellId)) return false;
    this.slots[slotIndex] = spellId;
    this.emitChange('slot-assignment', { slotIndex, spellId });
    return true;
  }

  swapSlots(slotA, slotB) {
    const value = this.slots[slotA];
    this.slots[slotA] = this.slots[slotB];
    this.slots[slotB] = value;
  }

  getAbilityBySlot(slotIndex) {
    const spellId = this.slots[slotIndex];
    return spellId ? this.definitions.get(spellId) : null;
  }

  castSlot(slotIndex, context) {
    const spell = this.getAbilityBySlot(slotIndex);
    if (!spell) return { ok: false, reason: 'empty-slot' };
    if (spell.behavior === 'beam') return this.beginChannelCast(slotIndex, context);

    const hasDoubleBlink = spell.behavior === 'blink' && this.spellHasAugment(spell, 'double_blink');
    const pendingDoubleBlink = hasDoubleBlink ? this.pendingDoubleBlinkCasts.get(spell.id) : null;
    const cooldown = this.cooldowns.get(spell.id) ?? 0;
    if (cooldown > 0) return { ok: false, reason: 'cooldown' };

    const manaCost = this.getSpellManaCost(spell);
    const cooldownDuration = this.getSpellCooldownValue(spell);
    if (this.player.mana < manaCost) return { ok: false, reason: 'mana' };

    this.player.mana -= manaCost;
    const shouldDelayCooldown = hasDoubleBlink && !pendingDoubleBlink;
    this.cooldowns.set(spell.id, shouldDelayCooldown ? 0 : cooldownDuration);
    this.emitChange('cast-started', { abilityId: spell.id, slotIndex });
    this.player.activeAction = {
      type: 'cast',
      duration: this.player.castCooldown ?? 0.24,
      elapsed: 0,
      movementPolicy: 'free',
    };

    try {
      if (spell.behavior) {
        const castResult = castSpell(spell, {
          ...context,
          system: this,
          player: this.player,
          activeSpellInstances: this.activeSpellInstances,
        });
        if (!castResult.ok) {
          this.player.mana = Math.min(this.player.maxMana, this.player.mana + manaCost);
          this.cooldowns.set(spell.id, 0);
          return { ok: false, reason: castResult.reason, abilityId: spell.id };
        }
      } else {
        spell.cast({ ...context, system: this, spellLevel: 1, spell });
      }
    } catch (error) {
      this.player.mana = Math.min(this.player.maxMana, this.player.mana + manaCost);
      this.cooldowns.set(spell.id, 0);
      console.error(`[AbilitySystem] Failed to cast spell "${spell.id}".`, error);
      return { ok: false, reason: 'cast-error', abilityId: spell.id };
    }

    if (hasDoubleBlink) {
      if (pendingDoubleBlink) {
        this.pendingDoubleBlinkCasts.delete(spell.id);
        this.cooldowns.set(spell.id, cooldownDuration);
      } else {
        const windowDuration = Number.isFinite(spell.parameters?.doubleBlinkWindow)
          ? Math.max(0.2, spell.parameters.doubleBlinkWindow)
          : 2.5;
        this.pendingDoubleBlinkCasts.set(spell.id, { remaining: windowDuration });
        this.cooldowns.set(spell.id, 0);
      }
    }

    return { ok: true, reason: 'cast', abilityId: spell.id };
  }

  beginChannelCast(slotIndex, context = {}) {
    const existing = this.activeChannelCasts.get(slotIndex);
    if (existing?.active) return { ok: true, reason: 'already-channeling', abilityId: existing.abilityId };

    const spell = this.getAbilityBySlot(slotIndex);
    if (!spell) return { ok: false, reason: 'empty-slot' };
    if (this.player.mana <= 0) return { ok: false, reason: 'mana' };

    const cooldown = this.cooldowns.get(spell.id) ?? 0;
    if (cooldown > 0) return { ok: false, reason: 'cooldown' };

    const castResult = castSpell(spell, {
      ...context,
      system: this,
      player: this.player,
      activeSpellInstances: this.activeSpellInstances,
    });
    if (!castResult.ok) return { ok: false, reason: castResult.reason, abilityId: spell.id };

    const instance = castResult.instances?.[0];
    this.activeChannelCasts.set(slotIndex, {
      slotIndex,
      abilityId: spell.id,
      spell,
      active: true,
      instance,
    });
    this.emitChange('cast-started', { abilityId: spell.id, slotIndex, channeling: true });
    return { ok: true, reason: 'channel-started', abilityId: spell.id };
  }

  endChannelCast(slotIndex, reason = 'released') {
    const channel = this.activeChannelCasts.get(slotIndex);
    if (!channel?.active) return false;
    channel.active = false;
    if (channel.instance?.state) channel.instance.state.shouldExpire = true;
    this.cooldowns.set(channel.spell.id, channel.spell.cooldown);
    this.activeChannelCasts.delete(slotIndex);
    this.emitChange('cast-ended', { abilityId: channel.abilityId, slotIndex, reason, channeling: true });
    return true;
  }

  shouldStopChanneling(instance) {
    for (const [slotIndex, channel] of this.activeChannelCasts.entries()) {
      if (!channel.active) continue;
      if (channel.instance === instance) {
        if (!instance?.state?.beam) return true;
        if (this.player.mana <= 0) {
          this.endChannelCast(slotIndex, 'mana-empty');
          return true;
        }
        return false;
      }
    }
    return Boolean(instance?.state?.isChanneled);
  }

  getCooldownPercent(spellId) {
    const spell = this.definitions.get(spellId);
    if (!spell) return 0;
    const remaining = this.cooldowns.get(spellId) ?? 0;
    const duration = this.getSpellCooldownValue(spell);
    return duration <= 0 ? 0 : remaining / duration;
  }

  getCooldownRemaining(spellId) {
    return Math.max(0, this.cooldowns.get(spellId) ?? 0);
  }

  getCooldownDuration(spellId) {
    const spell = this.definitions.get(spellId);
    return this.getSpellCooldownValue(spell);
  }

  getAbilities() {
    return [...this.definitions.values()];
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitChange(type, detail = {}) {
    for (const listener of this.listeners) {
      listener({ type, ...detail });
    }
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
    const ttl = effect.ttl ?? 0.2;
    this.effects.push({ ttl, maxTtl: ttl, ...effect });
  }

  upsertEffectById(effectId, effect) {
    if (!effectId || !effect || typeof effect !== 'object') return;
    const index = this.effects.findIndex((entry) => entry?.effectId === effectId);
    if (index >= 0) {
      const current = this.effects[index];
      this.effects[index] = { ...current, ...effect, effectId };
      return;
    }
    const ttl = Number.isFinite(effect.ttl) ? effect.ttl : Number.POSITIVE_INFINITY;
    this.effects.push({ ttl, maxTtl: ttl, ...effect, effectId });
  }

  removeEffectById(effectId) {
    if (!effectId) return;
    this.effects = this.effects.filter((effect) => effect?.effectId !== effectId);
  }

  getActiveEffects() {
    return this.effects;
  }


  getEntitiesInRadius(x, y, radius) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) return [];
    return this.enemies.filter((enemy) => enemy.alive && Math.hypot(enemy.x - x, enemy.y - y) <= radius);
  }

  applyDamage(target, amount) {
    return this.damageEnemy(target, amount, {
      sourceX: Number.isFinite(target?.x) ? target.x : this.player?.x ?? 0,
      sourceY: Number.isFinite(target?.y) ? target.y : this.player?.y ?? 0,
      particleColor: '#ffd2ad',
      strongHit: amount >= 8,
    });
  }

  applySpellDamage(target, amount, context = {}) {
    if (!target || target.alive === false) return { damageApplied: false, resolution: { triggeredRules: [] } };
    const eventName = context.eventName ?? 'onHit';
    const instance = context.instance ?? null;

    if (!instance) {
      return {
        damageApplied: this.damageEnemy(target, amount, {
          sourceX: context.sourceX ?? target.x,
          sourceY: context.sourceY ?? target.y,
          particleColor: context.hitParticleColor ?? '#ffd2ad',
          strongHit: amount >= 8,
          knockbackDistance: context.knockbackDistance,
        }),
        resolution: { triggeredRules: [] },
      };
    }

    return this.elementInteractionSystem.apply(eventName, {
      ...context,
      system: this,
      instance,
      target,
      baseDamage: amount,
    });
  }

  applyStatus(target, type, duration) {
    if (!target || typeof type !== 'string') return false;
    const finalDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    target.statusEffects ??= new Map();
    const current = target.statusEffects.get(type);
    const remaining = Number.isFinite(current?.duration) ? current.duration : 0;
    target.statusEffects.set(type, {
      type,
      duration: Math.max(remaining, finalDuration),
      appliedAt: Date.now(),
      tickTimer: 0,
      pulseTimer: 0,
      pulseFlash: 0.14,
    });

    target.activeStatuses = [...target.statusEffects.keys()];

    this.spawnEffect({
      type: 'status-apply',
      x: target.x,
      y: target.y,
      statusType: type,
      ttl: 0.2,
    });

    return true;
  }

  getStatusTickDamage(type, status, target) {
    if (!target || target.alive === false) return 0;
    if (Number.isFinite(status?.damagePerTick)) return Math.max(0, status.damagePerTick);
    return STATUS_TICK_DAMAGE[type] ?? 0;
  }

  damageEnemy(enemy, amount, hitContext = {}) {
    if (!enemy || !enemy.alive) return false;
    activateEnemyAggro(enemy, this.player, this);
    const scaled = amount * this.getDamageMultiplier(enemy);
    const damage = Math.max(0, scaled);
    enemy.hp -= damage;
    console.log('[FLOATING TEXT]', damage);
    this.reportDamage?.(enemy, damage, false);
    this.registerHitFeedback(enemy, hitContext);
    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.onEnemySlain?.(enemy);
    }
    return true;
  }

  registerHitFeedback(enemy, hitContext = {}) {
    if (!enemy || !enemy.alive) return;

    const flashDuration = 0.1;
    enemy.hitFlashDuration = flashDuration;
    enemy.hitFlashTimer = flashDuration;

    const sourceX = Number.isFinite(hitContext.sourceX) ? hitContext.sourceX : this.player?.x ?? enemy.x;
    const sourceY = Number.isFinite(hitContext.sourceY) ? hitContext.sourceY : this.player?.y ?? enemy.y;

    const dx = enemy.x - sourceX;
    const dy = enemy.y - sourceY;
    const length = Math.hypot(dx, dy) || 1;

    const knockbackDuration = 0.08;
    const knockbackDistance = Number.isFinite(hitContext.knockbackDistance) ? hitContext.knockbackDistance : 3;
    const knockbackSpeed = knockbackDistance / knockbackDuration;

    enemy.hitKnockbackX = (dx / length) * knockbackSpeed;
    enemy.hitKnockbackY = (dy / length) * knockbackSpeed;
    enemy.hitKnockbackTimer = knockbackDuration;

    this.spawnHitParticles(enemy.x, enemy.y, hitContext.particleColor ?? '#d9dce3');

    if (hitContext.strongHit) this.camera?.startShake?.(0.1, 0.45);
  }

  spawnHitParticles(x, y, color = '#d9dce3') {
    const count = 4 + Math.floor(Math.random() * 5);
    const particles = [];

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 18 + Math.random() * 26;
      const life = 0.2 + Math.random() * 0.2;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
      });
    }

    this.spawnEffect({ type: 'hit-particles', color, particles, ttl: Math.max(...particles.map((particle) => particle.life)) });
  }

  isWalkable(x, y) {
    const tx = Math.round(x);
    const ty = Math.round(y);
    return Boolean(this.map[ty]?.[tx]?.walkable);
  }
}
