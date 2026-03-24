import { validateSpell } from './SpellValidator.js';
import { createSpellInstance } from './SpellInstance.js';
import { applyElementModifiers, composeSpellWithElement } from './ElementSystem.js';
import { getBehaviorExecutor } from './behaviors/index.js';
import { resolveComponent } from './components/index.js';
import { updateOrbitBehavior } from './behaviors/orbit.js';
import { cleanupBeamBehavior, updateBeamBehavior } from './behaviors/beam.js';
import { SpellEffectSystem } from './SpellEffectSystem.js';

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

function applyAugments(instance, components, runtimeContext) {
  for (const component of components) {
    if (component?.type !== 'augment') continue;
    component.hooks?.onAugment?.(instance, runtimeContext);
    if (typeof component?.onAugment === 'function') component.onAugment(instance, runtimeContext);
  }
}

function dispatchSpellEvent(instance, hook, payload = {}) {
  const eventPayload = { ...payload, instance };
  SpellEffectSystem.applyEffects(hook, eventPayload);
  instance.handleEvent(hook, eventPayload);
  return eventPayload;
}

function updateAreaBehavior(instance, dt, context = {}) {
  if (!['zone', 'aura', 'nova'].includes(instance?.base?.behavior)) return;
  const system = context?.system;
  const zoneState = instance.state?.zone;
  if (!system || !zoneState) return;

  if (zoneState.followSource && zoneState.source) {
    if (Number.isFinite(zoneState.source.x)) zoneState.x = zoneState.source.x;
    if (Number.isFinite(zoneState.source.y)) zoneState.y = zoneState.source.y;
  }

  zoneState.tickAccumulator = (zoneState.tickAccumulator ?? 0) + dt;
  const tickInterval = Math.max(0.05, zoneState.tickInterval ?? zoneState.tickRate ?? 0.25);
  while (zoneState.tickAccumulator >= tickInterval) {
    zoneState.tickAccumulator -= tickInterval;
    dispatchSpellEvent(instance, 'onTick', {
      ...context,
      dt: tickInterval,
      x: zoneState.x,
      y: zoneState.y,
      system,
      sourceX: zoneState.x,
      sourceY: zoneState.y,
      radius: zoneState.radius,
      damage: zoneState.damage,
    });
    const targets = system.getEntitiesInRadius(zoneState.x, zoneState.y, zoneState.radius);
    for (const target of targets) {
      system.applySpellDamage(target, zoneState.damage, {
        eventName: 'onTick',
        instance,
        sourceX: zoneState.x,
        sourceY: zoneState.y,
        hitParticleColor: instance.parameters?.hitParticleColor,
      });
      dispatchSpellEvent(instance, 'onHit', {
        ...context,
        x: target.x,
        y: target.y,
        target,
        system,
        sourceX: zoneState.x,
        sourceY: zoneState.y,
        damage: zoneState.damage,
        radius: zoneState.radius,
      });
    }
  }
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
  const castInstances = [];

  for (const spell of spells) {
    const finalSpell = composeSpellWithElement(spell, context.element ?? context.elementOverride ?? spell.element ?? null);
    const finalValidation = validateSpell(finalSpell);
    if (!finalValidation.valid) {
      return {
        ok: false,
        reason: finalValidation.reason,
        message: finalValidation.message,
        cost: finalValidation.cost,
        overload: finalValidation.overload,
      };
    }

    const instance = createSpellInstance(finalSpell);
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

    applyAugments(instance, components, runtimeContext);

    applyElementModifiers(instance);
    dispatchSpellEvent(instance, 'onCast', runtimeContext);

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
    castInstances.push(instance);
    didCastAny = true;
  }

  return didCastAny ? { ok: true, reason: 'cast', instances: castInstances } : { ok: false, reason: 'no-spells-cast', instances: [] };
}

export function updateSpellInstances(activeSpellInstances, dt, context = {}) {
  if (!Array.isArray(activeSpellInstances) || activeSpellInstances.length === 0) return;

  for (let i = activeSpellInstances.length - 1; i >= 0; i -= 1) {
    const entry = activeSpellInstances[i];
    const instance = entry?.instance;
    if (!instance) {
      activeSpellInstances.splice(i, 1);
      continue;
    }

    instance.state.age += dt;
    instance.state.tickTimer += dt;
    const targetPosition = resolveTarget(context);
    const runtimeContext = {
      ...context,
      targetPosition,
      origin: context.origin ?? context.player,
    };

    updateAreaBehavior(instance, dt, context);
    updateOrbitBehavior(instance, dt, context);
    if (instance.base.behavior === 'beam') updateBeamBehavior(instance, dt, runtimeContext);
    if (!['zone', 'aura', 'nova', 'projectile'].includes(instance.base.behavior)) {
      dispatchSpellEvent(instance, 'onTick', { ...runtimeContext, dt });
    }

    if (typeof context.shouldChannelSpellStop === 'function' && instance.state?.isChanneled) {
      if (context.shouldChannelSpellStop(instance)) instance.state.shouldExpire = true;
    }

    if (instance.state.hasHit || instance.state.shouldExpire || instance.state.age >= instance.state.lifetime) {
      const expireContext = { ...runtimeContext };
      if (['zone', 'aura', 'nova'].includes(instance.base.behavior) && instance.state.zone) {
        expireContext.x = instance.state.zone.x;
        expireContext.y = instance.state.zone.y;
        expireContext.sourceX = instance.state.zone.x;
        expireContext.sourceY = instance.state.zone.y;
        expireContext.radius = instance.state.zone.radius;
        expireContext.damage = instance.state.zone.damage;
      }
      dispatchSpellEvent(instance, 'onExpire', expireContext);
      if (instance.base.behavior === 'beam') cleanupBeamBehavior(instance, expireContext);
      activeSpellInstances.splice(i, 1);
    }
  }
}
