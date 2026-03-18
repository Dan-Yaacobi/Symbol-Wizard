const DEFAULT_CHAIN_RADIUS = 4.5;
const DEFAULT_CHAIN_TARGETS = 2;

function toStatusSet(target) {
  const statuses = new Set();
  if (target?.statusEffects instanceof Map) {
    for (const key of target.statusEffects.keys()) statuses.add(key);
  }
  if (target?.frozen) statuses.add('frozen');
  return statuses;
}

function findNearbyEnemies(system, centerTarget, radius, maxTargets = DEFAULT_CHAIN_TARGETS) {
  if (!system || !centerTarget || !Array.isArray(system.enemies)) return [];

  return system.enemies
    .filter((enemy) => enemy && enemy !== centerTarget && enemy.alive)
    .map((enemy) => ({ enemy, distance: Math.hypot(enemy.x - centerTarget.x, enemy.y - centerTarget.y) }))
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxTargets)
    .map(({ enemy }) => enemy);
}

const INTERACTION_RULES = [
  {
    id: 'fire-burn-amplify',
    eventNames: ['onHit', 'onTick'],
    element: 'fire',
    requiredStatus: 'burn',
    apply({ resolution, target, system }) {
      resolution.damageMultiplier *= 1.5;
      system?.spawnEffect?.({
        type: 'interaction-burst',
        x: target.x,
        y: target.y,
        color: '#ffb36b',
        ttl: 0.16,
      });
    },
  },
  {
    id: 'frost-burn-quench',
    eventNames: ['onHit', 'onTick'],
    element: 'frost',
    requiredStatus: 'burn',
    apply({ resolution }) {
      resolution.removeStatuses.add('burn');
      resolution.applyStatuses.push({ type: 'slow', duration: 3.5 });
      resolution.bonusDamage += 1;
      resolution.effectBursts.push({ color: '#9fd6ff' });
    },
  },
  {
    id: 'lightning-shock-chain',
    eventNames: ['onHit', 'onTick'],
    element: 'lightning',
    requiredStatus: 'shock',
    apply({ resolution, target, system, baseDamage, sourceX, sourceY }) {
      resolution.effectBursts.push({ color: '#ffe76a' });
      const chainDamage = Math.max(1, baseDamage * 0.5);
      const chainedTargets = findNearbyEnemies(system, target, DEFAULT_CHAIN_RADIUS, DEFAULT_CHAIN_TARGETS);
      for (const enemy of chainedTargets) {
        resolution.secondaryHits.push({
          target: enemy,
          damage: chainDamage,
          hitContext: {
            sourceX: Number.isFinite(sourceX) ? sourceX : target.x,
            sourceY: Number.isFinite(sourceY) ? sourceY : target.y,
            particleColor: '#ffe76a',
            strongHit: chainDamage >= 6,
          },
        });
      }
    },
  },
  {
    id: 'lightning-frozen-shatter',
    eventNames: ['onHit', 'onTick'],
    element: 'lightning',
    requiredStatus: 'frozen',
    apply({ resolution, target, baseDamage }) {
      resolution.bonusDamage += Math.max(2, baseDamage * 0.35);
      resolution.applyStatuses.push({ type: 'shock', duration: 1.5 });
      resolution.effectBursts.push({ color: '#b9f3ff' });
      resolution.knockbackMultiplier *= 1.25;
      resolution.metadata.reactedToFrozen = true;
      if (target?.frozen) resolution.clearFrozen = true;
    },
  },
  {
    id: 'poison-burn-burst',
    eventNames: ['onHit', 'onTick'],
    element: 'poison',
    requiredStatus: 'burn',
    apply({ resolution }) {
      resolution.bonusDamage += 3;
      resolution.removeStatuses.add('burn');
      resolution.effectBursts.push({ color: '#9be36d' });
    },
  },
  {
    id: 'earth-heavy-impact',
    eventNames: ['onHit', 'onTick'],
    element: 'earth',
    requiredStatus: 'any',
    apply({ resolution }) {
      resolution.knockbackMultiplier *= 1.75;
      resolution.effectBursts.push({ color: '#d1b07a' });
    },
  },
];

export class ElementInteractionSystem {
  resolve(eventName, payload = {}) {
    const { instance, target } = payload;
    const element = instance?.currentElement ?? instance?.base?.element ?? instance?.parameters?.element ?? null;
    const statuses = toStatusSet(target);
    const resolution = {
      eventName,
      element,
      triggeredRules: [],
      damageMultiplier: 1,
      bonusDamage: 0,
      knockbackMultiplier: 1,
      removeStatuses: new Set(),
      applyStatuses: [],
      secondaryHits: [],
      effectBursts: [],
      clearFrozen: false,
      metadata: {},
    };

    if (!element || !target) return resolution;

    for (const rule of INTERACTION_RULES) {
      if (!rule.eventNames.includes(eventName)) continue;
      if (rule.element !== element) continue;
      if (rule.requiredStatus !== 'any' && !statuses.has(rule.requiredStatus)) continue;
      rule.apply({ ...payload, resolution, statuses, baseDamage: payload.baseDamage ?? 0 });
      resolution.triggeredRules.push(rule.id);
    }

    return resolution;
  }

  apply(eventName, payload = {}) {
    const resolution = this.resolve(eventName, payload);
    const { system, target, baseDamage = 0, sourceX, sourceY } = payload;
    if (!target || !system) return { damageApplied: 0, resolution };

    const damage = Math.max(0, baseDamage * resolution.damageMultiplier + resolution.bonusDamage);
    const hitContext = {
      sourceX: Number.isFinite(sourceX) ? sourceX : target.x,
      sourceY: Number.isFinite(sourceY) ? sourceY : target.y,
      particleColor: payload.hitParticleColor ?? '#ffd2ad',
      strongHit: damage >= 8,
      knockbackDistance: (payload.knockbackDistance ?? 3) * resolution.knockbackMultiplier,
    };

    const damageApplied = damage > 0 ? system.damageEnemy(target, damage, hitContext) : false;

    for (const statusType of resolution.removeStatuses) {
      target.statusEffects?.delete?.(statusType);
    }
    if (resolution.clearFrozen && target?.frozen && typeof system.endFreezeOnTarget === 'function') {
      system.endFreezeOnTarget(target);
    }
    for (const status of resolution.applyStatuses) {
      system.applyStatus?.(target, status.type, status.duration);
    }
    for (const burst of resolution.effectBursts) {
      system.spawnEffect?.({
        type: 'interaction-burst',
        x: target.x,
        y: target.y,
        color: burst.color,
        ttl: 0.16,
      });
    }
    for (const hit of resolution.secondaryHits) {
      system.damageEnemy(hit.target, hit.damage, hit.hitContext);
      system.spawnEffect?.({
        type: 'lightning',
        fromX: target.x,
        fromY: target.y,
        toX: hit.target.x,
        toY: hit.target.y,
        color: '#ffe76a',
        ttl: 0.1,
      });
    }

    target.activeStatuses = target.statusEffects instanceof Map ? [...target.statusEffects.keys()] : [];
    return { damageApplied, resolution, hitContext };
  }
}

export const elementInteractionSystem = new ElementInteractionSystem();
