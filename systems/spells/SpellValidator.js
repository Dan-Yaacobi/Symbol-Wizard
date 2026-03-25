const LEGACY_EFFECT_MAP = Object.freeze({
  explode_on_hit: 'explode',
  spawn_zone_on_hit: 'zone_on_hit',
  emit_projectiles: 'emit_projectiles',
  pierce: 'pierce',
});

function normalizeEffectType(ref) {
  if (typeof ref === 'string') return LEGACY_EFFECT_MAP[ref] ?? ref;
  if (ref && typeof ref === 'object') return LEGACY_EFFECT_MAP[ref.id] ?? ref.type ?? ref.id ?? null;
  return null;
}

function collectEffectTypes(spell) {
  return new Set([
    ...(Array.isArray(spell?.components) ? spell.components : []),
    ...(Array.isArray(spell?.effects) ? spell.effects : []),
  ].map(normalizeEffectType).filter(Boolean));
}

const VALID_BEHAVIORS = new Set(['projectile', 'zone', 'beam', 'burst', 'summon', 'orbit', 'chain', 'aura', 'nova', 'blink']);

function validateBehaviorParameters(behavior, parameters, cost, overload) {
  if (behavior === 'projectile') {
    if (!Number.isFinite(parameters?.speed)) {
      return { valid: false, reason: 'invalid-projectile-speed', message: 'Projectile spells require a numeric parameters.speed.', cost, overload };
    }
    if (!Number.isFinite(parameters?.damage)) {
      return { valid: false, reason: 'invalid-projectile-damage', message: 'Projectile spells require a numeric parameters.damage.', cost, overload };
    }
  }

  if (behavior === 'zone' && !Number.isFinite(parameters?.radius)) {
    return { valid: false, reason: 'invalid-zone-radius', message: 'Zone spells require a numeric parameters.radius.', cost, overload };
  }

  if (behavior === 'beam' && !Number.isFinite(parameters?.duration)) {
    return { valid: false, reason: 'invalid-beam-duration', message: 'Beam spells require a numeric parameters.duration.', cost, overload };
  }

  if (behavior === 'chain' && !Number.isFinite(parameters?.maxJumps ?? parameters?.chainCount)) {
    return { valid: false, reason: 'invalid-max-jumps', message: 'Chain spells require a numeric parameters.maxJumps.', cost, overload };
  }
  if (behavior === 'chain') {
    const maxJumps = parameters?.maxJumps ?? parameters?.chainCount;
    if (!Number.isInteger(maxJumps)) {
      return { valid: false, reason: 'invalid-max-jumps-integer', message: 'Chain spells require an integer parameters.maxJumps.', cost, overload };
    }
    if (maxJumps < 4 || maxJumps > 10) {
      return { valid: false, reason: 'invalid-max-jumps-bounds', message: 'Chain spells require parameters.maxJumps in the range [4, 10].', cost, overload };
    }
  }

  if (behavior === 'blink' && !Number.isFinite(parameters?.range)) {
    return { valid: false, reason: 'invalid-blink-range', message: 'Blink spells require a numeric parameters.range.', cost, overload };
  }

  if (['zone', 'aura', 'nova'].includes(behavior)) {
    if (!Number.isFinite(parameters?.radius)) {
      return { valid: false, reason: `invalid-${behavior}-radius`, message: `${behavior[0].toUpperCase()}${behavior.slice(1)} spells require a numeric parameters.radius.`, cost, overload };
    }
    if (!Number.isFinite(parameters?.duration)) {
      return { valid: false, reason: `invalid-${behavior}-duration`, message: `${behavior[0].toUpperCase()}${behavior.slice(1)} spells require a numeric parameters.duration.`, cost, overload };
    }
  }

  return { valid: true, reason: 'ok', message: 'ok', cost, overload };
}

function validateCompatibility(spell, cost, overload) {
  const effects = collectEffectTypes(spell);
  if (['zone', 'aura', 'nova'].includes(spell.behavior)) {
    for (const effectType of ['pierce', 'bounce', 'split', 'emit_projectiles']) {
      if (effects.has(effectType)) {
        return { valid: false, reason: `unsupported-${spell.behavior}-${effectType}`, message: `${spell.behavior[0].toUpperCase()}${spell.behavior.slice(1)} spells do not support ${effectType}.`, cost, overload };
      }
    }
  }

  if (spell.behavior === 'beam') {
    for (const effectType of ['pierce', 'bounce']) {
      if (effects.has(effectType)) {
        return { valid: false, reason: `unsupported-beam-${effectType}`, message: `Beam spells do not support ${effectType}.`, cost, overload };
      }
    }
  }

  return { valid: true, reason: 'ok', message: 'ok', cost, overload };
}

export function validateSpell(spell) {
  if (!spell || typeof spell !== 'object') {
    return { valid: false, reason: 'missing-spell', message: 'Spell payload is missing or invalid.', cost: 0, overload: false };
  }

  const requiredFields = ['id', 'name', 'description', 'behavior', 'targeting', 'element', 'components', 'parameters', 'cost'];
  for (const field of requiredFields) {
    if (!(field in spell)) {
      return { valid: false, reason: `missing-${field}`, message: `Spell is missing required field: ${field}.`, cost: 0, overload: false };
    }
  }

  const cost = Number.isFinite(spell.cost) ? spell.cost : Number.NaN;
  if (!Number.isFinite(cost)) return { valid: false, reason: 'invalid-cost', message: 'Spell cost must be numeric.', cost: 0, overload: false };
  if (cost > 150) return { valid: false, reason: 'cost-too-high', message: 'Spell cost exceeds maximum allowed value (150).', cost, overload: false };

  const overload = cost > 100;

  if (!VALID_BEHAVIORS.has(spell.behavior)) {
    return { valid: false, reason: 'invalid-behavior', message: `Unsupported behavior: ${spell.behavior}.`, cost, overload };
  }

  if (!Array.isArray(spell.components)) {
    return { valid: false, reason: 'invalid-components', message: 'Spell components must be an array.', cost, overload };
  }

  if (!spell.parameters || typeof spell.parameters !== 'object') {
    return { valid: false, reason: 'invalid-parameters', message: 'Spell parameters must be an object.', cost, overload };
  }

  const parameterValidation = validateBehaviorParameters(spell.behavior, spell.parameters, cost, overload);
  if (!parameterValidation.valid) return parameterValidation;
  return validateCompatibility(spell, cost, overload);
}
