import { executeBehavior as executeProjectile } from './projectile.js';
import { executeBehavior as executeZone } from './zone.js';
import { executeBehavior as executeBeam } from './beam.js';

const behaviorMap = {
  projectile: executeProjectile,
  zone: executeZone,
  beam: executeBeam,
  burst: (instance) => {
    console.warn(`[SpellSystem] Behavior "${instance?.base?.behavior}" is not implemented yet.`);
    return false;
  },
  summon: (instance) => {
    console.warn(`[SpellSystem] Behavior "${instance?.base?.behavior}" is not implemented yet.`);
    return false;
  },
  orbit: (instance) => {
    console.warn(`[SpellSystem] Behavior "${instance?.base?.behavior}" is not implemented yet.`);
    return false;
  },
};

export function getBehaviorExecutor(behaviorId) {
  return behaviorMap[behaviorId] ?? null;
}
