export const applyStatusOnHitComponent = {
  id: 'apply_status_on_hit',
  type: 'trigger',
  stacking: 'additive',
  onHit(payload, instance) {
    const { target, system } = payload ?? {};
    if (!target || !system || typeof system.applyStatus !== 'function') return;

    const statusType = instance.parameters?.statusType ?? 'burn';
    const statusDuration = Number.isFinite(instance.parameters?.statusDuration) ? instance.parameters.statusDuration : 2;
    system.applyStatus(target, statusType, statusDuration);
  },
};
