# Symbol Wizard RPG — Design Document

## 1. Vision and Design Goals

Symbol Wizard is a browser-based real-time top-down RPG inspired by action-RPG combat loops (e.g., Diablo) while using a strict symbol-only visual language. Every visual element is rendered as a grid cell containing `char`, `fg`, and `bg` values. The prototype validates readability, gameplay feel, and modular architecture.

### Core Goals
1. **Readable Symbol Graphics**: Distinct silhouettes, semantic color usage, and low-noise environments.
2. **Action Gameplay**: Responsive movement, directional aiming, projectile spell combat.
3. **Systemic Scalability**: Modular code organization ready for quests, skills, procedural content, and narrative growth.
4. **Diegetic Text UI**: Chat box for NPC interaction and branching dialogue.

## 2. Prototype Scope

### In Scope
- One procedural dungeon map.
- Player wizard entity.
- Smooth WASD movement.
- Mouse aim + left-click cast.
- Magic Bolt projectile (`--->`, blue).
- Two enemy types: Slime and Skeleton.
- One NPC wizard near dungeon entrance.
- Chat box with dialogue choices.
- Basic collision + combat + gold drops.

### Out of Scope (future)
- Hub world transitions.
- Quest persistence.
- Multi-spell loadouts.
- Item/inventory systems.
- Save/load profiles.

## 3. Symbol Graphics Engine Specification

## Grid Model
- Visible playfield: **160 × 100** cells.
- Each cell:
  - `char`: one printable character.
  - `fg`: hex color string.
  - `bg`: hex color string.

## Render Pipeline
1. Clear frame buffer to default floor/background cells.
2. Draw tile map layer.
3. Draw entities by z-order and y-order.
4. Draw projectiles/effects.
5. Submit to canvas (character raster pass).

## Readability Rules (Engine-Enforced)
1. Entities use high-contrast palettes and 7×7 sprite silhouettes.
2. Environment symbols use lower-density glyphs and muted colors.
3. Semantic color palette is centralized in constants.
4. Animation is subtle (2-frame bounce, palette pulse), never reducing silhouette clarity.
5. Player always draws last among actors and includes bright accent color.

## 4. Visual Language

## Semantic Colors
- Purple: player magic identity.
- Blue: arcane bolt / ice-adjacent magic.
- Green: poison/slime enemies.
- Red: demonic/aggressive threat.
- Yellow: lightning / highlights.
- Gray: stone architecture.
- Brown: wooden props.

## Sprite Constraints
- Standard actor footprint: 7×7.
- Sparse silhouette edges, dense center mass.
- No decorative clutter that blends with floor texture.

## 5. Gameplay Systems

## Player Controller
- Input: WASD for acceleration-driven movement.
- Movement: velocity + damping for smoothness.
- Aim: world-space direction from player to mouse cursor.
- Cast: left click fires Magic Bolt with cooldown.

## Combat Model
- Projectile hit checks against enemy circle colliders.
- Hit applies fixed damage.
- Enemy death spawns gold pickup entity.
- Player can auto-collect nearby gold.

## Enemy Behavior
- Slime: slow pursuit with wobble animation.
- Skeleton: slightly faster pursuit with stop-and-go cadence.
- Both: navigate walkable map with simple chase steering.

## NPC + Dialogue
- NPC has interaction radius.
- Player presses `E` near NPC to open chat UI.
- Dialogue options selectable with keys `1-9`.
- Chat box supports:
  - NPC lines
  - Player response options
  - Quest hint text

## 6. World and Map Model

## Dungeon Layout
- Tile-based map larger than viewport (prototype: 220×140).
- Generated from room-carve + corridor + noise clutter.
- Tile classes:
  - Wall (blocked)
  - Floor (walkable)
  - Accent props (walkability configurable)

## Camera
- Camera follows player with soft clamp and world bounds.
- Renders viewport window (160×100) into map coordinates.

## 7. Scalable Architecture

Modules are grouped by responsibility:
- `/engine`: rendering, timing, input, camera, cell buffers.
- `/entities`: entity blueprints and sprite definitions.
- `/world`: map generation, tile metadata.
- `/systems`: AI, collision, combat, dialogue, loot.
- `/ui`: chat box and HUD overlays.

This supports extending each feature vertically without coupling all logic into a monolith.

## 8. Data Models

## Entity
- `id`, `type`, `x`, `y`, `vx`, `vy`, `radius`, `hp`, `maxHp`, `spriteKey`, `alive`.

## Projectile
- `x`, `y`, `dx`, `dy`, `speed`, `ttl`, `damage`, `owner`, `spriteFrames`.

## Tile
- `char`, `fg`, `bg`, `walkable`, `transparent`.

## Dialogue Node
- `id`, `speaker`, `line`, `options[]` where option = `{text, nextId, effect?}`.

## 9. Update Loop

At 60 FPS target:
1. Poll input.
2. Update player movement and intent.
3. Update AI steering.
4. Spawn/update projectiles.
5. Resolve collisions.
6. Apply combat and death events.
7. Update loot + dialogue state.
8. Update camera.
9. Render frame and UI.

## 10. Performance and Maintainability Notes
- Fixed-size cell buffer reused each frame to avoid allocations.
- Entity lists partitioned by type for fast iteration in prototype.
- Deterministic map seed option for reproducible testing.
- Clear system APIs (update/render boundaries) for future ECS migration.

## 11. Floating Combat Text System

### Purpose
The Floating Combat Text system provides immediate visual feedback for combat and reward events in the symbol-based wizard RPG. Text appears near the relevant entity so players can read combat outcomes at a glance without shifting attention away from gameplay.

Spawn floating text for:
- Enemy takes damage (e.g., `-12`, `-7`)
- Player takes damage (e.g., `-5`)
- Critical hit (e.g., `*25*`)
- Gold pickup (e.g., `+10$`)
- Healing and neutral informational events as needed by combat logic

### Symbol RPG Text Style
Floating text should match the game's symbol aesthetic and remain concise.

Examples:
- Damage: `-12`, `-7`
- Critical hit: `*25*`
- Gold pickup: `+10$`

Text is rendered in-canvas using the same symbol rendering rules, font treatment, and grid alignment conventions as the rest of the game.

### Color Rules
Use semantic color mapping for readability and quick parsing:
- **Red**: enemy or player damage
- **Yellow**: critical hits
- **Green**: healing
- **Gold**: gold collected
- **White**: neutral info

### Spawn Location Rules
Combat text should spawn near the entity that triggered the event:
- Enemy takes damage → spawn above the enemy sprite
- Player takes damage → spawn above the player sprite
- Gold pickup → spawn above the player sprite
- Other events → spawn above the event source entity

Use world-space coordinates so text remains anchored correctly under camera movement.

### Animation Behavior
Each combat text entry should:
- Move upward slightly
- Fade out over time
- Disappear automatically when expired

Recommended lifetime per entry:
- `0.8–1.2s`

### CombatTextSystem (New System)
Add a dedicated runtime system:
- `CombatTextSystem`

Responsibilities:
- Spawn combat text entries from combat/loot events
- Update text position and opacity over lifetime
- Expire and remove completed entries
- Render active entries above entities in world space

`CombatTextSystem` should expose a simple spawn API usable by `CombatSystem`, `LootSystem`, and any future system that needs transient feedback.

### Example Data Structure
Maintain a transient runtime array:
- `combatTexts[]`

Example entry:

```json
{
  "id": "ct_1",
  "x": 320,
  "y": 200,
  "text": "-12",
  "color": "red",
  "createdAt": "timestamp"
}
```

Recommended optional fields for robust lifecycle/rendering:
- `lifetimeMs`: total lifetime (e.g., `1000`)
- `velocityY`: upward drift speed
- `opacity`: cached render alpha

### Rendering Approach
Floating combat text must be rendered through the same symbol rendering pipeline used by the game.

Requirements:
- Render inside the game canvas
- Use the same font and symbol styling as other glyphs
- Preserve grid alignment expectations where applicable
- Avoid DOM overlays or HTML UI elements for FCT

Render pass guidance:
1. Game world and entities render normally.
2. `CombatTextSystem` renders active text entries in world/camera space above entity sprites.
3. UI/HUD renders after world-space combat text as needed.

### Performance Rule
Combat text must remain lightweight and decoupled from core simulation:
- No interaction with physics resolution
- No mutation of entity movement/combat state
- Bounded, short-lived entries with automatic cleanup

This keeps the feature visually expressive without affecting combat, AI, or physics update performance.
