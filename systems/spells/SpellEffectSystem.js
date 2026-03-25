import { runChainPropagation } from './chainPropagation.js';

const LEGACY_EFFECT_MAP = Object.freeze({
  explode_on_hit: 'explode',
  spawn_zone_on_hit: 'zone_on_hit',
  emit_projectiles: 'emit_projectiles',
  pierce: 'pierce',
});

function clampInt(value, fallback = 0, min = 0) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.floor(value));
}

function normalizeDescriptor(descriptor) {
  if (!descriptor) return null;
  if (typeof descriptor === 'string') {
    const type = LEGACY_EFFECT_MAP[descriptor] ?? descriptor;
    return { type };
  }
  if (typeof descriptor === 'object') {
    const refType = typeof descriptor.id === 'string' ? (LEGACY_EFFECT_MAP[descriptor.id] ?? descriptor.id) : null;
    if (typeof descriptor.type === 'string' && descriptor.type !== 'effect' && descriptor.type !== 'trigger' && descriptor.type !== 'augment' && descriptor.type !== 'override') {
      return { ...descriptor, type: LEGACY_EFFECT_MAP[descriptor.type] ?? descriptor.type };
    }
    if (refType) return { ...descriptor, type: refType };
  }
  return null;
}

function normalizeEffectsList(effectRefs = [], parameters = {}) {
  const normalized = [];
  for (const effectRef of effectRefs) {
    const effect = normalizeDescriptor(effectRef);
    if (!effect) continue;
    if (effect.type === 'pierce') {
      effect.count = clampInt(effect.count ?? effect.pierceCount ?? parameters.pierceCount, 1, 1);
    }
    if (effect.type === 'explode') {
      effect.radius = Number.isFinite(effect.radius) ? effect.radius : (Number.isFinite(parameters.explodeRadius) ? parameters.explodeRadius : 2.5);
      effect.damageMultiplier = Number.isFinite(effect.damageMultiplier) ? effect.damageMultiplier : (Number.isFinite(parameters.explodeDamageMultiplier) ? parameters.explodeDamageMultiplier : 0.75);
      effect.damage = Number.isFinite(effect.damage) ? effect.damage : parameters.explodeDamage;
    }
    if (effect.type === 'zone_on_hit') {
      effect.radius = Number.isFinite(effect.radius) ? effect.radius : (Number.isFinite(parameters.spawnZoneRadius) ? parameters.spawnZoneRadius : 3);
      effect.duration = Number.isFinite(effect.duration) ? effect.duration : (Number.isFinite(parameters.spawnZoneDuration) ? parameters.spawnZoneDuration : 1.5);
      effect.tickInterval = Number.isFinite(effect.tickInterval) ? effect.tickInterval : (Number.isFinite(parameters.spawnZoneTickInterval) ? parameters.spawnZoneTickInterval : 0.3);
      effect.damage = Number.isFinite(effect.damage) ? effect.damage : (Number.isFinite(parameters.spawnZoneDamage) ? parameters.spawnZoneDamage : 1);
    }
    if (effect.type === 'gravity_pull') {
      effect.radius = Number.isFinite(effect.radius) ? effect.radius : 5;
      effect.force = Number.isFinite(effect.force) ? effect.force : 3.2;
    }
    if (effect.type === 'periodic_explosion') {
      effect.interval = Number.isFinite(effect.interval) ? effect.interval : 0.7;
      effect.radius = Number.isFinite(effect.radius) ? effect.radius : 2.3;
      effect.damageMultiplier = Number.isFinite(effect.damageMultiplier) ? effect.damageMultiplier : 0.45;
    }
    if (effect.type === 'zone_trail') {
      effect.interval = Number.isFinite(effect.interval) ? effect.interval : 0.45;
      effect.minDistance = Number.isFinite(effect.minDistance) ? effect.minDistance : 0.7;
      effect.radius = Number.isFinite(effect.radius) ? effect.radius : 1.35;
      effect.duration = Number.isFinite(effect.duration) ? effect.duration : 1.4;
      effect.tickInterval = Number.isFinite(effect.tickInterval) ? effect.tickInterval : 0.25;
      effect.damageMultiplier = Number.isFinite(effect.damageMultiplier) ? effect.damageMultiplier : 0.3;
    }
    normalized.push(effect);
  }
  return normalized;
}

function getInstanceEffects(instance) {
  const directEffects = Array.isArray(instance?.effects) ? instance.effects : [];
  if (directEffects.length > 0) return normalizeEffectsList(directEffects, instance?.parameters ?? {});
  const refs = [
    ...(Array.isArray(instance?.base?.effects) ? instance.base.effects : []),
    ...(Array.isArray(instance?.components) ? instance.components : []),
  ];
  return normalizeEffectsList(refs, instance?.parameters ?? {});
}

function copyEffect(effect) {
  return effect ? { ...effect } : effect;
}

function copyComponent(component) {
  if (!component || typeof component !== 'object') return component;
  return { ...component, hooks: component.hooks ? { ...component.hooks } : component.hooks };
}

function createRuntimeHandleEvent() {
  return function handleEvent(eventName, payload) {
    this.components.forEach((component) => {
      if (typeof component?.hooks?.[eventName] === 'function') {
        component.hooks[eventName](this, payload);
      }
      if (typeof component?.[eventName] === 'function') {
        component[eventName](payload, this);
      }
    });
  };
}

function reflectVector(dx, dy, normalX, normalY) {
  const dot = dx * normalX + dy * normalY;
  return {
    dx: dx - 2 * dot * normalX,
    dy: dy - 2 * dot * normalY,
  };
}

function inferCollisionNormal(projectile, map) {
  const tx = Math.round(projectile.x);
  const ty = Math.round(projectile.y);
  const prevX = projectile.x - projectile.dx * 0.35;
  const prevY = projectile.y - projectile.dy * 0.35;
  const prevTx = Math.round(prevX);
  const prevTy = Math.round(prevY);
  const blockedX = !map?.[prevTy]?.[tx]?.walkable;
  const blockedY = !map?.[ty]?.[prevTx]?.walkable;
  if (blockedX && !blockedY) return { x: -Math.sign(projectile.dx) || -1, y: 0 };
  if (blockedY && !blockedX) return { x: 0, y: -Math.sign(projectile.dy) || -1 };
  const len = Math.hypot(projectile.dx, projectile.dy) || 1;
  return { x: -projectile.dx / len, y: -projectile.dy / len };
}

function spawnZoneInstance(system, instance, x, y, effect) {
  const parentDepth = clampInt(instance?.state?.zoneSpawnDepth, 0, 0);
  const maxDepth = clampInt(effect.maxDepth ?? effect.zoneSpawnMaxDepth, 1, 0);
  if (parentDepth >= maxDepth) return null;

  const inheritedEffects = (Array.isArray(instance?.effects) ? instance.effects : [])
    .map(copyEffect)
    .filter((item) => item?.type !== 'emit_projectiles');
  const zoneInstance = {
    base: { ...(instance?.base ?? {}), behavior: 'zone' },
    currentElement: instance?.currentElement ?? instance?.base?.element ?? null,
    components: (Array.isArray(instance?.components) ? instance.components : []).map(copyComponent),
    effects: inheritedEffects,
    config: { ...(instance?.config ?? {}), behavior: 'zone' },
    parameters: {
      ...(instance?.parameters ?? {}),
      radius: effect.radius,
      duration: effect.duration,
      tickInterval: effect.tickInterval,
      damage: effect.damage,
      color: effect.color ?? instance?.parameters?.color ?? '#cfe7ff',
    },
    state: {
      age: 0,
      lifetime: effect.duration,
      tickTimer: 0,
      hasHit: false,
      zoneSpawnDepth: parentDepth + 1,
    },
    handleEvent: createRuntimeHandleEvent(null),
  };
  zoneInstance.handleEvent = createRuntimeHandleEvent(zoneInstance);
  system.activeSpellInstances?.push?.({ instance: zoneInstance, components: zoneInstance.components });
  zoneInstance.state.zone = {
    x,
    y,
    radius: effect.radius,
    tickInterval: effect.tickInterval,
    tickAccumulator: 0,
    damage: effect.damage,
  };
  system.spawnEffect?.({ type: 'burst', x, y, radius: effect.radius, ttl: effect.duration, color: zoneInstance.parameters.color });
  return zoneInstance;
}

export class SpellEffectSystem {
  static buildEffectsForInstance(instance) {
    const effects = getInstanceEffects(instance);
    if (instance) instance.effects = effects.map(copyEffect);
    return effects;
  }

  static initializeProjectile(projectile, instance) {
    const effects = getInstanceEffects(instance).map(copyEffect);
    projectile.effects = effects;
    projectile.effectState ??= {};
    projectile.effectState.hitTargets ??= new Set();
    projectile.effectState.uniqueTargets ??= new Set();
    projectile.effectState.splitDepth = clampInt(projectile.effectState.splitDepth ?? instance?.state?.splitDepth, 0, 0);
    projectile.effectState.bounceTTL = 0;
    projectile.effectState.emitTimers ??= {};

    for (const effect of effects) {
      if (effect.type === 'pierce') {
        projectile.pierce = true;
        projectile.pierceCount = clampInt(effect.count, 1, 1);
        projectile.remainingPierce = projectile.pierceCount;
      }
      if (effect.type === 'bounce') {
        projectile.remainingBounces = clampInt(effect.count ?? effect.bounceCount, 1, 1);
      }
      if (effect.type === 'trail') {
        projectile.effectState.trailTimer = 0;
      }
      if (effect.type === 'periodic_explosion') {
        projectile.effectState.periodicExplosionTimer = 0;
      }
      if (effect.type === 'zone_trail') {
        projectile.effectState.zoneTrailTimer = 0;
        projectile.effectState.zoneTrailLastX = projectile.x;
        projectile.effectState.zoneTrailLastY = projectile.y;
      }
    }
    return projectile;
  }

  static applyEffects(hook, context = {}) {
    const projectileEffects = Array.isArray(context?.projectile?.effects) ? context.projectile.effects : [];
    const instanceEffects = Array.isArray(context?.instance?.effects) ? context.instance.effects : [];
    const effects = projectileEffects.length > 0 ? projectileEffects : instanceEffects;
    for (let effectIndex = 0; effectIndex < effects.length; effectIndex += 1) {
      const effect = effects[effectIndex];
      if (!effect?.type) continue;
      const effectContext = context;
      effectContext.effectIndex = effectIndex;
      switch (effect.type) {
        case 'explode':
          if (hook === 'onHit') this.#explode(effect, effectContext);
          break;
        case 'pierce':
          if (hook === 'onHit') this.#pierce(effect, effectContext);
          break;
        case 'chain':
          if (hook === 'onHit') this.#chain(effect, effectContext);
          break;
        case 'bounce':
          if (hook === 'onHit' || hook === 'onExpire') this.#bounce(effect, effectContext);
          break;
        case 'trail':
          if (hook === 'onTick') this.#trail(effect, effectContext);
          if ((hook === 'onHit' || hook === 'onExpire') && effect.persistOnImpact) this.#trail(effect, { ...effectContext, forceSpawn: true });
          break;
        case 'split':
          if (hook === 'onHit') this.#split(effect, effectContext);
          break;
        case 'knockback':
          if (hook === 'onHit') this.#knockback(effect, effectContext);
          break;
        case 'zone_on_hit':
          if (hook === 'onHit') this.#zoneOnHit(effect, effectContext);
          break;
        case 'gravity_pull':
          if (hook === 'onTick') this.#gravityPull(effect, effectContext);
          break;
        case 'periodic_explosion':
          if (hook === 'onTick') this.#periodicExplosion(effect, effectContext);
          break;
        case 'zone_trail':
          if (hook === 'onTick') this.#zoneTrail(effect, effectContext);
          break;
        case 'emit_projectiles':
          this.#emitProjectiles(effect, hook, effectContext);
          break;
        default:
          break;
      }
    }
  }

  static #emitProjectiles(effect, hook, context) {
    const instance = context?.instance;
    const system = context?.system;
    if (!instance || !system) return;

    const behavior = instance.base?.behavior;
    if (['zone', 'aura', 'nova'].includes(behavior)) {
      console.warn(`[SpellSystem] emit_projectiles is unsupported for area spells (spell: ${instance.base?.id ?? 'unknown'}).`);
      return;
    }

    const trigger = effect.trigger ?? (behavior === 'beam' ? 'onHit' : 'onCast');
    if (hook !== trigger) return;

    const timerStore = context?.projectile?.effectState?.emitTimers ?? (instance.state.emitTimers ??= {});
    const timerKey = `${effect.type}:${context.effectIndex ?? 0}`;
    const interval = Math.max(0.05, effect.interval ?? effect.tickInterval ?? 0.2);
    if (hook === 'onTick') {
      timerStore[timerKey] = (timerStore[timerKey] ?? 0) + (context.dt ?? 0);
      if (timerStore[timerKey] + 1e-9 < interval) return;
      timerStore[timerKey] = 0;
    } else if (hook === 'onHit') {
      const eventTime = Number.isFinite(instance.state?.age) ? instance.state.age : 0;
      const lastEmit = timerStore[timerKey] ?? Number.NEGATIVE_INFINITY;
      if ((eventTime - lastEmit) + 1e-9 < interval) return;
      timerStore[timerKey] = eventTime;
    }

    let originX = null;
    let originY = null;
    let dirX = null;
    let dirY = null;
    const projectile = context?.projectile;
    if (projectile) {
      originX = projectile.x;
      originY = projectile.y;
      dirX = projectile.dx;
      dirY = projectile.dy;
    } else if (behavior === 'beam') {
      const beam = instance.state?.beam;
      if (!beam) return;
      originX = Number.isFinite(context?.x) ? context.x : beam.originX;
      originY = Number.isFinite(context?.y) ? context.y : beam.originY;
      dirX = context?.beamBranch?.dirX ?? beam.dirX;
      dirY = context?.beamBranch?.dirY ?? beam.dirY;
    } else {
      const cast = instance.state?.cast;
      if (!cast) return;
      originX = cast.originX;
      originY = cast.originY;
      dirX = cast.dirX;
      dirY = cast.dirY;
    }

    const count = Math.max(2, clampInt(effect.count ?? effect.emitCount, 3, 2));
    const spread = Number.isFinite(effect.spreadDegrees) ? effect.spreadDegrees : 30;
    const step = count > 1 ? spread / (count - 1) : 0;
    const start = -spread / 2;

    for (let i = 0; i < count; i += 1) {
      const radians = ((start + step * i) * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const dx = dirX * cos - dirY * sin;
      const dy = dirX * sin + dirY * cos;
      const child = system.createProjectile(originX, originY, dx, dy, {
        speed: effect.speed ?? instance.parameters?.speed ?? projectile?.speed ?? 60,
        damage: Math.max(1, effect.damage ?? Math.round((effect.damageMultiplier ?? 0.6) * (context.damage ?? instance.parameters?.damage ?? projectile?.damage ?? 1))),
        ttl: Math.max(0.15, effect.ttl ?? effect.duration ?? projectile?.ttl ?? instance.parameters?.ttl ?? 0.7),
        radius: effect.radius ?? projectile?.radius ?? instance.parameters?.size ?? 1,
        color: effect.color ?? projectile?.color ?? instance.parameters?.color ?? '#9cc7ff',
        hitParticleColor: effect.color ?? projectile?.hitParticleColor ?? instance.parameters?.hitParticleColor,
        spriteFrames: projectile?.spriteFrames ?? instance.parameters?.spriteFrames,
        spellInstance: instance,
        onHit: (payload) => {
          if (!instance.parameters?.pierce) instance.state.hasHit = true;
          instance.handleEvent('onHit', payload);
        },
      });
      if (!child) continue;
      child.spellInstance = instance;
      this.initializeProjectile(child, instance);
    }
  }

  static #explode(effect, context) {
    const { system, x, y, projectile, target, damage = projectile?.damage ?? context.instance?.parameters?.damage ?? 0 } = context;
    if (!system || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (context?.meta?.originEffect === 'explode') return;
    const radius = Math.max(0.5, effect.radius ?? 2.5);
    const aoeDamage = Math.max(0, Number.isFinite(effect.damage) ? effect.damage : damage * (effect.damageMultiplier ?? 0.75));
    const seen = new Set([target].filter(Boolean));
    system.spawnEffect?.({ type: 'burst', x, y, radius, ttl: 0.2, color: effect.color ?? '#ffb36e' });
    const targets = system.getEntitiesInRadius?.(x, y, radius) ?? [];
    for (const enemy of targets) {
      if (seen.has(enemy)) continue;
      seen.add(enemy);
      system.applySpellDamage?.(enemy, aoeDamage, {
        eventName: 'onHit',
        instance: context.instance,
        sourceX: x,
        sourceY: y,
        hitParticleColor: effect.color ?? '#ffb36e',
        meta: { originEffect: 'explode' },
      });
    }
  }

  static #pierce(effect, context) {
    const projectile = context?.projectile;
    const target = context?.target;
    if (!projectile || !target) return;
    projectile.effectState ??= {};
    projectile.effectState.uniqueTargets ??= new Set();
    projectile.effectState.uniqueTargets.add(target);
    projectile.remainingPierce = Math.max(0, (projectile.remainingPierce ?? clampInt(effect.count, 1, 1)) - 1);
    context.preventDestroy = projectile.remainingPierce > 0;
  }

  static #chain(effect, context) {
    const { system, target, instance } = context;
    if (!system || !target) return;
    const maxJumps = clampInt(effect.count ?? effect.chainCount ?? effect.maxJumps, 2, 0);
    const radius = Number.isFinite(effect.radius) ? effect.radius : 5;
    const baseDamage = Number.isFinite(effect.damage) ? effect.damage : (context.damage ?? 0) * (effect.damageMultiplier ?? 0.7);
    const damageFalloff = Number.isFinite(effect.damageFalloff) ? effect.damageFalloff : 0.8;
    runChainPropagation({
      system,
      initialTarget: target,
      maxJumps,
      jumpRadius: radius,
      baseDamage,
      damageFalloff,
      onJump: ({ target: chainedTarget, damage, fromX, fromY, toX, toY, visited }) => {
        system.spawnEffect?.({ type: 'lightning', fromX, fromY, toX, toY, color: effect.color ?? '#ffe76a', ttl: 0.1 });
        system.applySpellDamage?.(chainedTarget, damage, {
          eventName: 'onHit',
          instance,
          sourceX: fromX,
          sourceY: fromY,
          hitParticleColor: effect.color ?? '#ffe76a',
          meta: { chainVisited: visited },
        });
      },
    });
  }

  static #bounce(effect, context) {
    const projectile = context?.projectile;
    const system = context?.system;
    if (!projectile || !system) return;
    projectile.remainingBounces = Math.max(0, (projectile.remainingBounces ?? clampInt(effect.count ?? effect.bounceCount, 1, 1)) - 1);
    if (projectile.remainingBounces < 0) return;
    let normal = null;
    if (context.collisionNormal) {
      normal = context.collisionNormal;
    } else if (!context.target && system.map) {
      normal = inferCollisionNormal(projectile, system.map);
    } else if (context.target) {
      const dx = projectile.x - context.target.x;
      const dy = projectile.y - context.target.y;
      const len = Math.hypot(dx, dy) || 1;
      normal = { x: dx / len, y: dy / len };
    }
    if (!normal) return;
    const bounced = reflectVector(projectile.dx, projectile.dy, normal.x, normal.y);
    const len = Math.hypot(bounced.dx, bounced.dy) || 1;
    projectile.dx = bounced.dx / len;
    projectile.dy = bounced.dy / len;
    projectile.x += projectile.dx * 0.45;
    projectile.y += projectile.dy * 0.45;
    projectile.effectState.bounceTTL = 0.06;
    system.spawnEffect?.({ type: 'debris', x: projectile.x, y: projectile.y, color: effect.color ?? '#9fdfff', ttl: 0.12, pieces: [{ angle: Math.atan2(projectile.dy, projectile.dx), speed: 0.5 }] });
    context.preventDestroy = projectile.remainingBounces > 0;
  }

  static #trail(effect, context) {
    const projectile = context?.projectile;
    const system = context?.system;
    const dt = context?.dt ?? 0;
    const forceSpawn = Boolean(context?.forceSpawn);
    if (!projectile || !system) return;
    if (!forceSpawn && dt <= 0) return;
    projectile.effectState ??= {};
    const interval = Math.max(0.05, effect.interval ?? effect.spawnInterval ?? 0.15);
    if (!forceSpawn) {
      projectile.effectState.trailTimer = (projectile.effectState.trailTimer ?? 0) + dt;
      if (projectile.effectState.trailTimer < interval) return;
      projectile.effectState.trailTimer = 0;
    }
    const durationMin = Number.isFinite(effect.durationMin) ? effect.durationMin : (Number.isFinite(effect.duration) ? effect.duration : effect.lifetime);
    const durationMax = Number.isFinite(effect.durationMax) ? effect.durationMax : durationMin;
    const rolledDuration = Number.isFinite(durationMin) && Number.isFinite(durationMax)
      ? durationMin + (Math.random() * Math.max(0, durationMax - durationMin))
      : (effect.duration ?? effect.lifetime ?? 0.6);
    const duration = Math.max(0.1, rolledDuration);
    const radius = Math.max(0.4, effect.radius ?? 1.2);
    const damage = Math.max(0, effect.damage ?? Math.max(1, (projectile.damage ?? 1) * (effect.damageMultiplier ?? 0.35)));
    spawnZoneInstance(system, context.instance, projectile.x, projectile.y, { radius, duration, tickInterval: effect.tickInterval ?? 0.25, damage, color: effect.color ?? projectile.trailColor ?? '#9fdfff' });
    system.spawnEffect?.({ type: 'burst', x: projectile.x, y: projectile.y, radius, ttl: 0.12, color: effect.color ?? projectile.trailColor ?? '#9fdfff' });
  }

  static #split(effect, context) {
    const projectile = context?.projectile;
    const system = context?.system;
    const instance = context?.instance;
    if (!projectile || !system || !instance) return;
    const depth = clampInt(projectile.effectState?.splitDepth, 0, 0);
    const maxDepth = clampInt(effect.maxDepth, 1, 1);
    if (depth >= maxDepth) return;
    const count = Math.max(2, clampInt(effect.count ?? effect.splitCount, 2, 2));
    const spread = Number.isFinite(effect.spreadDegrees) ? effect.spreadDegrees : 40;
    const step = count > 1 ? spread / (count - 1) : 0;
    const start = -spread / 2;
    for (let i = 0; i < count; i += 1) {
      const radians = ((start + step * i) * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const dx = projectile.dx * cos - projectile.dy * sin;
      const dy = projectile.dx * sin + projectile.dy * cos;
      const child = system.createProjectile(projectile.x, projectile.y, dx, dy, {
        speed: projectile.speed,
        damage: Math.max(1, (effect.damageMultiplier ?? 0.7) * (projectile.damage ?? 1)),
        ttl: Math.max(0.15, (effect.ttlMultiplier ?? 0.75) * (projectile.ttl ?? 0.6)),
        radius: projectile.radius,
        color: projectile.color,
        hitParticleColor: projectile.hitParticleColor,
        spriteFrames: projectile.spriteFrames,
        spellInstance: instance,
        onHit: projectile.onHit,
      });
      if (!child) continue;
      child.effectState = { ...(projectile.effectState ?? {}), splitDepth: depth + 1, trailTimer: 0, bounceTTL: 0, uniqueTargets: new Set(), hitTargets: new Set() };
      const childEffects = (projectile.effects ?? []).map(copyEffect).filter((item) => item.type !== 'split' || depth + 1 < maxDepth);
      child.effects = childEffects;
    }
    system.spawnEffect?.({ type: 'burst', x: projectile.x, y: projectile.y, radius: 1.5, ttl: 0.16, color: effect.color ?? projectile.color ?? '#cfe7ff' });
  }

  static #knockback(effect, context) {
    const target = context?.target;
    const system = context?.system;
    if (!target || !system) return;
    const strength = Number.isFinite(effect.strength) ? effect.strength : 5;
    system.registerHitFeedback?.(target, { sourceX: context.x ?? context.sourceX, sourceY: context.y ?? context.sourceY, particleColor: effect.color ?? context.projectile?.hitParticleColor, knockbackDistance: strength, strongHit: strength >= 6 });
  }

  static #zoneOnHit(effect, context) {
    const { system, instance, x, y, target } = context;
    if (!system || !instance || !Number.isFinite(x) || !Number.isFinite(y)) return;
    instance.state.zoneOnHitHistory ??= {};
    const historyKey = String(context.effectIndex ?? 0);
    const record = instance.state.zoneOnHitHistory[historyKey] ??= { targets: new WeakSet(), positions: new Set() };
    if (target && typeof target === 'object') {
      if (record.targets.has(target)) return;
      record.targets.add(target);
    } else {
      const positionKey = `${Math.round(x * 10)}:${Math.round(y * 10)}`;
      if (record.positions.has(positionKey)) return;
      record.positions.add(positionKey);
    }
    spawnZoneInstance(system, instance, x, y, effect);
  }

  static #gravityPull(effect, context) {
    const projectile = context?.projectile;
    const system = context?.system;
    const dt = context?.dt ?? 0;
    if (!projectile || !system || dt <= 0) return;

    const radius = Math.max(0.75, effect.radius ?? 5);
    const pullForce = Math.max(0.1, effect.force ?? 3.2);
    const targets = system.getEntitiesInRadius?.(projectile.x, projectile.y, radius) ?? [];

    for (const target of targets) {
      if (!target?.alive) continue;
      const dx = projectile.x - target.x;
      const dy = projectile.y - target.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0.05 || distance > radius) continue;
      const nx = dx / distance;
      const ny = dy / distance;
      const distanceFactor = 1 - (distance / radius);
      const step = pullForce * (0.45 + (distanceFactor * 0.55)) * dt;
      const nextTargetX = (Number.isFinite(target.targetX) ? target.targetX : target.x) + nx * step;
      const nextTargetY = (Number.isFinite(target.targetY) ? target.targetY : target.y) + ny * step;
      if (system.isWalkable?.(nextTargetX, nextTargetY) === false) continue;
      target.targetX = nextTargetX;
      target.targetY = nextTargetY;
      target.vx = (target.vx ?? 0) + nx * step * 0.35;
      target.vy = (target.vy ?? 0) + ny * step * 0.35;
    }
  }

  static #periodicExplosion(effect, context) {
    const projectile = context?.projectile;
    const system = context?.system;
    const dt = context?.dt ?? 0;
    if (!projectile || !system || dt <= 0) return;

    projectile.effectState ??= {};
    projectile.effectState.periodicExplosionTimer = (projectile.effectState.periodicExplosionTimer ?? 0) + dt;
    const interval = Math.max(0.1, effect.interval ?? 0.7);
    while (projectile.effectState.periodicExplosionTimer + 1e-9 >= interval) {
      projectile.effectState.periodicExplosionTimer -= interval;
      this.#explode(effect, {
        ...context,
        x: projectile.x,
        y: projectile.y,
        target: null,
        damage: context.damage ?? projectile.damage ?? 0,
      });
    }
  }

  static #zoneTrail(effect, context) {
    const projectile = context?.projectile;
    const system = context?.system;
    const dt = context?.dt ?? 0;
    if (!projectile || !system || dt <= 0) return;

    projectile.effectState ??= {};
    projectile.effectState.zoneTrailTimer = (projectile.effectState.zoneTrailTimer ?? 0) + dt;
    const interval = Math.max(0.08, effect.interval ?? 0.45);
    if (projectile.effectState.zoneTrailTimer + 1e-9 < interval) return;

    const previousX = Number.isFinite(projectile.effectState.zoneTrailLastX) ? projectile.effectState.zoneTrailLastX : projectile.x;
    const previousY = Number.isFinite(projectile.effectState.zoneTrailLastY) ? projectile.effectState.zoneTrailLastY : projectile.y;
    const movedDistance = Math.hypot(projectile.x - previousX, projectile.y - previousY);
    const minDistance = Math.max(0, effect.minDistance ?? 0);
    if (movedDistance + 1e-9 < minDistance) return;

    projectile.effectState.zoneTrailTimer = 0;
    projectile.effectState.zoneTrailLastX = projectile.x;
    projectile.effectState.zoneTrailLastY = projectile.y;

    const duration = Math.max(0.15, effect.duration ?? effect.lifetime ?? 1.4);
    const radius = Math.max(0.4, effect.radius ?? 1.35);
    const damage = Math.max(0, effect.damage ?? Math.max(1, (projectile.damage ?? 1) * (effect.damageMultiplier ?? 0.3)));
    spawnZoneInstance(system, context.instance, projectile.x, projectile.y, {
      radius,
      duration,
      tickInterval: effect.tickInterval ?? 0.25,
      damage,
      color: effect.color ?? projectile.color ?? '#bca7ff',
    });
    system.spawnEffect?.({ type: 'burst', x: projectile.x, y: projectile.y, radius, ttl: 0.12, color: effect.color ?? projectile.color ?? '#bca7ff' });
  }
}

export function buildSpellEffects(instance) {
  return SpellEffectSystem.buildEffectsForInstance(instance);
}
