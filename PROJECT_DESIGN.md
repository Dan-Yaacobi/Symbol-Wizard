# Symbol Wizard RPG — Project Design Document

## Purpose of This Document

This document defines the **core architecture, gameplay systems, and design philosophy** of the Symbol Wizard RPG.

It acts as the **single source of truth** for development.
All future systems should follow the structures and principles described here.

---

# PART 1 — GAME VISION

## 1. Game Identity

* **Game Type:** Procedural open-world wizard exploration game.
* **Player Role:** The player is a wizard exploring a magical frontier.
* **Core Fantasy:** Explore a magical world, discover arcane phenomena, harvest magical resources, and craft increasingly powerful spells.
* **Primary Player Fantasy:**
  Explore → Discover Magic → Craft Spells → Experiment → Become a powerful wizard.

---

# PART 2 — CORE DESIGN PILLARS

## Pillar 1 — Procedural Magical Frontier

The world is procedurally generated but structured around **biome archetypes rather than pure randomness**.

Exploration exists to discover:

* magical biomes
* arcane landmarks
* magical creatures
* rare magical resources
* anomalies
* spellcraft knowledge

Example biome archetypes:

* Volcanic Rift
* Storm Plateau
* Crystal Caverns
* Fungal Mire
* Ancient Mage Ruins
* Mana Fracture Fields

Each biome defines:

* terrain rules
* enemy archetypes
* magical resources
* environmental hazards
* landmarks
* boss creatures

---

## Pillar 2 — Knowledge-Based Spellcraft

Spellcraft is the **primary progression system**.

Players do not simply level up spells. Instead they:

1. Discover magical resources
2. Discover spell formulas through tomes
3. Unlock elemental magic
4. Craft spells using recipes
5. Combine spell effects through synergy
6. Experiment with spell builds

Spellcraft depth is the **core gameplay system**.

---

## Pillar 3 — Expressive Wizard Combat

Combat is **active spellcasting**.

Spells define combat style.

Combat encounters exist in three categories:

* **Skirmish Combat**
  Small encounters during exploration.

* **Swarm Events**
  Occasional high pressure combat scenarios.

* **Signature Encounters**
  Bosses or magical entities tied to rare resources.

---

# PART 3 — CORE GAMEPLAY LOOP

Core loop:

Explore world
→ discover magical biome
→ encounter magical creatures
→ obtain magical resources
→ discover spell formulas
→ craft new spells
→ use spells in combat
→ explore deeper regions

---

# PART 4 — SPELLCRAFT SYSTEM

## Resource System

Spellcraft requires resources obtained from:

* defeating magical creatures
* harvesting magical environments
* interacting with anomalies
* defeating bosses

Resources fall into two categories.

### Magical Core Resources

Examples:

* magma core
* storm shard
* void pollen
* ember heart

### Supporting Ingredients

Examples:

* obsidian
* sulfur
* crystal dust
* ash residue
* bone fragments

Spells require **one magical core and additional ingredients**.

---

## Element System

Elements represent magical disciplines unlocked through exploration.

Examples:

* Fire
* Lightning
* Magma
* Frost
* Poison
* Wind
* Void
* Earth

Unlocking an element grants access to its spell recipes.

---

## Spell Recipe System

Spells are crafted from recipes.

A recipe requires:

* required elements
* required formula/tome
* required ingredients
* spell behavior data
* interaction tags

Example recipe structure:

* Spell Name
* Required Elements
* Required Tome
* Ingredients
* Spell Tags
* Applies Statuses
* Creates Zones
* Reacts To Tags

---

## Spell Synergy System

Spells interact through **tags and statuses**, not hardcoded spell combinations.

Spells may interact with:

* enemy statuses
* spell zones
* other spells
* environmental states

Example tags:

* burning
* stunned
* ignitable_projectile
* charged
* frozen
* volatile

Example interactions:

* Projectile cast inside fire zone → projectile ignites
* Enemy stunned by lightning → next impact spell explodes

This allows scalable spell interactions without exponential complexity.

---

## Tome / Formula System

Spell formulas are discovered through **tomes found in the world**.

Tomes:

* unlock crafting recipes
* provide magical knowledge
* reveal information progressively

Tomes are a key **exploration reward**.

---

# PART 5 — COMBAT DESIGN

## Elemental Affinity System

Enemies and bosses may have:

* weaknesses
* resistances
* occasional immunities

Example:

Forest Spider

* Weak: Fire
* Resist: Poison
* Neutral: Lightning

These modifiers should remain **moderate** to encourage experimentation without forcing constant loadout switching.

---

## Biome Magic Influence

Biomes can modify elemental effectiveness.

Example:

Water biome

* Fire damage reduced
* Lightning damage increased

This encourages players to experiment with spell builds depending on environment.

---

## Spell Loadout System

Players can equip a limited number of spells simultaneously.

Features:

* quick loadouts
* build swapping outside combat

Spell slot count is currently **TBD**.

---

## Spellcraft Graph Structure

The spell system is represented as a **structured content graph**.

The graph defines:

* elements
* spell recipes
* ingredient requirements
* formula dependencies
* spell tags
* synergy relationships

The graph represents the **space of craftable spells**.

---

# PART 6 — SYMBOL GRAPHICS ENGINE

## Grid Model

The entire world is rendered using **symbol graphics**.

Visible playfield:

160 × 100 cells

Each cell stores:

* `char` — printable character
* `fg` — foreground color
* `bg` — background color

---

## Render Pipeline

1. Clear frame buffer
2. Draw tile map
3. Draw entities
4. Draw projectiles and effects
5. Draw floating combat text
6. Submit frame to canvas

---

## Readability Rules

1. Entities use **high contrast palettes**
2. Environment uses **muted symbols**
3. Semantic colors are centralized
4. Animation is subtle
5. Player is always visually prioritized

---

## Semantic Colors

* Purple → player magic
* Blue → arcane
* Green → poison/slime
* Red → hostile threat
* Yellow → lightning
* Gray → stone
* Brown → wood

---

## Sprite Constraints

Standard actor footprint:

7 × 7 symbols

Design rules:

* dense center mass
* sparse edges
* clear silhouette

---

# PART 7 — ENGINE ARCHITECTURE

Modules are grouped by responsibility.

```
/engine
/entities
/world
/systems
/ui
```

### Engine

Rendering, timing, camera, input.

### Entities

Actors, enemies, projectiles.

### World

Map generation and tiles.

### Systems

Combat, AI, loot, dialogue.

### UI

HUD, chatbox.

---

# PART 8 — DATA MODELS

### Entity

Fields:

* id
* type
* x
* y
* vx
* vy
* radius
* hp
* maxHp
* spriteKey
* alive

### Projectile

* x
* y
* dx
* dy
* speed
* ttl
* damage
* owner
* spriteFrames

### Tile

* char
* fg
* bg
* walkable
* transparent

### Dialogue Node

* id
* speaker
* line
* options[]

---

# PART 9 — GAME LOOP

Target: **60 FPS**

Update order:

1. Poll input
2. Update player movement
3. Update AI
4. Spawn/update projectiles
5. Resolve collisions
6. Apply combat events
7. Update loot
8. Update camera
9. Render frame

---

# PART 10 — FLOATING COMBAT TEXT

Floating combat text provides immediate combat feedback.

Examples:

* `-12`
* `*25*`
* `+10$`

Color rules:

* Red → damage
* Yellow → crit
* Green → heal
* Gold → currency
* White → neutral

Animation:

* slight upward motion
* fade out
* lifetime ~1 second

---

# PART 11 — SCALABILITY REQUIREMENTS

The system must support easy expansion.

Adding the following should require minimal code changes:

* new elements
* new spells
* new enemies
* new items
* new biomes
* new encounters
* new events

Content should be **data driven**, not hardcoded.

---

# PART 12 — UNDEFINED SYSTEMS (TBD)

Future design decisions:

* spell slot count
* camera perspective
* movement scheme
* mana economy
* world size
* map structure
