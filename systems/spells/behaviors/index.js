import { executeBehavior as executeProjectile } from './projectile.js';
import { executeBehavior as executeZone } from './zone.js';
import { executeBehavior as executeBeam } from './beam.js';
import { executeBehavior as executeChain } from './chain.js';
import { executeBehavior as executeOrbit } from './orbit.js';
import { executeBehavior as executeNova } from './nova.js';
import { executeBehavior as executeAura } from './aura.js';

const behaviorMap = {
  projectile: executeProjectile,
  zone: executeZone,
  beam: executeBeam,
  burst: (instance) => {
    console.warn(`[SpellSystem] Behavior "${instance?.base?.behavior}" is not implemented yet.`);
    return false;
  },
  chain: executeChain,
  summon: (instance) => {
    console.warn(`[SpellSystem] Behavior "${instance?.base?.behavior}" is not implemented yet.`);
    return false;
  },
  orbit: executeOrbit,
  aura: executeAura,
  nova: executeNova,
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
