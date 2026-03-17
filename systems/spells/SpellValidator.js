const VALID_BEHAVIORS = new Set(['projectile', 'zone', 'beam', 'burst', 'summon', 'orbit']);

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

  return validateBehaviorParameters(spell.behavior, spell.parameters, cost, overload);
}
