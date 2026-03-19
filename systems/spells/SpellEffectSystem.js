const LEGACY_EFFECT_MAP = Object.freeze({
  explode_on_hit: 'explode',
  spawn_zone_on_hit: 'zone_on_hit',
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
  const zoneInstance = {
    base: { ...(instance?.base ?? {}), behavior: 'zone' },
    currentElement: instance?.currentElement ?? instance?.base?.element ?? null,
    components: [],
    effects: [],
    config: {},
    parameters: {
      ...(instance?.parameters ?? {}),
      radius: effect.radius,
      duration: effect.duration,
      tickInterval: effect.tickInterval,
      damage: effect.damage,
      color: effect.color ?? instance?.parameters?.color ?? '#cfe7ff',
    },
    state: { age: 0, lifetime: effect.duration, tickTimer: 0 },
    handleEvent() {},
  };
  system.activeSpellInstances?.push?.({ instance: zoneInstance, components: [] });
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
    }
    return projectile;
  }

  static applyEffects(hook, context = {}) {
    const projectileEffects = Array.isArray(context?.projectile?.effects) ? context.projectile.effects : [];
    const instanceEffects = Array.isArray(context?.instance?.effects) ? context.instance.effects : [];
    const effects = projectileEffects.length > 0 ? projectileEffects : instanceEffects;
    for (const effect of effects) {
      if (!effect?.type) continue;
      switch (effect.type) {
        case 'explode':
          if (hook === 'onHit') this.#explode(effect, context);
          break;
        case 'pierce':
          if (hook === 'onHit') this.#pierce(effect, context);
          break;
        case 'chain':
          if (hook === 'onHit') this.#chain(effect, context);
          break;
        case 'bounce':
          if (hook === 'onHit' || hook === 'onExpire') this.#bounce(effect, context);
          break;
        case 'trail':
          if (hook === 'onTick') this.#trail(effect, context);
          break;
        case 'split':
          if (hook === 'onHit') this.#split(effect, context);
          break;
        case 'knockback':
          if (hook === 'onHit') this.#knockback(effect, context);
          break;
        case 'zone_on_hit':
          if (hook === 'onHit') this.#zoneOnHit(effect, context);
          break;
        default:
          break;
      }
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
    const { system, target, instance, x, y } = context;
    if (!system || !target) return;
    const visited = new Set([...(context.chainVisited ?? []), target]);
    const radius = Number.isFinite(effect.radius) ? effect.radius : 5;
    let remaining = clampInt(effect.count ?? effect.chainCount, 1, 1);
    let current = target;
    const chainDamage = Number.isFinite(effect.damage) ? effect.damage : (context.damage ?? 0) * (effect.damageMultiplier ?? 0.7);
    while (remaining > 0) {
      const candidates = (system.getEntitiesInRadius?.(current.x, current.y, radius) ?? [])
        .filter((enemy) => enemy && enemy.alive && !visited.has(enemy))
        .sort((a, b) => Math.hypot(a.x - current.x, a.y - current.y) - Math.hypot(b.x - current.x, b.y - current.y));
      const next = candidates[0];
      if (!next) break;
      visited.add(next);
      system.spawnEffect?.({ type: 'lightning', fromX: current.x, fromY: current.y, toX: next.x, toY: next.y, color: effect.color ?? '#ffe76a', ttl: 0.1 });
      system.applySpellDamage?.(next, chainDamage, { eventName: 'onHit', instance, sourceX: current.x, sourceY: current.y, hitParticleColor: effect.color ?? '#ffe76a', meta: { chainVisited: visited } });
      current = next;
      remaining -= 1;
    }
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
    if (!projectile || !system || dt <= 0) return;
    projectile.effectState ??= {};
    const interval = Math.max(0.05, effect.interval ?? effect.spawnInterval ?? 0.15);
    projectile.effectState.trailTimer = (projectile.effectState.trailTimer ?? 0) + dt;
    if (projectile.effectState.trailTimer < interval) return;
    projectile.effectState.trailTimer = 0;
    const duration = Math.max(0.1, effect.duration ?? effect.lifetime ?? 0.6);
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
    const { system, instance, x, y } = context;
    if (!system || !instance || !Number.isFinite(x) || !Number.isFinite(y)) return;
    spawnZoneInstance(system, instance, x, y, effect);
  }
}

export function buildSpellEffects(instance) {
  return SpellEffectSystem.buildEffectsForInstance(instance);
}
