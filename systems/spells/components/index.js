import { explodeOnHitComponent } from './explode_on_hit.js';
import { emitProjectilesComponent } from './emit_projectiles.js';
import { applyStatusOnHitComponent } from './apply_status_on_hit.js';
import { spawnZoneOnHitComponent } from './spawn_zone_on_hit.js';
import { increaseSpeedComponent } from './increase_speed.js';
import { increaseDamageComponent } from './increase_damage.js';
import { pierceComponent } from './pierce.js';
import { doubleBlinkComponent } from './double_blink.js';
import { thunderBlinkComponent } from './thunder_blink.js';
import { shadowBlinkComponent } from './shadow_blink.js';
import { speedBoostAfterBlinkComponent } from './speed_boost_after_blink.js';

const COMPONENTS = new Map([
  [explodeOnHitComponent.id, explodeOnHitComponent],
  [emitProjectilesComponent.id, emitProjectilesComponent],
  [applyStatusOnHitComponent.id, applyStatusOnHitComponent],
  [spawnZoneOnHitComponent.id, spawnZoneOnHitComponent],
  [increaseSpeedComponent.id, increaseSpeedComponent],
  [increaseDamageComponent.id, increaseDamageComponent],
  [pierceComponent.id, pierceComponent],
  [doubleBlinkComponent.id, doubleBlinkComponent],
  [thunderBlinkComponent.id, thunderBlinkComponent],
  [shadowBlinkComponent.id, shadowBlinkComponent],
  [speedBoostAfterBlinkComponent.id, speedBoostAfterBlinkComponent],
]);
export const ComponentRegistry = Object.freeze(Object.fromEntries(COMPONENTS));

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
    const base = COMPONENTS.get(componentRef.id) ?? {};
    return normalizeComponent({ ...base, ...componentRef });
  }
  return null;
}
