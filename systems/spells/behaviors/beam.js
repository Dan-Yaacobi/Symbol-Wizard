import { SpellEffectSystem } from '../SpellEffectSystem.js';

const DEFAULT_BEAM_LENGTH = 16;
const DEFAULT_BEAM_WIDTH = 1.8;
const DEFAULT_BEAM_TICK_INTERVAL = 0.05;
const DEFAULT_BEAM_HIT_COOLDOWN = 0.15;
const DEFAULT_FORK_SPREAD_DEGREES = 16;
const DEFAULT_BEAM_GROWTH_DURATION = 0.2;
const DEFAULT_BEAM_MANA_DRAIN_PER_SECOND = 18;

function buildBeamBranches(instance, dirX, dirY) {
  const splitEffect = (instance.effects ?? []).find((effect) => effect?.type === 'split');
  if (!splitEffect) return [{ dirX, dirY, offset: 0, branchIndex: 0 }];

  const branchCount = Math.max(2, Math.min(3, Math.floor(splitEffect.count ?? splitEffect.splitCount ?? 2)));
  const spread = Number.isFinite(splitEffect.spreadDegrees) ? splitEffect.spreadDegrees : DEFAULT_FORK_SPREAD_DEGREES;
  const step = branchCount > 1 ? spread / (branchCount - 1) : 0;
  const start = -spread / 2;
  const branches = [];

  for (let i = 0; i < branchCount; i += 1) {
    const degrees = start + step * i;
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    branches.push({
      dirX: dirX * cos - dirY * sin,
      dirY: dirX * sin + dirY * cos,
      offset: degrees,
      branchIndex: i,
    });
  }

  return branches;
}

function upsertBeamVisual(system, instance, beam) {
  if (!beam.visualId) beam.visualId = `beam-${instance.base?.id ?? 'spell'}-${Math.random().toString(36).slice(2)}`;
  system.upsertEffectById?.(beam.visualId, {
    type: 'beam',
    fromX: beam.originX,
    fromY: beam.originY,
    branches: beam.branches.map((branch) => ({
      fromX: beam.originX,
      fromY: beam.originY,
      toX: beam.originX + branch.dirX * beam.currentRange,
      toY: beam.originY + branch.dirY * beam.currentRange,
      width: beam.width,
      branchIndex: branch.branchIndex,
    })),
    color: instance.parameters?.color ?? '#d9ecff',
    glowColor: instance.parameters?.glowColor ?? '#f4fbff',
    ttl: Number.POSITIVE_INFINITY,
    maxTtl: Number.POSITIVE_INFINITY,
    width: beam.width,
  });
}

function applyBeamTick(instance, context = {}) {
  const system = context?.system;
  const beam = instance.state?.beam;
  if (!system || !beam) return;

  const currentTime = instance.state.age;
  const damage = beam.damage;
  const searchRadius = beam.currentRange * 0.6 + beam.width;
  const targets = system.getEntitiesInRadius?.(
    beam.originX + beam.dirX * (beam.currentRange * 0.5),
    beam.originY + beam.dirY * (beam.currentRange * 0.5),
    searchRadius,
  ) ?? [];

  for (const target of targets) {
    if (!target?.alive) continue;

    for (const branch of beam.branches) {
      const relX = target.x - beam.originX;
      const relY = target.y - beam.originY;
      const projected = relX * branch.dirX + relY * branch.dirY;
      if (projected < 0 || projected > beam.currentRange) continue;

      const perpendicular = Math.abs(relX * branch.dirY - relY * branch.dirX);
      if (perpendicular > beam.width + (target.radius ?? 1)) continue;

      const lastHit = beam.lastHitTimeByTarget.get(target) ?? Number.NEGATIVE_INFINITY;
      if ((currentTime - lastHit) + 1e-9 < beam.hitCooldownPerTarget) continue;
      beam.lastHitTimeByTarget.set(target, currentTime);

      const hitX = beam.originX + branch.dirX * projected;
      const hitY = beam.originY + branch.dirY * projected;
      system.applySpellDamage?.(target, damage, {
        eventName: 'onHit',
        instance,
        sourceX: beam.originX,
        sourceY: beam.originY,
        hitParticleColor: instance.parameters?.hitParticleColor,
      });
      const eventPayload = {
        ...context,
        x: hitX,
        y: hitY,
        target,
        system,
        instance,
        sourceX: beam.originX,
        sourceY: beam.originY,
        damage,
        beamBranch: branch,
      };
      SpellEffectSystem.applyEffects('onHit', eventPayload);
      instance.handleEvent('onHit', eventPayload);
      break;
    }
  }
}

export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  const targetPosition = context?.targetPosition;
  if (!system || !origin || !targetPosition) return false;

  const dx = targetPosition.x - origin.x;
  const dy = targetPosition.y - origin.y;
  const rawLength = Math.hypot(dx, dy);
  const length = Number.isFinite(rawLength) && rawLength > 0 ? rawLength : 1;
  const dirX = dx / length;
  const dirY = dy / length;

  const beamLength = Number.isFinite(instance.parameters?.beamLength)
    ? instance.parameters.beamLength
    : (Number.isFinite(instance.parameters?.range) ? instance.parameters.range : DEFAULT_BEAM_LENGTH);
  const hitRadius = Number.isFinite(instance.parameters?.beamWidth)
    ? instance.parameters.beamWidth
    : (Number.isFinite(instance.parameters?.width) ? instance.parameters.width : DEFAULT_BEAM_WIDTH);
  const tickInterval = Number.isFinite(instance.parameters?.tickInterval)
    ? Math.max(0.05, instance.parameters.tickInterval)
    : DEFAULT_BEAM_TICK_INTERVAL;
  const hitCooldownPerTarget = Number.isFinite(instance.parameters?.hitCooldownPerTarget)
    ? Math.max(0.01, instance.parameters.hitCooldownPerTarget)
    : DEFAULT_BEAM_HIT_COOLDOWN;
  const damage = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 2;
  const growthDuration = Number.isFinite(instance.parameters?.growthDuration)
    ? Math.max(0.08, instance.parameters.growthDuration)
    : DEFAULT_BEAM_GROWTH_DURATION;
  const manaDrainPerSecond = Number.isFinite(instance.parameters?.manaDrainPerSecond)
    ? Math.max(0, instance.parameters.manaDrainPerSecond)
    : DEFAULT_BEAM_MANA_DRAIN_PER_SECOND;
  const branches = buildBeamBranches(instance, dirX, dirY);

  instance.state.lifetime = Number.POSITIVE_INFINITY;
  instance.state.isChanneled = true;
  instance.state.beam = {
    originX: origin.x,
    originY: origin.y,
    targetX: targetPosition.x,
    targetY: targetPosition.y,
    dirX,
    dirY,
    range: beamLength,
    currentRange: 0.01,
    growthDuration,
    width: hitRadius,
    tickInterval,
    tickAccumulator: 0,
    hitCooldownPerTarget,
    damage,
    manaDrainPerSecond,
    manaAccumulator: 0,
    branches,
    lastHitTimeByTarget: new WeakMap(),
  };
  instance.state.cast = { originX: origin.x, originY: origin.y, dirX, dirY };

  upsertBeamVisual(system, instance, instance.state.beam);
  return true;
}

export function updateBeamBehavior(instance, dt, context = {}) {
  const beam = instance.state?.beam;
  if (!beam) return;
  const system = context?.system;
  const origin = context?.player;
  const targetPosition = context?.targetPosition;
  if (!system || !origin || !targetPosition) return;

  const dx = targetPosition.x - origin.x;
  const dy = targetPosition.y - origin.y;
  const rawLength = Math.hypot(dx, dy);
  const length = Number.isFinite(rawLength) && rawLength > 0 ? rawLength : 1;
  const dirX = dx / length;
  const dirY = dy / length;

  beam.originX = origin.x;
  beam.originY = origin.y;
  beam.targetX = targetPosition.x;
  beam.targetY = targetPosition.y;
  beam.dirX = dirX;
  beam.dirY = dirY;
  beam.branches = buildBeamBranches(instance, dirX, dirY);
  beam.currentRange = Math.min(
    beam.range,
    beam.currentRange + ((beam.range / Math.max(0.08, beam.growthDuration)) * dt),
  );

  beam.manaAccumulator = (beam.manaAccumulator ?? 0) + beam.manaDrainPerSecond * dt;
  if (beam.manaAccumulator > 0) {
    const manaToConsume = Math.min(context?.player?.mana ?? 0, beam.manaAccumulator);
    context.player.mana -= manaToConsume;
    beam.manaAccumulator -= manaToConsume;
  }

  if ((context?.player?.mana ?? 0) <= 1e-6) {
    context.player.mana = 0;
    instance.state.shouldExpire = true;
    return;
  }

  upsertBeamVisual(system, instance, beam);
  beam.tickAccumulator = (beam.tickAccumulator ?? 0) + dt;
  while (beam.tickAccumulator + 1e-9 >= beam.tickInterval) {
    beam.tickAccumulator -= beam.tickInterval;
    applyBeamTick(instance, context);
  }
}

export function cleanupBeamBehavior(instance, context = {}) {
  const visualId = instance.state?.beam?.visualId;
  if (!visualId) return;
  context?.system?.removeEffectById?.(visualId);
}
