import { createSpellInstance } from '../SpellInstance.js';

function pointToSegmentDistance(point, start, end) {
  const segX = end.x - start.x;
  const segY = end.y - start.y;
  const lengthSq = segX * segX + segY * segY;
  if (lengthSq <= 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = ((point.x - start.x) * segX + (point.y - start.y) * segY) / lengthSq;
  const t = Math.max(0, Math.min(1, projection));
  const closestX = start.x + segX * t;
  const closestY = start.y + segY * t;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function getBlinkPathTargets(system, start, end, thickness = 0.7) {
  if (!Array.isArray(system?.enemies)) return [];
  const minX = Math.min(start.x, end.x) - thickness - 1.5;
  const maxX = Math.max(start.x, end.x) + thickness + 1.5;
  const minY = Math.min(start.y, end.y) - thickness - 1.5;
  const maxY = Math.max(start.y, end.y) + thickness + 1.5;

  const hits = [];
  for (const enemy of system.enemies) {
    if (!enemy?.alive) continue;
    if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) continue;
    if (enemy.x < minX || enemy.x > maxX || enemy.y < minY || enemy.y > maxY) continue;
    const radius = Math.max(0.35, Number.isFinite(enemy.radius) ? enemy.radius : 0.65);
    const distance = pointToSegmentDistance(enemy, start, end);
    if (distance <= radius + thickness) hits.push(enemy);
  }
  return hits;
}

function buildLightningPathPoints(start, end, options = {}) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= 0.01) {
    return [{ x: start.x, y: start.y }, { x: end.x, y: end.y }];
  }

  const segmentLength = Math.max(0.35, Number.isFinite(options.segmentLength) ? options.segmentLength : 0.5);
  const maxAmplitude = Math.max(0.1, Number.isFinite(options.amplitude) ? options.amplitude : 0.45);
  const segments = Math.max(2, Math.round(distance / segmentLength));
  const tangentX = dx / distance;
  const tangentY = dy / distance;
  const normalX = -tangentY;
  const normalY = tangentX;
  const points = [{ x: start.x, y: start.y }];

  for (let index = 1; index < segments; index += 1) {
    const t = index / segments;
    const alongX = start.x + dx * t;
    const alongY = start.y + dy * t;
    const pulse = Math.sin(t * Math.PI);
    const direction = index % 2 === 0 ? 1 : -1;
    const offset = maxAmplitude * pulse * direction;
    points.push({
      x: alongX + normalX * offset,
      y: alongY + normalY * offset,
    });
  }

  points.push({ x: end.x, y: end.y });
  return points;
}

function isTileWalkable(system, x, y) {
  if (typeof system?.isWalkable === 'function') return Boolean(system.isWalkable(x, y));
  const tx = Math.round(x);
  const ty = Math.round(y);
  return Boolean(system?.map?.[ty]?.[tx]?.walkable);
}

function canOccupyBlinkPosition(system, origin, x, y) {
  if (typeof system?.canOccupyPosition === 'function') {
    return Boolean(system.canOccupyPosition(origin, x, y));
  }

  if (!isTileWalkable(system, x, y)) return false;

  // AbilitySystem#isWalkable only probes a single tile. For blink we need occupancy validation.
  const hasMap = Array.isArray(system?.map);
  if (!hasMap) return true;

  const tileRadius = Number.isFinite(origin?.radius)
    ? Math.max(0, Math.round(origin.radius / 2))
    : 1;
  if (tileRadius <= 0) return true;

  const centerX = Math.round(x);
  const centerY = Math.round(y);

  for (let dy = -tileRadius; dy <= tileRadius; dy += 1) {
    for (let dx = -tileRadius; dx <= tileRadius; dx += 1) {
      const tx = centerX + dx;
      const ty = centerY + dy;
      if (!system.map?.[ty]?.[tx]?.walkable) return false;
    }
  }

  return true;
}

function resolvePathConstrainedDestination({ system, origin, startX, startY, dirX, dirY, desiredDistance, stepDistance }) {
  let furthestValid = { x: startX, y: startY };
  let traversed = 0;

  while (traversed < desiredDistance) {
    const nextDistance = Math.min(desiredDistance, traversed + stepDistance);
    const nextX = startX + dirX * nextDistance;
    const nextY = startY + dirY * nextDistance;

    if (canOccupyBlinkPosition(system, origin, nextX, nextY)) {
      furthestValid = { x: nextX, y: nextY };
    }

    traversed = nextDistance;
  }

  return furthestValid;
}

function spawnShadowZone(instance, context, startX, startY) {
  if (!instance?.parameters?.shadowBlink) return;
  const system = context?.system;
  if (!system) return;

  const duration = Math.max(0.4, Number.isFinite(instance.parameters.shadowZoneDuration) ? instance.parameters.shadowZoneDuration : 3.8);
  const radius = Math.max(0.5, Number.isFinite(instance.parameters.shadowZoneRadius) ? instance.parameters.shadowZoneRadius : 3.8);
  const tickInterval = Math.max(0.1, Number.isFinite(instance.parameters.shadowZoneTickInterval) ? instance.parameters.shadowZoneTickInterval : 0.35);
  const damage = Math.max(0, Number.isFinite(instance.parameters.shadowZoneDamage) ? instance.parameters.shadowZoneDamage : 2);
  const color = instance.parameters.shadowZoneColor ?? '#4a2f75';

  const zoneBaseSpell = {
    ...instance.base,
    id: `${instance.base?.id ?? 'blink'}:shadow-zone`,
    behavior: 'zone',
    components: [],
    effects: [],
    parameters: {
      damage,
      radius,
      duration,
      tickInterval,
      color,
      hitParticleColor: instance.parameters?.hitParticleColor ?? '#b39bff',
    },
  };

  const zoneInstance = createSpellInstance(zoneBaseSpell);
  zoneInstance.currentElement = instance.currentElement ?? instance.base?.element ?? 'void';
  zoneInstance.state.zone = {
    x: startX,
    y: startY,
    radius,
    tickInterval,
    tickAccumulator: 0,
    damage,
  };

  const activeSpellInstances = Array.isArray(context?.activeSpellInstances) ? context.activeSpellInstances : system.activeSpellInstances;
  activeSpellInstances?.push?.({ instance: zoneInstance, components: zoneInstance.components });
  system.spawnEffect?.({ type: 'burst', x: startX, y: startY, radius, ttl: 0.14, color });
}

export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  const targetPosition = context?.targetPosition;
  if (!system || !origin || !targetPosition) return false;

  const maxRange = Number.isFinite(instance.parameters?.range)
    ? Math.max(0, instance.parameters.range)
    : 12;
  const minRange = Number.isFinite(instance.parameters?.minimumRange)
    ? Math.max(0, Math.min(maxRange, instance.parameters.minimumRange))
    : 6;
  const startX = origin.x;
  const startY = origin.y;
  const targetDx = targetPosition.x - startX;
  const targetDy = targetPosition.y - startY;
  const targetDistance = Math.hypot(targetDx, targetDy);
  if (!Number.isFinite(targetDistance) || targetDistance <= 0) return false;

  const dirX = targetDx / targetDistance;
  const dirY = targetDy / targetDistance;
  const desiredDistance = Math.max(minRange, Math.min(maxRange, targetDistance));
  const stepDistance = Number.isFinite(instance.parameters?.blinkStepDistance)
    ? Math.max(0.02, instance.parameters.blinkStepDistance)
    : 0.1;

  const destination = resolvePathConstrainedDestination({
    system,
    origin,
    startX,
    startY,
    dirX,
    dirY,
    desiredDistance,
    stepDistance,
  });

  origin.x = destination.x;
  origin.y = destination.y;

  if (instance.parameters?.thunderBlink) {
    const stunnedTargets = getBlinkPathTargets(system, { x: startX, y: startY }, destination, instance.parameters.thunderPathWidth ?? 0.8);
    const lightningPathPoints = buildLightningPathPoints(
      { x: startX, y: startY },
      destination,
      {
        amplitude: instance.parameters.thunderTrailAmplitude ?? 0.45,
        segmentLength: instance.parameters.thunderTrailSegmentLength ?? 0.5,
      },
    );
    system.spawnEffect?.({
      type: 'lightning',
      fromX: startX,
      fromY: startY,
      toX: destination.x,
      toY: destination.y,
      points: lightningPathPoints,
      color: instance.parameters.thunderTrailColor ?? '#fff6ad',
      glowColor: instance.parameters.thunderTrailGlowColor ?? '#ffea75',
      ttl: 0.18,
    });
    const stunDuration = Math.max(0.2, Number.isFinite(instance.parameters.thunderStunDuration) ? instance.parameters.thunderStunDuration : 1.05);
    for (const enemy of stunnedTargets) {
      system.applyStatus?.(enemy, 'stun', stunDuration);
      system.spawnEffect?.({
        type: 'status-apply',
        x: enemy.x,
        y: enemy.y - 0.5,
        statusType: 'stun',
        ttl: 0.14,
      });
    }
  }

  spawnShadowZone(instance, context, startX, startY);

  if (instance.parameters?.speedBoostAfterBlink) {
    const speedBoostDuration = Number.isFinite(instance.parameters?.blinkSpeedBoostDuration)
      ? Math.max(0.2, instance.parameters.blinkSpeedBoostDuration)
      : 1.6;
    const speedBoostMultiplier = Number.isFinite(instance.parameters?.blinkSpeedBoostMultiplier)
      ? Math.max(1, instance.parameters.blinkSpeedBoostMultiplier)
      : 1.35;
    system.applyTemporaryPlayerSpeedBoost?.(speedBoostMultiplier, speedBoostDuration);
  }

  instance.state.cast = {
    originX: startX,
    originY: startY,
    destinationX: destination.x,
    destinationY: destination.y,
  };
  instance.state.hasHit = true;
  instance.state.shouldExpire = true;
  instance.state.lifetime = 0.01;

  system.spawnEffect?.({
    type: 'burst',
    x: destination.x,
    y: destination.y,
    radius: 1.8,
    ttl: 0.12,
    color: instance.parameters?.color ?? '#b39bff',
  });

  return true;
}
