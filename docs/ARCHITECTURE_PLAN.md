# Architecture Plan

## Layering
1. **Engine Layer**: deterministic frame loop, input abstraction, camera transforms, character-cell renderer.
2. **Domain Layer**: entity classes and symbolic sprite definitions.
3. **World Layer**: procedural dungeon generation and tile definitions.
4. **Gameplay Systems Layer**: AI, collision, combat, loot, dialogue state.
5. **UI Layer**: chat box and HUD overlays.

## Runtime Flow
- `main.js` composes all modules and owns world state.
- Per frame, systems run in strict order: input → player → AI → collision/combat → dialogue/UI → render.
- Rendering is stateless apart from cell buffer reuse.

## Scalability Hooks
- Add quests by extending dialogue option effects.
- Add spells as new projectile/archetype factories.
- Add map biomes by swapping tile palettes and room generators.
- Migrate to ECS by replacing entity class lists with component stores while preserving systems API boundaries.
