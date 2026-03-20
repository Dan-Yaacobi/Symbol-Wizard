import { Entity } from './Entity.js';
import { createNpcStateDefinitions } from '../systems/EntityStateSystem.js';

export class NPC extends Entity {
  constructor(x, y) {
    super({
      type: 'npc',
      x,
      y,
      radius: 1.8,
      spriteId: 'npc',
      name: 'Gate Wizard',
      interactRadius: 8,
      stateDefinitions: createNpcStateDefinitions(),
    });
  }
}
