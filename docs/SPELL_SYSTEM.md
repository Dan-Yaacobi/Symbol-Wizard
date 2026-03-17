# SPELL SYSTEM SPECIFICATION

---

## SYSTEM IDENTITY

This is a persistent RPG spell system.

- The game is NOT a roguelike
- The player builds a permanent spell arsenal over time
- Progression is based on crafting and evolving spells
- The player explores procedural biomes but returns to persistent hubs
- Spells are constructed, upgraded, and combined over time

---

## SYSTEM SEPARATION

There are three strictly separated systems:

### 1. Crafting System (persistent)
- Used to construct and modify spells
- Happens outside combat
- Uses cost and resources as constraints

### 2. Runtime Spell System (combat)
- Handles casting and execution of spells
- Uses runtime instances

### 3. Interaction System (runtime)
- Handles interactions between spells, environment, and enemies

These systems must NOT be merged.

---

## SPELL STRUCTURE

Each spell must contain:

- id
- name
- description
- behavior
- targeting
- element
- components[]
- parameters{}
- cost

Definitions:

- behavior → core delivery type
- targeting → how the spell selects its target
- element → transformation layer that modifies behavior
- components → modular augmentations
- parameters → behavior-specific values
- cost → crafting complexity budget

---

## PARAMETERS FIELD

`parameters{}` contains behavior-specific values.

Examples:

Projectile:
- speed
- range
- size

Zone:
- radius
- duration

Beam:
- width
- length

Components may inject or modify parameters.

---

## BASE SPELL PROGRESSION

Players do NOT start with advanced spells like Fireball.

They start with a simple base spell:

- Magic Bolt (basic projectile)

Base spells are evolved through crafting:

Magic Bolt → Fire Bolt → Explosive Fire Bolt → Multi Fire Bolt

### RULE

Base spell construction is achieved by:

- adding an element
- adding components

There is NO separate evolution system.

All progression is expressed through composition.

---

## BEHAVIOR SYSTEM (LOCKED)

- projectile
- beam
- zone
- burst
- summon
- orbit

Each behavior defines:

- how the spell exists in the world
- how it executes
- its spatial and temporal presence

Behavior does NOT define:

- element effects
- components
- status effects

---

## TARGETING SYSTEM

- cursor
- player-centered
- ground-targeted
- enemy-targeted
- self

Directional targeting is NOT used.

---

## ELEMENT SYSTEM

- fire
- frost
- electric
- earth

Elements are NOT cosmetic.

They must modify behavior meaningfully.

Examples:

Fire:
- explosion
- spread
- burn

Frost:
- slow
- freeze buildup
- control

Electric:
- chaining
- instability
- speed

Earth:
- weight
- knockback
- structure

---

## COMPONENT SYSTEM

Components are modular augmentations.

Examples:

- explode_on_hit
- spawn_zone_on_hit
- emit_projectiles
- spawn_on_expire
- split
- multi_cast
- chain
- fork
- ring
- cone
- spiral
- wave
- pierce
- bounce
- pull
- push
- orbit_attach
- delay
- grow
- ramp
- pulse

---

## COMPONENT EXECUTION MODEL

Components operate using event hooks.

Supported events:

- onCast
- onHit
- onExpire
- onTick

Components can:

1. Modify base behavior parameters
2. Inject new spell payloads
3. React to runtime events

Examples:

explode_on_hit:
- triggers onHit
- creates explosion payload

emit_projectiles:
- triggers onTick or onHit
- spawns additional projectiles

---

## MULTI-INSTANCE DISTRIBUTION RULE

Any spell that produces multiple outputs MUST distribute them spatially.

No stacking on identical vectors unless explicitly intended.

---

## RUNTIME SPELL INSTANCE

Base spell definitions are immutable.

Casting creates a runtime instance.

Runtime instances can:

- mutate element
- mutate behavior through interactions
- carry dynamic state

### RULE

Base spell definitions must NEVER change during runtime.

---

## CASTING PIPELINE

Execution order:

Input  
→ Validation  
→ Target Resolution  
→ Runtime Instance Creation  
→ Apply Components  
→ Execute Behavior  
→ Apply Effects  
→ Commit Cooldown/Mana  

### CRITICAL RULE

Cooldown and mana are ONLY consumed if execution succeeds.

---

## STATUS SYSTEM

Enemies maintain:

```js
statusEffects: [
  {
    type,
    duration,
    intensity
  }
]
