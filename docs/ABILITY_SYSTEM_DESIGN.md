# 1. Ability Design Document

## Vision
Build a data-driven wizard ability platform that scales from prototype combat to a full RPG featuring class builds, status interactions, upgrade trees, and slot loadouts.

## Core Goals
- Support a large ability roster without hardcoding per-ability logic in the main loop.
- Keep abilities modular with reusable execution primitives (projectile, area, blink, chain).
- Let players create builds by combining themes, statuses, and upgrades.
- Enable future expansion: passives, legendary modifiers, and encounter-specific counters.

## Design Principles
- **Data first:** ability metadata and progression live in structured objects.
- **Composable effects:** cast behavior uses shared low-level actions (spawn projectile, apply status, teleport).
- **Build expression:** slot assignment + upgrades create meaningful combat identity.
- **Deterministic runtime:** cooldown/mana/upgrade state owned by one authority (`AbilitySystem`).

# 2. Ability Architecture

## Core Objects
- `AbilityDefinition`
  - `id`, `name`, `description`, `theme`, `category`
  - `cooldown`, `manaCost`, `baseDamage`
  - `upgrades[]` (node list)
  - `synergyNotes`
  - `cast(context)`
- `AbilitySystem`
  - Registry of ability definitions.
  - Cooldown, slot, and upgrade state.
  - Cast gateway validates mana/cooldown and dispatches effect.
  - Upgrade gateway validates gold and advances level.

## Runtime State
- `slots[4]` maps hotkeys `1..4` to ability IDs.
- `cooldowns[abilityId]` tracks remaining cooldown.
- `upgrades[abilityId]` tracks unlocked level.

## Scalability Strategy
- Add new abilities by adding definition entries and cast handlers.
- Reuse effect helpers (`createProjectile`, `damageEnemy`, `findClosestEnemyInRange`).
- Future: split cast handlers into effect pipeline nodes for designer-authored combos.

# 3. Skill Tree Design

## SkillTreeWindow
- Toggle with `K`.
- Lists all abilities, current level, and node progression.
- Each ability shows next unlock and required gold.
- Unlock consumes gold and updates runtime level.

## Upgrade Model
- Base level starts at `1`.
- Upgrade nodes define `level`, `name`, `cost`, `effect`.
- Validation: must have gold and available next node.

# 4. Ability List and Upgrade Paths

## Implemented Prototype Abilities
1. **Magic Bolt** (Arcane / Projectile)
   - Role: baseline ranged DPS.
   - Upgrades: speed → pierce → impact bloom.
   - Synergy: fuels aggressive arcane tempo.
2. **Fire Burst** (Fire / Area)
   - Role: short-range AoE clear.
   - Upgrades: radius → embers → burn finisher.
   - Synergy: oil detonation and grouped targets.
3. **Blink** (Void / Mobility)
   - Role: reposition and dodge.
   - Upgrades: range → afterimage → phase armor.
   - Synergy: enables close-range combo setup.
4. **Lightning Arc** (Lightning / Chain)
   - Role: chain burst into clustered enemies.
   - Upgrades: range → additional fork → shocked amp.
   - Synergy: scales with Wet/clustered states.

## Full 12-Ability Design Catalog
- Arcane Spear, Rune Orbit
- Oil Flask, Meteor Call
- Storm Lance, Thunder Totem
- Ice Shard, Freeze Field, Shatter
- Void Pull, Rift Step, Astral Prison

Each includes role, upgrade path, and synergy notes in `data/abilities.js` for expansion planning.

# 5. UI Design

## Ability Slot UI
- Displays slot hotkeys `1 2 3 4`.
- Drag from spellbook list into slot.
- Drag slot-to-slot to swap.
- Right-click slot to clear.

## Skill Tree UI
- Window title: `SkillTreeWindow`.
- Shows all abilities and upgrade nodes.
- Shows gold costs and unlock action.

# 6. Code Implementation

## Added Systems
- `systems/AbilitySystem.js` for registration, cast flow, cooldowns, upgrades, slots.
- `data/abilities.js` for ability definitions + design catalog.

## Added UI
- `ui/AbilityBar.js` for drag/drop slot assignment and swapping.
- `ui/SkillTreeWindow.js` for `K`-toggle upgrade window.

## Gameplay Wiring
- `main.js` now initializes ability system, assigns default slots, handles hotkeys `1-4`, and regenerates mana.
- HUD now displays HP/MP/Gold plus slot/cooldown labels.
