export const pierceComponent = {
  id: 'pierce',
  type: 'augment',
  stacking: 'ignore',
  onAugment(instance) {
    instance.parameters.pierce = true;
    if (Number.isFinite(instance.parameters?.pierceCount)) {
      instance.parameters.pierceCount = Math.max(1, Math.floor(instance.parameters.pierceCount));
    }
  },
};
