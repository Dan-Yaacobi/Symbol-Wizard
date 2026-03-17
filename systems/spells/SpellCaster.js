import { validateSpell } from './SpellValidator.js';
import { createSpellInstance } from './SpellInstance.js';
import { applyElementModifiers } from './ElementSystem.js';
import { getBehaviorExecutor } from './behaviors/index.js';
import { resolveComponent } from './components/index.js';

export function resolveTarget(context = {}) {
  if (context.targetPosition && Number.isFinite(context.targetPosition.x) && Number.isFinite(context.targetPosition.y)) {
    return { x: context.targetPosition.x, y: context.targetPosition.y };
  }

  if (context.target && Number.isFinite(context.target.x) && Number.isFinite(context.target.y)) {
    return { x: context.target.x, y: context.target.y };
  }

  const player = context.player;
  const originX = Number.isFinite(player?.x) ? player.x : 0;
  const originY = Number.isFinite(player?.y) ? player.y : 0;

  const forwardX = Number.isFinite(player?.facingX) ? player.facingX : (Number.isFinite(player?.vx) && player.vx !== 0 ? Math.sign(player.vx) : 1);
  const forwardY = Number.isFinite(player?.facingY) ? player.facingY : (Number.isFinite(player?.vy) ? Math.sign(player.vy) : 0);
  const length = Math.hypot(forwardX, forwardY) || 1;

  return {
    x: originX + (forwardX / length) * 6,
    y: originY + (forwardY / length) * 6,
  };
}

function applyComponentStackingRules(components) {
  const result = [];
  const replaceById = new Map();
  const ignoredIds = new Set();

  for (const component of components) {
    if (!component || typeof component.id !== 'string') continue;
    const stacking = component.stacking ?? 'additive';

    if (stacking === 'replace') {
      replaceById.set(component.id, component);
      continue;
    }

    if (stacking === 'ignore') {
      if (ignoredIds.has(component.id)) continue;
      ignoredIds.add(component.id);
      result.push(component);
      continue;
    }

    result.push(component);
  }

  for (const component of replaceById.values()) result.push(component);
  return result;
}

export function castSpell(spellOrArray, context = {}) {
  const spells = Array.isArray(spellOrArray) ? spellOrArray : [spellOrArray];
  if (spells.length === 0) return { ok: false, reason: 'empty-spell-list' };

  for (const spell of spells) {
    const validation = validateSpell(spell);
    if (!validation.valid) {
      return {
        ok: false,
        reason: validation.reason,
        message: validation.message,
        cost: validation.cost,
        overload: validation.overload,
      };
    }
  }

  const resolvedTarget = resolveTarget(context);
  let didCastAny = false;

  for (const spell of spells) {
    const instance = createSpellInstance(spell);
    const rawComponents = instance.components.map((componentRef) => resolveComponent(componentRef)).filter(Boolean);
    const components = applyComponentStackingRules(rawComponents);
    instance.components = components;

    console.log('[SPELL CAST]', spell.id);

    const runtimeContext = {
      ...context,
      targetPosition: resolvedTarget,
      origin: context.origin ?? context.player,
      components,
    };

    for (const component of components) component.hooks?.onCast?.(instance, runtimeContext);

    applyElementModifiers(instance);

    const overrideComponents = components.filter((component) => component.type === 'override');
    let behaviorSuccess = true;

    if (overrideComponents.length > 0) {
      for (const component of overrideComponents) {
        const didOverrideCast = component.hooks?.onBehavior?.(instance, runtimeContext);
        behaviorSuccess = Boolean(didOverrideCast) && behaviorSuccess;
      }
    } else {
      const behaviorExecutor = getBehaviorExecutor(instance.base.behavior);
      behaviorSuccess = behaviorExecutor(instance, runtimeContext);
    }

    if (!behaviorSuccess) return { ok: false, reason: `behavior-failed:${instance.base.behavior}` };

    if (Array.isArray(context.activeSpellInstances)) context.activeSpellInstances.push({ instance, components });
    didCastAny = true;
  }

  return didCastAny ? { ok: true, reason: 'cast' } : { ok: false, reason: 'no-spells-cast' };
}

export function updateSpellInstances(activeSpellInstances, dt, context = {}) {
  if (!Array.isArray(activeSpellInstances) || activeSpellInstances.length === 0) return;

  for (let i = activeSpellInstances.length - 1; i >= 0; i -= 1) {
    const entry = activeSpellInstances[i];
    const instance = entry?.instance;
    const components = entry?.components ?? [];
    if (!instance) {
      activeSpellInstances.splice(i, 1);
      continue;
    }

    instance.state.age += dt;
    instance.state.tickTimer += dt;

    for (const component of components) component.hooks?.onTick?.(instance, context);

    if (instance.state.hasHit || instance.state.age >= instance.state.lifetime) {
      for (const component of components) component.hooks?.onExpire?.(instance, context);
      activeSpellInstances.splice(i, 1);
    }
  }
}
