import { explodeOnHitComponent } from './explode_on_hit.js';
import { emitProjectilesComponent } from './emit_projectiles.js';

const COMPONENTS = new Map([
  [explodeOnHitComponent.id, explodeOnHitComponent],
  [emitProjectilesComponent.id, emitProjectilesComponent],
]);

function normalizeComponent(component) {
  if (!component || typeof component !== 'object') return null;
  return {
    ...component,
    type: component.type ?? 'augment',
    stacking: component.stacking ?? 'additive',
  };
}

export function resolveComponent(componentRef) {
  if (!componentRef) return null;
  if (typeof componentRef === 'string') return normalizeComponent(COMPONENTS.get(componentRef) ?? null);
  if (typeof componentRef === 'object' && typeof componentRef.id === 'string') {
    return normalizeComponent(COMPONENTS.get(componentRef.id) ?? componentRef);
  }
  return null;
}
