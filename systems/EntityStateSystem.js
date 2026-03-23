function stopMovement(entity) {
  entity.vx = 0;
  entity.vy = 0;
}

function getMovementState(entity) {
  return Math.hypot(entity.vx ?? 0, entity.vy ?? 0) > 0.1 ? 'walk' : 'idle';
}

export function updateEntityFacingFromVelocity(entity, threshold = 0.01) {
  if (!entity) return;
  const vx = entity.vx ?? 0;
  if (vx > threshold) entity.facing = 'right';
  else if (vx < -threshold) entity.facing = 'left';
}

export function createEntityState(type = 'idle') {
  return { type, time: 0 };
}

export function ensureEntityState(entity) {
  entity.state ??= createEntityState();
  if (!Number.isFinite(entity.state.time)) entity.state.time = 0;
  if (!entity.state.type) entity.state.type = 'idle';
  entity.stateClock ??= 0;
  return entity.state;
}

export function getEntityStateDefinitions(entity) {
  if (!entity?.stateDefinitions) throw new Error(`Entity ${entity?.id ?? '<unknown>'} is missing stateDefinitions.`);
  return entity.stateDefinitions;
}

export function getEntityStateDefinition(entity, stateType = null) {
  const state = ensureEntityState(entity);
  const definitions = getEntityStateDefinitions(entity);
  const definition = definitions[stateType ?? state.type];
  if (!definition) throw new Error(`Entity ${entity.id} is missing state definition "${stateType ?? state.type}".`);
  return definition;
}

export function setEntityState(entity, newStateType) {
  const state = ensureEntityState(entity);
  if (state.type === newStateType) return false;

  const previousDefinition = getEntityStateDefinition(entity, state.type);
  previousDefinition.onExit?.(entity);

  state.type = newStateType;
  state.time = 0;
  entity.stateClock = (entity.stateClock ?? 0) + 1;
  getEntityStateDefinition(entity, newStateType).onEnter?.(entity);
  return true;
}

export function completeEntityState(entity) {
  const nextState = getMovementState(entity);
  setEntityState(entity, nextState);
}

export function updateEntityState(entity, dt) {
  const state = ensureEntityState(entity);
  const definition = getEntityStateDefinition(entity, state.type);
  state.time += dt;
  definition.onUpdate?.(entity, dt);

  if (definition.duration !== Infinity && state.time >= definition.duration) {
    completeEntityState(entity);
  }
}

function createLocomotionState(type) {
  return {
    type,
    animation: type,
    duration: Infinity,
    onEnter() {},
    onUpdate() {},
  };
}

export function createPlayerStateDefinitions() {
  return {
    idle: createLocomotionState('idle'),
    walk: createLocomotionState('walk'),
  };
}

export function createNpcStateDefinitions() {
  return {
    idle: createLocomotionState('idle'),
    walk: createLocomotionState('walk'),
  };
}

export function createEnemyStateDefinitions() {
  return {
    idle: createLocomotionState('idle'),
    walk: createLocomotionState('walk'),
    attack: {
      type: 'attack',
      animation: 'attack',
      duration: Infinity,
      onEnter(entity) {
        entity.attackImpactApplied = false;
        entity.attackExecuted = false;
        stopMovement(entity);
      },
      onUpdate(entity) {
        stopMovement(entity);
        if (entity.behavior === 'ranged') {
          const ctx = entity.stateContext;
          ctx?.system?.spawnEffect?.({
            type: 'charge',
            x: entity.x,
            y: entity.y,
            color: '#ffb893',
            ttl: 0.1,
          });
        }
      },
      onExit(entity) {
        entity.attackImpactApplied = false;
        entity.attackExecuted = false;
      },
    },
  };
}

export function syncEntityMovementState(entity) {
  const state = ensureEntityState(entity);
  const nextState = getMovementState(entity);
  if (nextState !== state.type) setEntityState(entity, nextState);
}

export function getEntityAnimationState(entity) {
  return getEntityStateDefinition(entity).animation;
}

export function isEntityAttacking(entity) {
  return ensureEntityState(entity).type === 'attack';
}
