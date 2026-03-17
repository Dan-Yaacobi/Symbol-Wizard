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
  const behaviorExecutor = behaviorMap[behaviorId];
  if (!behaviorExecutor) {
    return (instance) => {
      console.warn(`[SpellSystem] Missing behavior executor for "${behaviorId}" on spell "${instance?.base?.id ?? 'unknown'}".`);
      return false;
    };
  }

  return (instance, context) => Boolean(behaviorExecutor(instance, context));
}
