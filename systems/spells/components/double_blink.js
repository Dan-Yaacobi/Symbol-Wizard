export const doubleBlinkComponent = {
  id: 'double_blink',
  type: 'augment',
  onAugment(instance) {
    instance.parameters = {
      ...(instance.parameters ?? {}),
      doubleBlink: true,
      doubleBlinkWindow: Number.isFinite(instance.parameters?.doubleBlinkWindow) ? instance.parameters.doubleBlinkWindow : 2.5,
    };
  },
};
