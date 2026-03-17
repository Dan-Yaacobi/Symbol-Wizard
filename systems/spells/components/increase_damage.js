export const increaseDamageComponent = {
  id: 'increase_damage',
  type: 'augment',
  stacking: 'additive',
  onAugment(instance) {
    const multiplier = Number.isFinite(instance.parameters?.damageMultiplier) ? instance.parameters.damageMultiplier : 1.25;
    const current = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 0;
    instance.parameters.damage = current * multiplier;
  },
};
