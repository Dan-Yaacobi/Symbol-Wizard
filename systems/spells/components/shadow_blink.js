export const shadowBlinkComponent = {
  id: 'shadow_blink',
  type: 'augment',
  onAugment(instance) {
    instance.parameters = {
      ...(instance.parameters ?? {}),
      shadowBlink: true,
      shadowZoneRadius: Number.isFinite(instance.parameters?.shadowZoneRadius) ? instance.parameters.shadowZoneRadius : 3.8,
      shadowZoneDuration: Number.isFinite(instance.parameters?.shadowZoneDuration) ? instance.parameters.shadowZoneDuration : 3.8,
      shadowZoneTickInterval: Number.isFinite(instance.parameters?.shadowZoneTickInterval) ? instance.parameters.shadowZoneTickInterval : 0.35,
      shadowZoneDamage: Number.isFinite(instance.parameters?.shadowZoneDamage) ? instance.parameters.shadowZoneDamage : 2,
      shadowZoneColor: instance.parameters?.shadowZoneColor ?? '#4a2f75',
    };
  },
};
