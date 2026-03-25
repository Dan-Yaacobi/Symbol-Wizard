export const shadowBlinkComponent = {
  id: 'shadow_blink',
  type: 'augment',
  onAugment(instance) {
    instance.parameters = {
      ...(instance.parameters ?? {}),
      shadowBlink: true,
      shadowZoneRadius: Number.isFinite(instance.parameters?.shadowZoneRadius) ? instance.parameters.shadowZoneRadius : 2.6,
      shadowZoneDuration: Number.isFinite(instance.parameters?.shadowZoneDuration) ? instance.parameters.shadowZoneDuration : 2.4,
      shadowZoneTickInterval: Number.isFinite(instance.parameters?.shadowZoneTickInterval) ? instance.parameters.shadowZoneTickInterval : 0.35,
      shadowZoneDamage: Number.isFinite(instance.parameters?.shadowZoneDamage) ? instance.parameters.shadowZoneDamage : 2,
      shadowZoneColor: instance.parameters?.shadowZoneColor ?? '#4a2f75',
    };
  },
};
