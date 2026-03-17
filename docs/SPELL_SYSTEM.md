# SPELL SYSTEM SPECIFICATION

## SYSTEM IDENTITY

This is a persistent RPG spell system.

* The game is NOT a roguelike
* The player builds a permanent spell arsenal over time
* Progression is based on crafting and evolving spells
* The player explores procedural biomes but returns to persistent hubs
* Spells are constructed, upgraded, and combined over time

## SYSTEM SEPARATION

There are three strictly separated systems:

1. Crafting System (persistent)

* Used to construct and modify spells
* Happens outside combat
* Uses cost and resources as constraints

2. Runtime Spell System (combat)

* Handles casting and execution of spells
* Uses runtime instances

3. Interaction System (runtime)

* Handles interactions between spells, environment, and enemies

These systems must NOT be merged.

## SPELL STRUCTURE

Each spell must contain:

* id
* name
* description
* behavior
* targeting
* element
* components[]
* parameters{}
* cost

## BASE SPELL PROGRESSION

Players do NOT start with advanced spells like Fireball.

They start with a simple base spell:

Example:

* Magic Bolt (basic projectile)

Base spells are evolved through crafting:

Magic Bolt → Fire Bolt → Explosive Fire Bolt → Multi Fire Bolt

This replaces the need for predefined large spell lists.

## BEHAVIOR SYSTEM (LOCKED)

* projectile
* beam
* zone
* burst
* summon
* orbit

## TARGETING SYSTEM

* cursor
* player-centered
* ground-targeted
* enemy-targeted
* self

## ELEMENT SYSTEM

* fire
* frost
* electric
* earth

Elements modify behavior meaningfully.

## COMPONENT SYSTEM

Components are augmentations that:

* trigger on events
* inject new payloads
* modify behavior

## MULTI-INSTANCE RULE

Multiple outputs must be spatially distributed.

## RUNTIME SPELL INSTANCE

Base spells are immutable.

Casting creates a runtime instance.

Instances can mutate during execution.

## CASTING PIPELINE

Input → Validation → Target → Instance → Components → Execute → Effects → Commit

Cooldown/mana only used if successful.

## STATUS SYSTEM

Element-driven status effects.

## INTERACTION SYSTEM

* spell ↔ spell
* spell ↔ environment
* spell ↔ enemy

Separate from crafting.

## CRAFTING SYSTEM (UPDATED)

There is NO fusion system.

Crafting is composed of TWO distinct parts:

### A. BASE SPELL CONSTRUCTION

Players evolve base spells over time.

Example:

Magic Bolt
→ add fire → Fire Bolt
→ add explode → Fireball
→ add multi → Multi Fireball

This builds the core identity of the spell.

### B. AUGMENTATION / COMPOSITION

Spells can be combined to produce MULTIPLE EFFECTS.

Example:

Fireball + Frost Bolt
→ casts BOTH spells together

This is NOT fusion.

This does NOT create a new spell identity.

This is composition.

## RULE:

Combining spells results in:

* parallel execution
* shared cast event
* combined cost

## SPELL GRAPH

Graph represents:

* valid augmentations
* valid compositions

NOT fusion outcomes.

## COMBINATION PHILOSOPHY

* allow combinations
* control via cost and validation

## COST SYSTEM

Cost is ONLY used for crafting.

Cost is NOT:

* mana
* runtime energy
* damage

Cost represents:

"spell complexity budget during crafting"

Formula:

cost =
behavior
* element
* components
* nested payloads
* nested tax

## RESOURCE COST (NEW)

In addition to cost points, crafting requires resources.

Each crafting action requires:

* at least one magical item (mandatory)
* additional standard resources

Crafting is gated by BOTH:

* cost validity
* resource availability

## SOFT / HARD CAP

Soft = 100
Hard = 150

## OVERLOAD

* requires special items
* allows exceeding soft cap
* MUST have downsides

## RECURSION

Allowed but controlled via:

* cost
* limits
* scaling

## RUNTIME LIMITS

* entity caps
* recursion caps

## VISUAL ANCHOR

Each spell retains a clear identity.

## VALIDATION

validateSpell():

returns:

* valid
* reason
* cost
* overload

## PROGRESSION

* unlock components
* unlock higher complexity
* unlock overload

## PLAYER BUILD

* spellbook
* 4 slots
* free selection

## NAMING

Spells must feel like real abilities.

## FAILURES

* invalid craft
* missing resources
* exceeding caps

## CONSTRAINTS

System must NOT:

* create infinite loops
* break readability
* allow uncontrolled recursion

## IMPLEMENTATION ORDER

1. behaviors
2. targeting
3. elements
4. runtime system
5. components
6. cost
7. validation
8. crafting
9. UI
10. interactions
11. overload

## SUMMARY

System is based on:

* base spell evolution
* augmentation layering
* multi-spell composition
* cost + resource constraints
* controlled chaos

## END OF SPECIFICATION
