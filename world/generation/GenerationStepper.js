const STEPS = [
  'terrain_init',
  'path_generation',
  'clearings',
  'object_mask_setup',
  'landmarks',
  'object_placement',
  'decoration',
  'exit_triggers',
  'validation',
  'repair',
  'collision_map',
  'enemy_spawning',
  'transition_cache',
];

export function createRoomGenerationStepper(request, dependencies = {}) {
  const worldMapManager = dependencies.worldMapManager ?? null;
  let currentStepIndex = 0;
  let room = null;

  async function runNextStep() {
    if (currentStepIndex >= STEPS.length) return;
    const currentStep = STEPS[currentStepIndex];
    console.info(`[GenerationStepper] step: ${currentStep}`);

    switch (currentStep) {
      case 'terrain_init':
      case 'path_generation':
      case 'clearings':
      case 'object_mask_setup':
      case 'landmarks':
      case 'object_placement':
      case 'decoration':
      case 'exit_triggers':
      case 'validation':
      case 'repair':
      case 'collision_map':
      case 'enemy_spawning':
        break;
      case 'transition_cache':
        room = worldMapManager?.loadMap?.(request, { fromMapLoader: true }) ?? null;
        break;
      default:
        break;
    }

    currentStepIndex += 1;
  }

  function isDone() {
    return currentStepIndex >= STEPS.length;
  }

  function getResult() {
    return room;
  }

  return {
    runNextStep,
    isDone,
    getResult,
  };
}
