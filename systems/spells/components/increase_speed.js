export const increaseSpeedComponent = {
  id: 'increase_speed',
  type: 'augment',
  stacking: 'additive',
  onAugment(instance) {
    const multiplier = Number.isFinite(instance.parameters?.speedMultiplier) ? instance.parameters.speedMultiplier : 1.25;
    const current = Number.isFinite(instance.parameters?.speed) ? instance.parameters.speed : 0;
    instance.parameters.speed = current * multiplier;
  },
};
