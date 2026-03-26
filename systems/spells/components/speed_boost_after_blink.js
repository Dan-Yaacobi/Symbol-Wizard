export const speedBoostAfterBlinkComponent = {
  id: 'speed_boost_after_blink',
  type: 'augment',
  onAugment(instance) {
    instance.parameters = {
      ...(instance.parameters ?? {}),
      speedBoostAfterBlink: true,
      blinkSpeedBoostDuration: Number.isFinite(instance.parameters?.blinkSpeedBoostDuration)
        ? instance.parameters.blinkSpeedBoostDuration
        : 1.6,
      blinkSpeedBoostMultiplier: Number.isFinite(instance.parameters?.blinkSpeedBoostMultiplier)
        ? instance.parameters.blinkSpeedBoostMultiplier
        : 1.35,
    };
  },
};
