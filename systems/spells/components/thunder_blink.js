export const thunderBlinkComponent = {
  id: 'thunder_blink',
  type: 'augment',
  onAugment(instance) {
    instance.parameters = {
      ...(instance.parameters ?? {}),
      thunderBlink: true,
      thunderStunDuration: Number.isFinite(instance.parameters?.thunderStunDuration) ? instance.parameters.thunderStunDuration : 1.05,
      thunderPathWidth: Number.isFinite(instance.parameters?.thunderPathWidth) ? instance.parameters.thunderPathWidth : 0.8,
    };
  },
};
