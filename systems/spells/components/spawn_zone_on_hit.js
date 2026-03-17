import { getBehaviorExecutor } from '../behaviors/index.js';

export const spawnZoneOnHitComponent = {
  id: 'spawn_zone_on_hit',
  type: 'trigger',
  stacking: 'ignore',
  onHit(payload, instance) {
    const { x, y, system } = payload ?? {};
    if (!system || !Number.isFinite(x) || !Number.isFinite(y)) return;

    const executeZone = getBehaviorExecutor('zone');
    executeZone(
      {
        ...instance,
        parameters: {
          ...instance.parameters,
          radius: instance.parameters?.spawnZoneRadius ?? 3,
          duration: instance.parameters?.spawnZoneDuration ?? 1.5,
          tickInterval: instance.parameters?.spawnZoneTickInterval ?? 0.3,
          damage: instance.parameters?.spawnZoneDamage ?? 1,
        },
        state: { ...(instance.state ?? {}) },
      },
      { ...payload, targetPosition: { x, y }, system },
    );
  },
};
