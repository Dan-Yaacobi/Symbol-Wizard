const VALID_BEHAVIORS = new Set(['projectile', 'zone', 'beam', 'burst', 'summon', 'orbit']);

export function validateSpell(spell) {
  if (!spell || typeof spell !== 'object') {
    return { valid: false, reason: 'missing-spell', cost: 0, overload: false };
  }

  const requiredFields = ['id', 'name', 'description', 'behavior', 'targeting', 'element', 'components', 'parameters', 'cost'];
  for (const field of requiredFields) {
    if (!(field in spell)) {
      return { valid: false, reason: `missing-${field}`, cost: 0, overload: false };
    }
  }

  const cost = Number.isFinite(spell.cost) ? spell.cost : Number.NaN;
  if (!Number.isFinite(cost)) return { valid: false, reason: 'invalid-cost', cost: 0, overload: false };
  if (cost > 150) return { valid: false, reason: 'cost-too-high', cost, overload: false };

  if (!VALID_BEHAVIORS.has(spell.behavior)) {
    return { valid: false, reason: 'invalid-behavior', cost, overload: cost > 100 };
  }

  if (!Array.isArray(spell.components)) {
    return { valid: false, reason: 'invalid-components', cost, overload: cost > 100 };
  }

  if (!spell.parameters || typeof spell.parameters !== 'object') {
    return { valid: false, reason: 'invalid-parameters', cost, overload: cost > 100 };
  }

  return {
    valid: true,
    reason: 'ok',
    cost,
    overload: cost > 100,
  };
}
