import { SpellEffectSystem } from '../SpellEffectSystem.js';

function cloneEffect(effect) {
  return effect && typeof effect === 'object' ? { ...effect } : effect;
}

function cloneComponent(component) {
  if (!component || typeof component !== 'object') return component;
  return { ...component, hooks: component.hooks ? { ...component.hooks } : component.hooks };
}

function buildRuntimeHandleEvent() {
  return function handleEvent(eventName, payload) {
    this.components.forEach((component) => {
      if (typeof component?.hooks?.[eventName] === 'function') component.hooks[eventName](this, payload);
      if (typeof component?.[eventName] === 'function') component[eventName](payload, this);
    });
  };
}

function triggerHit(instance, context, target, damage, sourceX, sourceY, knockbackDistance) {
  const system = context?.system;
  if (!system || !target) return;

  system.applySpellDamage(target, damage, {
    eventName: 'onHit',
    instance,
    sourceX,
    sourceY,
    hitParticleColor: instance.parameters?.hitParticleColor,
    knockbackDistance,
  });

  const hitPayload = {
    ...context,
    x: target.x,
    y: target.y,
    target,
    system,
    sourceX,
    sourceY,
    damage,
    radius: instance.parameters?.radius,
    knockbackDistance,
    instance,
  };
  SpellEffectSystem.applyEffects('onHit', hitPayload);
  instance.handleEvent('onHit', hitPayload);
}

function spawnLeaveZoneInstance(instance, context, originX, originY, radius, damage) {
  const system = context?.system;
  const activeSpellInstances = context?.activeSpellInstances;
  if (!system || !Array.isArray(activeSpellInstances)) return;

  const leaveZoneEffect = (instance.effects ?? []).find((effect) => effect?.type === 'leave_zone');
  if (!leaveZoneEffect) return;

  const duration = Number.isFinite(leaveZoneEffect.duration) ? leaveZoneEffect.duration : 2.4;
  const tickInterval = Number.isFinite(leaveZoneEffect.tickInterval) ? leaveZoneEffect.tickInterval : 0.25;
  const zoneDamageMultiplier = Number.isFinite(leaveZoneEffect.damageMultiplier) ? leaveZoneEffect.damageMultiplier : 0.45;
  const zoneDamage = Math.max(1, Math.round(damage * zoneDamageMultiplier));

  const zoneInstance = {
    base: { ...(instance.base ?? {}), behavior: 'zone' },
    currentElement: instance.currentElement ?? instance.base?.element ?? null,
    components: (Array.isArray(instance.components) ? instance.components : []).map(cloneComponent),
    effects: (Array.isArray(instance.effects) ? instance.effects : []).map(cloneEffect).filter((effect) => effect?.type !== 'bolt_burst' && effect?.type !== 'leave_zone'),
    config: { ...(instance.config ?? {}), behavior: 'zone' },
    parameters: {
      ...(instance.parameters ?? {}),
      radius,
      duration,
      tickInterval,
      damage: zoneDamage,
      color: leaveZoneEffect.color ?? instance.parameters?.color ?? '#bda2ff',
    },
    state: {
      age: 0,
      lifetime: duration,
      tickTimer: 0,
      hasHit: false,
    },
    handleEvent: null,
  };

  zoneInstance.handleEvent = buildRuntimeHandleEvent(zoneInstance);
  zoneInstance.state.zone = {
    x: originX,
    y: originY,
    radius,
    tickInterval,
    tickAccumulator: 0,
    damage: zoneDamage,
  };

  activeSpellInstances.push({ instance: zoneInstance, components: zoneInstance.components });
  system.spawnEffect?.({
    type: 'burst',
    x: originX,
    y: originY,
    radius,
    ttl: duration,
    color: zoneInstance.parameters.color,
  });
}

function spawnBoltBurst(instance, context, originX, originY) {
  const system = context?.system;
  if (!system) return;

  const boltBurstEffect = (instance.effects ?? []).find((effect) => effect?.type === 'bolt_burst');
  if (!boltBurstEffect) return;

  const boltCount = Math.max(6, Math.min(10, Math.round(boltBurstEffect.count ?? 8)));
  const speed = Number.isFinite(boltBurstEffect.speed) ? boltBurstEffect.speed : Math.max(42, instance.parameters?.speed ?? 50);
  const ttl = Number.isFinite(boltBurstEffect.ttl) ? boltBurstEffect.ttl : 0.9;
  const damageMultiplier = Number.isFinite(boltBurstEffect.damageMultiplier) ? boltBurstEffect.damageMultiplier : 0.55;
  const boltDamage = Math.max(1, Math.round((instance.parameters?.damage ?? 1) * damageMultiplier));

  const step = (Math.PI * 2) / boltCount;
  for (let i = 0; i < boltCount; i += 1) {
    const angle = i * step;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const projectile = system.createProjectile(originX, originY, dx, dy, {
      speed,
      damage: boltDamage,
      ttl,
      radius: boltBurstEffect.radius ?? 0.85,
      color: boltBurstEffect.color ?? instance.parameters?.color ?? '#b395ff',
      hitParticleColor: instance.parameters?.hitParticleColor,
      spellInstance: instance,
      onHit: (payload) => {
        SpellEffectSystem.applyEffects('onHit', payload);
        instance.handleEvent('onHit', payload);
      },
    });
    if (!projectile) continue;
    projectile.spellInstance = instance;
    SpellEffectSystem.initializeProjectile(projectile, instance);
  }
}

export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  if (!system || !origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return false;

  const originX = origin.x;
  const originY = origin.y;
  const radius = Number.isFinite(instance.parameters?.radius) ? instance.parameters.radius : 4.2;
  const damage = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 8;
  const knockbackPower = Number.isFinite(instance.parameters?.knockbackPower) ? instance.parameters.knockbackPower : 7.5;

  instance.state.cast = { originX, originY, dirX: 0, dirY: 0 };

  const targets = system.getEntitiesInRadius(originX, originY, radius);
  for (const target of targets) {
    if (!target?.alive) continue;
    const dx = target.x - originX;
    const dy = target.y - originY;
    const length = Math.hypot(dx, dy) || 1;
    const normalizedX = dx / length;
    const normalizedY = dy / length;

    const impactSourceX = target.x - normalizedX;
    const impactSourceY = target.y - normalizedY;
    triggerHit(instance, context, target, damage, impactSourceX, impactSourceY, knockbackPower);
  }

  system.spawnEffect?.({
    type: 'burst',
    x: originX,
    y: originY,
    radius,
    ttl: Number.isFinite(instance.parameters?.duration) ? instance.parameters.duration : 0.22,
    color: instance.parameters?.color ?? '#b395ff',
  });

  spawnLeaveZoneInstance(instance, context, originX, originY, radius, damage);
  spawnBoltBurst(instance, context, originX, originY);

  instance.state.hasHit = true;
  instance.state.lifetime = 0;
  return true;
}
