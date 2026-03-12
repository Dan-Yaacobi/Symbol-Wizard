# Import/Export Audit Report

## Module graph
### `data/abilities.js`
- Exports: abilityDefinitions, abilityDesignCatalog, defaultAbilitySlots
- Imports: (none)

### `engine/Camera.js`
- Exports: Camera
- Imports: (none)

### `engine/CellBuffer.js`
- Exports: CellBuffer
- Imports: (none)

### `engine/Input.js`
- Exports: Input
- Imports:
  - `{ clamp, getCanvasPosition, canvasToWorld }` from `../input/CoordinateSystem.js`

### `engine/Renderer.js`
- Exports: Renderer
- Imports: (none)

### `entities/Enemy.js`
- Exports: Enemy
- Imports:
  - `{ Entity }` from `./Entity.js`

### `entities/Entity.js`
- Exports: Entity
- Imports: (none)

### `entities/NPC.js`
- Exports: NPC
- Imports:
  - `{ Entity }` from `./Entity.js`

### `entities/Player.js`
- Exports: Player
- Imports:
  - `{ Entity }` from `./Entity.js`

### `entities/Projectile.js`
- Exports: Projectile
- Imports: (none)

### `entities/SpriteLibrary.js`
- Exports: palette, sprites
- Imports: (none)

### `entities/WorldObjects.js`
- Exports: BreakableProp, DestructibleObject, House, NatureObject, StaticObject, TownNPC, WorldObject
- Imports:
  - `{ Entity }` from `./Entity.js`

### `input/CoordinateSystem.js`
- Exports: canvasToWorld, clamp, getCanvasPosition, screenToCanvas, screenToWorld, worldToCanvas
- Imports: (none)

### `main.js`
- Exports: (none)
- Imports:
  - `{ Renderer }` from `./engine/Renderer.js`
  - `{ Camera }` from `./engine/Camera.js`
  - `{ Input }` from `./engine/Input.js`
  - `{ Player }` from `./entities/Player.js`
  - `{ generateMainTown }` from `./world/MapGenerator.js`
  - `{ resolveMapCollision }` from `./systems/CollisionSystem.js`
  - `{ updateEnemies }` from `./systems/AISystem.js`
  - `{ updateEnemyPlayerInteractions, updateProjectiles }` from `./systems/CombatSystem.js`
  - `{ spawnGold, collectGold, spawnDestructibleDrop }` from `./systems/LootSystem.js`
  - `{ CombatTextSystem }` from `./systems/CombatTextSystem.js`
  - `{ renderWorld }` from `./systems/RenderSystem.js`
  - `{ updateEntityAnimation, updateProjectileAnimation }` from `./systems/AnimationSystem.js`
  - `{ ChatBox }` from `./ui/ChatBox.js`
  - `{ drawHUD }` from `./ui/HUD.js`
  - `{ dialogueTree }` from `./systems/DialogueSystem.js`
  - `{ abilityDefinitions, defaultAbilitySlots }` from `./data/abilities.js`
  - `{ AbilitySystem }` from `./systems/AbilitySystem.js`
  - `{ AbilityBar }` from `./ui/AbilityBar.js`
  - `{ SkillTreeWindow }` from `./ui/SkillTreeWindow.js`
  - `{   cleanupDestroyedObjects,   resolveObjectCollision,   updateDestructibleAnimations,   updateTownNpcs, }` from `./systems/WorldObjectSystem.js`

### `systems/AISystem.js`
- Exports: updateEnemies
- Imports: (none)

### `systems/AbilitySystem.js`
- Exports: AbilitySystem
- Imports:
  - `{ Projectile }` from `../entities/Projectile.js`

### `systems/AnimationSystem.js`
- Exports: updateEntityAnimation, updateProjectileAnimation
- Imports:
  - `{ sprites }` from `../entities/SpriteLibrary.js`

### `systems/CollisionSystem.js`
- Exports: collides, resolveMapCollision
- Imports: (none)

### `systems/CombatSystem.js`
- Exports: updateEnemyPlayerInteractions, updateProjectiles
- Imports:
  - `{ collides }` from `./CollisionSystem.js`

### `systems/CombatTextSystem.js`
- Exports: CombatTextSystem
- Imports: (none)

### `systems/DialogueSystem.js`
- Exports: dialogueTree
- Imports: (none)

### `systems/LootSystem.js`
- Exports: collectGold, spawnDestructibleDrop, spawnGold
- Imports: (none)

### `systems/RenderSystem.js`
- Exports: renderWorld
- Imports:
  - `{ palette, sprites }` from `../entities/SpriteLibrary.js`

### `systems/WorldObjectSystem.js`
- Exports: cleanupDestroyedObjects, resolveObjectCollision, updateDestructibleAnimations, updateTownNpcs
- Imports:
  - `{ collides }` from `./CollisionSystem.js`

### `ui/AbilityBar.js`
- Exports: AbilityBar
- Imports: (none)

### `ui/ChatBox.js`
- Exports: ChatBox
- Imports: (none)

### `ui/HUD.js`
- Exports: drawHUD
- Imports:
  - `{ palette }` from `../entities/SpriteLibrary.js`

### `ui/SkillTreeWindow.js`
- Exports: SkillTreeWindow
- Imports: (none)

### `world/MapGenerator.js`
- Exports: generateMainTown
- Imports:
  - `{ tiles }` from `./TilePalette.js`
  - `{ House, BreakableProp, TownNPC, NatureObject, StaticObject }` from `../entities/WorldObjects.js`

### `world/TilePalette.js`
- Exports: tiles
- Imports:
  - `{ palette }` from `../entities/SpriteLibrary.js`
## Findings

- Broken named/default import mismatches: **0** (from `node scripts/module-audit.mjs`).
- Unused imports: **0** (from `node scripts/module-audit.mjs`).
- Unused exports detected: `abilityDesignCatalog`, `CellBuffer`, `Enemy`, `NPC`, `WorldObject`, `DestructibleObject`, `screenToCanvas`, `worldToCanvas`, `screenToWorld`.
- Circular dependencies detected: **0** (from `node scripts/module-audit.mjs`).
