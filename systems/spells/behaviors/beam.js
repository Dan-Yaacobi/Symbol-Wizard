import { SpellEffectSystem } from '../SpellEffectSystem.js';

const DEFAULT_BEAM_LENGTH = 16;
const DEFAULT_BEAM_WIDTH = 1.8;
const DEFAULT_BEAM_DURATION = 0.35;
const DEFAULT_BEAM_TICK_INTERVAL = 0.05;
const DEFAULT_BEAM_HIT_COOLDOWN = 0.15;
const DEFAULT_FORK_SPREAD_DEGREES = 16;

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

function spawnBeamVisual(system, instance, beam) {
  system.spawnEffect?.({
    type: 'beam',
    fromX: beam.originX,
    fromY: beam.originY,
    branches: beam.branches.map((branch) => ({
      fromX: beam.originX,
      fromY: beam.originY,
      toX: beam.originX + branch.dirX * beam.range,
      toY: beam.originY + branch.dirY * beam.range,
      width: beam.width,
      branchIndex: branch.branchIndex,
    })),
    color: instance.parameters?.color ?? '#d9ecff',
    glowColor: instance.parameters?.glowColor ?? '#f4fbff',
    ttl: beam.duration,
    maxTtl: beam.duration,
    width: beam.width,
  });
}

function applyBeamTick(instance, context = {}) {
  const system = context?.system;
  const beam = instance.state?.beam;
  if (!system || !beam) return;

  const currentTime = instance.state.age;
  const damage = beam.damage;
  const searchRadius = beam.range * 0.6 + beam.width;
  const targets = system.getEntitiesInRadius?.(
    beam.originX + beam.dirX * (beam.range * 0.5),
    beam.originY + beam.dirY * (beam.range * 0.5),
    searchRadius,
  ) ?? [];

  for (const target of targets) {
    if (!target?.alive) continue;

    for (const branch of beam.branches) {
      const relX = target.x - beam.originX;
      const relY = target.y - beam.originY;
      const projected = relX * branch.dirX + relY * branch.dirY;
      if (projected < 0 || projected > beam.range) continue;

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
  const duration = Number.isFinite(instance.parameters?.beamDuration)
    ? instance.parameters.beamDuration
    : (Number.isFinite(instance.parameters?.duration) ? instance.parameters.duration : DEFAULT_BEAM_DURATION);
  const tickInterval = Number.isFinite(instance.parameters?.tickInterval)
    ? Math.max(0.05, instance.parameters.tickInterval)
    : DEFAULT_BEAM_TICK_INTERVAL;
  const hitCooldownPerTarget = Number.isFinite(instance.parameters?.hitCooldownPerTarget)
    ? Math.max(0.01, instance.parameters.hitCooldownPerTarget)
    : DEFAULT_BEAM_HIT_COOLDOWN;
  const damage = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 2;
  const branches = buildBeamBranches(instance, dirX, dirY);

  instance.state.lifetime = duration;
  instance.state.beam = {
    originX: origin.x,
    originY: origin.y,
    targetX: targetPosition.x,
    targetY: targetPosition.y,
    dirX,
    dirY,
    range: beamLength,
    width: hitRadius,
    duration,
    tickInterval,
    tickAccumulator: tickInterval,
    hitCooldownPerTarget,
    damage,
    branches,
    lastHitTimeByTarget: new WeakMap(),
  };
  instance.state.cast = { originX: origin.x, originY: origin.y, dirX, dirY };

  spawnBeamVisual(system, instance, instance.state.beam);
  applyBeamTick(instance, context);
  instance.state.beam.tickAccumulator = 0;
  return true;
}

export function updateBeamBehavior(instance, dt, context = {}) {
  const beam = instance.state?.beam;
  if (!beam) return;
  beam.tickAccumulator = (beam.tickAccumulator ?? 0) + dt;
  while (beam.tickAccumulator + 1e-9 >= beam.tickInterval) {
    beam.tickAccumulator -= beam.tickInterval;
    applyBeamTick(instance, context);
  }
}
