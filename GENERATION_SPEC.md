# GENERATION_SPEC.md

## 1. Purpose

This document defines the formal generation rules, ownership boundaries, invariants, and quality targets for the world generation system.

Its purpose is to make generation:
- understandable,
- controllable,
- tunable,
- efficient,
- and architecturally clean.

This spec is the source of truth for future generation rewrites.  
Implementation must follow this spec rather than invent hidden behavior ad hoc.

---

## 2. Core Design Principles

1. **Plan before realizing**
   - Graph/topology decisions must be made before physical room generation.
   - Room generation must honor a precomputed contract.

2. **Single owner per concern**
   - Each concern must have one authoritative owner.
   - No downstream system may silently redefine upstream truth.

3. **Validation before expensive realization when possible**
   - Feasibility should be checked early.
   - Expensive work should not happen before critical constraints are known to be satisfiable.

4. **No hidden post-hoc mutation**
   - Entrances, exits, connection contracts, and spawn semantics must not be rewritten by unrelated systems after validation.

5. **Repair must be bounded and explicit**
   - Repairs are allowed only in clearly defined cases.
   - Repairs must not become a second generation system.

6. **Variety must be intentional**
   - Branching, loops, optional exploration, and pacing are not accidents.
   - They must come from explicit graph and room rules.

7. **Generation quality is not just reachability**
   - A valid room is not enough.
   - Layout and topology must also meet quality targets.

---

## 3. Generation Stages

The generator is divided into the following stages:

1. Graph Planning
2. Room Planning
3. Room Realization
4. Validation
5. Transition Compilation
6. Region Bridging
7. Runtime Consumption

Each stage has strict ownership and allowed outputs.

---

## 4. Stage Ownership

### 4.1 Graph Planning
Owner: `GraphPlanner`

Responsible for:
- room count,
- graph topology,
- critical path,
- optional branches,
- loops/shortcuts,
- room roles,
- biome progression structure,
- connection contracts between rooms.

Must output:
- graph nodes,
- graph edges,
- room role assignments,
- connection metadata,
- route importance metadata.

Must not:
- generate tiles,
- place objects,
- decide exact spawn tiles,
- mutate runtime map instances.

### 4.2 Room Planning
Owner: `RoomPlanCompiler`

Responsible for:
- anchor allocation,
- required route obligations,
- reserved corridor contracts,
- spawn zone definition,
- placement budgets,
- landmark zones,
- obstacle-free guarantees required before realization.

Must output:
- room plan,
- anchor definitions,
- reserved geometry contracts,
- traversal obligations,
- generation budgets by category.

Must not:
- perform decorative generation,
- make graph-level decisions,
- mutate neighboring room contracts.

### 4.3 Room Realization
Owner: `RoomRealizer`

Responsible for:
- terrain generation,
- path realization,
- clearings,
- object placement,
- landmark placement,
- enemy placement,
- final tile/object layout.

Must obey:
- graph contract,
- room plan contract,
- reserved traversal corridors,
- spawn safety rules.

Must not:
- change graph structure,
- invent new entrances/exits,
- reinterpret connection semantics,
- repair invalid upstream plans by rewriting contracts.

### 4.4 Validation
Owner: `GenerationValidator`

Responsible for:
- graph invariants,
- room-plan invariants,
- realized traversability,
- corridor width constraints,
- landing validity,
- spawn safety,
- transition feasibility.

Validation outputs only:
- pass,
- fatal failure,
- repairable failure,
- informational warnings.

Must not:
- silently mutate final result unless explicitly invoking bounded repair policy.

### 4.5 Repair
Owner: `GenerationRepairPolicy`

Repair is not a general-purpose layer.  
It exists only for explicitly permitted repairable failures.

Allowed repair scope:
- limited corridor cleanup,
- limited landing cleanup,
- bounded obstruction clearing.

Not allowed:
- adding new graph edges,
- redefining entrance semantics,
- rewriting room roles,
- rewriting region bridge logic,
- inventing missing topology.

### 4.6 Transition Compilation
Owner: `TransitionCompiler`

Responsible for:
- compiling validated transition data,
- selecting valid spawn targets,
- storing per-entrance transition info.

Must assume:
- validated room geometry is final.

Must not:
- fix broken room layouts,
- correct invalid entrances that should have failed validation,
- become a hidden second source of truth.

### 4.7 Region Bridging
Owner: `RegionBridgeCompiler`

Responsible for:
- linking town ↔ biome ↔ interior under a unified transition contract.

Must not:
- rewrite room-internal geometry after validation,
- mutate entrance ownership rules,
- inject ad hoc traversal hacks.

### 4.8 Runtime Consumption
Owner: runtime systems

Runtime must consume compiled generation output.  
Runtime must not reinterpret generation truth.

---

## 5. Canonical Data Contracts

### 5.1 Graph Node
Each room node must contain:
- stable room id,
- biome id,
- seed,
- room role,
- depth,
- critical-path status,
- optional-path status,
- list of typed connections.

### 5.2 Graph Edge
Each connection must contain:
- source room id,
- target room id,
- edge type,
- traversal importance,
- reverse link metadata,
- anchor requirements,
- corridor requirement metadata.

### 5.3 Room Plan
Each room plan must contain:
- room id,
- dimensions or dimension constraints,
- spawn zone,
- anchors,
- required route obligations,
- optional route opportunities,
- reserved no-block zones,
- object budgets,
- landmark budgets,
- enemy placement zones.

### 5.4 Realized Room
Each realized room must contain:
- tile grid,
- object instances,
- landmark instances,
- exits/entrances matching plan,
- collision map,
- validated spawn targets,
- transition compilation payload.

### 5.5 Transition Contract
Each transition must contain:
- source entrance id,
- target room id,
- target entrance id,
- spawn position,
- facing/orientation if applicable,
- validity status,
- build-time guarantee flag.

---

## 6. Graph Rules

### 6.1 Graph categories
Graph edges may be:
- `critical`
- `optional`
- `shortcut`
- `return`
- `locked` (future)
- `one_way` (future, optional if ever used)

### 6.2 Graph goals
Each biome must define:
- target room count range,
- critical path length range,
- optional branch density,
- loop budget,
- max depth variance,
- room role distribution,
- optional reward room density.

### 6.3 Graph invariants
The graph must:
- be connected unless biome explicitly supports disconnected subgraphs,
- contain at least one valid entry room,
- contain at least one valid exit/progression room if progression requires it,
- preserve bidirectional consistency unless edge type explicitly allows otherwise,
- satisfy branch and loop constraints for its biome profile.

### 6.4 Graph anti-goals
The graph must not:
- default to a near-path unless biome explicitly intends linearity,
- rely on room-level repair to create perceived branching,
- leave pacing entirely emergent.

---

## 7. Room Planning Rules

### 7.1 Anchor rules
Each connection from graph stage must become a room anchor contract.

Each anchor must define:
- side / direction,
- width requirement,
- landing area requirement,
- reserved access corridor,
- blocked-zone buffer,
- target connection metadata.

### 7.2 Spawn rules
Each room plan must define:
- valid player spawn zone,
- forbidden spawn overlap regions,
- minimum safety distance from critical hazards if applicable.

### 7.3 Route rules
A room plan must define:
- required traversable routes,
- optional routes if biome/role demands them,
- minimum corridor width,
- minimum route quality constraints.

### 7.4 Placement budgets
The room plan must define budgets for:
- landmarks,
- clutter,
- enemies,
- interactables,
- decorative density.

These budgets must not override required traversal space.

---

## 8. Room Realization Rules

### 8.1 Required respect for plan
Realization must not violate:
- anchor reservations,
- mandatory corridors,
- spawn zone validity,
- required route obligations.

### 8.2 Allowed variability
Realization may vary:
- terrain motifs,
- shape style,
- decorative clutter,
- clearing style,
- path style,
- biome visuals,
- non-critical object layout.

### 8.3 Forbidden behaviors
Realization must not:
- block required anchors,
- create invalid spawn conditions,
- reduce corridor width below contract,
- place objects into reserved traversal zones.

---

## 9. Validation Rules

### 9.1 Validation layers
Validation must occur at:
1. graph stage,
2. room plan stage,
3. realized room stage,
4. transition stage.

### 9.2 Fatal failures
Examples:
- missing reverse connection,
- impossible anchor layout,
- missing mandatory path,
- no valid spawn tile,
- unreachable required exit,
- invalid transition contract.

Fatal failure means:
- room or graph segment is rejected and regenerated.

### 9.3 Repairable failures
Examples:
- small obstruction in reserved corridor,
- small obstruction in landing zone,
- minor terrain overlap in non-critical space.

Repairable failure means:
- bounded repair may run once,
- repaired output must be revalidated.

### 9.4 Informational warnings
Examples:
- layout diversity below target,
- optional route count below preferred target,
- object density clipped by safety constraints.

Warnings do not mutate the room.

---

## 10. Repair Policy

Repair is allowed only for explicitly listed repairable failures.

Repair limits must be defined:
- max tiles changed,
- max number of repairs per room,
- max number of repair passes.

If repair exceeds limits:
- fail generation.

Repair must emit:
- cause id,
- tiles changed,
- affected systems,
- before/after validation result.

---

## 11. Transition Rules

### 11.1 Single truth
TransitionCompiler output is the only valid runtime transition truth.

### 11.2 No downstream mutation
After transition compilation:
- no system may change entrance semantics,
- no system may alter spawn position without invalidating and recompiling transition data.

### 11.3 Runtime guarantee
If runtime attempts a transition and the compiled transition is invalid, that is a bug, not an expected branch of control flow.

---

## 12. Region Bridging Rules

Town, biome, and interior generation may differ stylistically, but must share:
- the same transition contract,
- the same entrance semantics,
- the same validation philosophy,
- the same ownership boundaries.

Region bridging must not patch room internals after final validation.

---

## 13. Performance Rules

### 13.1 Performance goals
Generation must aim to minimize:
- repeated full-grid scans,
- duplicate collision builds,
- repeated connectivity BFS passes,
- generate-then-discard work,
- eager prewarm of fully realized rooms when abstract planning would suffice.

### 13.2 Early-stage rejection
Impossible plans should fail before:
- full object placement,
- enemy placement,
- expensive transition compilation.

### 13.3 Shared computed artifacts
The system should support reuse/caching of:
- path-distance fields,
- density fields,
- collision maps where valid,
- graph diagnostics,
- deterministic room-plan artifacts.

---

## 14. Quality Targets

Generation quality is measured across:

### 14.1 Topology quality
- branch ratio,
- loop presence,
- optional room density,
- critical path length,
- depth spread.

### 14.2 Room quality
- route diversity,
- silhouette variety,
- non-hub bias,
- readability,
- traversal clarity,
- landmark meaningfulness.

### 14.3 Transition quality
- reliable spawn arrival,
- readable entrances,
- no patched-feeling link zones.

A room or biome can be technically valid and still fail quality targets.

---

## 15. Forbidden Architectural Behaviors

The following are forbidden in the new system:

- post-generation mutation of entrance contracts,
- multiple owners for connectivity truth,
- transition systems correcting generation mistakes silently,
- graph semantics being reinterpreted downstream,
- validation logic duplicated across unrelated modules,
- repair functioning as a hidden second generator,
- runtime depending on best-effort spawn correction.

---

## 16. Config That Must Become Explicit

The following must be data/config, not hidden code behavior:

- branch target ranges,
- loop budgets,
- room role distributions,
- critical/optional edge ratios,
- corridor width targets,
- spawn safety classes,
- object safety classes,
- repair limits,
- validation severity rules,
- region transition semantics.

---

## 17. Migration Strategy

Migration must happen in phases:

1. Freeze this spec.
2. Map current modules to spec stages.
3. Mark each module:
   - keep,
   - adapt,
   - replace,
   - delete later.
4. Replace graph planning first.
5. Introduce room-plan contract layer.
6. Consolidate validation.
7. Consolidate transition compilation.
8. Remove legacy mutation/repair pathways.
9. Delete obsolete code only after parity checks pass.

---

## 18. Immediate Module Classification (initial)

### Keep / adapt
- `RoomGraphGenerator` core data model
- `RoomPlanner` anchor concepts
- transition precompute concept

### Likely replace
- hub-only `PathGenerator` logic
- distributed repair logic
- world-map-level room-internal mutation logic
- duplicated collision/connectivity helpers

### Delete later, not now
- legacy parallel generation paths
- obsolete normalization/fallback pathways after replacement exists

---

## 19. Final Principle

The generator must become a system where:

- graph defines intent,
- room plan defines obligations,
- realization creates form,
- validation enforces truth,
- transition compilation prepares runtime,
- runtime only consumes.

No other interpretation is allowed.
