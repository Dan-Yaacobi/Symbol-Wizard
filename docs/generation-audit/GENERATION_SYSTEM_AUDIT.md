# Generation System Audit

## 1) Executive summary

The current generation stack is **functionally rich but architecturally fragmented**. Topology generation is centralized in `RoomGraphGenerator`, but room realization, transition correctness, and cross-region connectivity are enforced by multiple downstream systems (`RoomGenerator`, `WorldMapManager`, `TransitionCache`, `RoomTransitionSystem`) that each re-interpret generation intent in different ways. The result is a pipeline that “works” but has no single authoritative model for traversal guarantees, spawn correctness, or region-level pacing.

The most important findings:

- Forest room graphs are generated as a **tree with exactly `rooms - 1` edges** in practice; loops are structurally absent, and high-degree branching is statistically weak. This is the primary structural reason graphs feel linear.
- Room geometry is generated around a **single hub-and-spokes carving strategy** (`PathGenerator` from `entryFocusArea.center` to all anchors), which further reinforces “one central trunk + edge leaves” play flow.
- Transition and connectivity correctness are **validated and repaired late** (room validation + repair + transition cache spawn correction + world-map-level post-fixes), meaning substantial work is done before discovering breakage.
- There is meaningful **duplication of responsibility** (collision map builders, path-carving logic, connectivity repair logic, exit normalization logic) across multiple modules.
- Measured generation costs are dominated by biome/room generation and repeated full-grid work, not by graph generation itself.

## 2) Current generation architecture

### High-level runtime stack

1. `main.js` boot calls `WorldMapManager.enterStartingWorld(seed)`.  
2. `WorldMapManager` delegates by map type (`town`, `forest`, `house_interior`).  
3. Forest path: `BiomeGenerator.enterBiome(...)` (graph lifecycle + room cache) → `RoomGenerator.generate(...)` (physical room + validation + repair + spawn + transition cache) → `WorldMapManager.normalizeForestRoom(...)` (town-link patching + additional reachability repair).  
4. Runtime traversal uses `RoomTransitionSystem`, which depends on prebuilt `__transitionCache` in each room for entrance spawn resolution.

### Architectural shape

- **Graph layer**: `RoomGraphGenerator` (via `BiomeGraphGenerator`/`WorldGraphGenerator`).
- **Room realization layer**: `RoomPlanner`, `ExitAnchorSystem`, `PathGenerator`, `TerrainGenerator`, `ObjectPlacementSystem`, `ExitTriggerSystem`, `RoomValidationSystem`, `RoomRepairSystem`, enemy spawning.
- **Region bridge layer**: `WorldMapManager` + `TownGenerator` + `RegionGenerationSystem` helpers.
- **Transition correctness layer**: `TransitionCache` + `RoomTransitionSystem`.

## 3) Generation pipeline walkthrough

## A. New game/world start

1. `main.js` creates `BiomeGenerator`, `WorldMapManager`, `RoomTransitionSystem`.  
2. Startup prewarm calls `worldMapManager.enterStartingWorld(seed)` (`town`).  
3. Town exits are crawled and prewarmed through `roomTransitionSystem.prewarmExitTarget(...)`, recursively materializing reachable rooms.

## B. Entering a forest from town

1. Town exit resolves through `WorldMapManager.resolveMapByExit(...)`.  
2. `loadForest(seed, { roomId, returnLink })` loads biome graph (if absent), mutates start-room entrance metadata for town return alignment, loads room from biome cache or generates it, then runs `normalizeForestRoom(...)`.  
3. `normalizeForestRoom` can inject/patch special town-linked entrance and return exit, runs `ensureForestEntranceReachable`, rebuilds transition cache if needed.

## C. Entering interior

1. Town house exit resolves to `loadHouseInterior(seed, context)`.  
2. Interior map is generated in `TownGenerator.generateHouseInterior` with fixed dimensions and simpler rules.

## D. Returning to existing rooms

- `BiomeGenerator.roomCache` caches forest rooms per `biomeId::roomId` key.
- `WorldMapManager.mapCache` caches normalized map instances (`town-*`, `forest-seed-roomId`, `house-*`).
- Transitions generally reuse cached room instances; on miss they regenerate through the same pipelines.

## 4) File/module responsibility map

- `main.js`: bootstrap, startup prewarm traversal, runtime wiring.
- `world/WorldMapManager.js`: map-type routing, cache ownership, forest-town coupling, post-generation reachability surgery.
- `world/BiomeGenerator.js`: biome graph lifecycle + room cache.
- `world/RoomGraphGenerator.js`: room topology generation.
- `world/RoomGenerator.js`: per-room generation orchestrator.
- `world/RoomPlanner.js`: derive anchors and base room plan from graph node.
- `world/PathGenerator.js`: mandatory path carving from hub to anchors.
- `world/TerrainGenerator.js`: tile initialization/clearings/decor.
- `world/ObjectPlacementSystem.js`: object and landmark placement with safety fields.
- `world/RoomValidationSystem.js`: graph/anchor/corridor/reachability validation.
- `world/RoomRepairSystem.js`: localized corridor/landing road repairs.
- `world/TownGenerator.js`: town and house interior generation.
- `world/RegionGenerationSystem.js`: shared normalization/connectivity helpers; partially parallel abstraction path.
- `world/TransitionCache.js`: precompute valid spawn points + connectivity diagnostics per entrance.
- `world/RoomTransitionSystem.js`: runtime transition execution using precomputed cache.
- `world/MapGenerator.js`: legacy/unused town generator path (orphaned generation paradigm).

## 5) Data model map

Core models crossing generation layers:

- **Room node (graph)**: `{ id, seed, depth, entrances, exits, connections, state }`.
- **Graph adjacency**: `roomGraph[roomId][direction] = targetRoomId`.
- **Connection edge metadata**: direction, reverseDirection, corridor width/clearance, target entrance ID.
- **Room plan**: spawn area, exit anchors, entrance anchors, reserved corridors, density targets.
- **Physical room**: tiles, objects, entities, exits/entrances, exitCorridors, collisionMap, debug overlays.
- **Transition cache** (`__transitionCache`): `spawnByEntrance`, `connectivityByEntrance`, `pathConnectivity`.

Critical observation: graph-level concepts and physical room concepts are separated initially, but become re-coupled through late mutation in `WorldMapManager` and spawn correction in `TransitionCache`.

## 6) Graph generation diagnosis

- Graph creation is fully in `RoomGraphGenerator.generateRoomGraph`.
- A main path is always generated from `start` to `exit` first.
- Side rooms are only attached as children (single parent connection) during growth.
- “min exits per room” fill step attempts extra links, but with current defaults (`minExitsPerRoom = 1`) this often adds nothing.
- In Monte Carlo sampling (1000 seeds/biome config), loop rate is 0 across all tested biome presets; `noBranchGraphRate` is high (forest ~0.709, cave 1.0).

Conclusion: perceived linearity is primarily a graph-structure issue, then amplified by room-level carving strategy.

## 7) Room generation diagnosis

Ordered room pipeline in `RoomGenerator.generate`:

1. Resolve room dimensions/config.
2. Build abstract plan (anchors/spawn).
3. Reserve corridors/no-decor masks.
4. Initialize terrain grid.
5. Carve required paths (hub-to-anchor).
6. Carve clearings.
7. Place landmarks then objects with safety masks.
8. Decorate terrain.
9. Build exits/triggers.
10. Validate.
11. Repair + revalidate (if needed).
12. Build collision map.
13. Spawn enemies.
14. Build transition cache.

Key structural bias: every anchor is connected to a single hub, not to a designed multi-objective route network; this naturally yields centralization and predictable traversal silhouettes.

## 8) Rule ownership diagnosis

Rules are spread across config + constants + embedded heuristics:

- Explicit config modules: `BiomeConfig`, `PathGenerationConfig`, `ObjectGenerationConfig`, `WorldGenerationConfig`.
- Hardcoded constants in generation modules (`GenerationConstants`, town envelope/corridor heuristics, object category defaults, enemy defaults).
- Hidden rules in call order (e.g., object placement before full validation; post-generation repairs in multiple layers).

There is no single rule registry; operational behavior depends on distributed code-level defaults and sequencing.

## 9) Hidden coupling diagnosis

Major coupling hotspots:

- `WorldMapManager` mutates forest start-room entrance metadata before loading/generating room (graph metadata + room realization coupling).
- `normalizeForestRoom` modifies exits/entrances after room generation, then runs additional carving/repair.
- `TransitionCache` may correct spawn points post-generation, creating a second implicit source of truth for entrances.
- Multiple modules rebuild collision maps independently.
- Region utilities (`RegionGenerationSystem`) and concrete generators (`TownGenerator`, `RoomGenerator`) duplicate connectivity normalization/repair concerns.

## 10) Performance diagnosis

Measured wall-clock (Node runtime, representative synthetic scenarios, no rendering):

- Town generation: avg ~1161 ms.
- Forest biome entry from town (town + first forest room realization): avg ~1375 ms.
- House interior generation: avg ~912 ms (dominated by loading surrounding systems + map pipeline overhead in scenario harness).
- Multi-room connected forest area traversal/generation: avg ~5566 ms.

From in-engine phase timings (GenerationTiming logs):

- `map_generation` often ~220–380 ms/forest room.
- `object_placement` ~50–115 ms/forest room in sampled outputs.
- `enemy_spawning` ~27–113 ms/forest room.

Hotspot profile:

- Repeated full-grid scans/builds (density fields, blocked grids, path-distance fields, collision maps, flood fills).
- Late validation/repair means expensive stages can execute before discovering invalidity.
- Transition prewarm recursively materializes many rooms upfront.

## 11) Output quality diagnosis

Why output feels linear/boring:

1. **Topology**: near-tree graphs, almost no loops, low branching degree.
2. **Path morphology**: hub-to-edge radial carving causes same navigational grammar each room.
3. **Pacing model**: no explicit authored progression roles beyond start/exit naming and depth.
4. **Special room semantics**: mostly absent at graph level; town/interior are separate paradigms.
5. **Late repairs**: preserve validity, but can flatten variety by forcing corridors and safe zones into similar patterns.

## 12) Root causes of loss of control

- No singular source of truth for traversal intent from graph plan through runtime transition spawn.
- Responsibilities are split and reimplemented across graph gen, room gen, world map manager, transition cache, and region helper utilities.
- Validation is distributed and temporal: each layer compensates for previous layers.
- Legacy/parallel generation modules remain in tree, increasing cognitive overhead and ambiguity.

## 13) Questions current design cannot answer cleanly

- “What is the intended pacing role of this room before physical generation?”
- “Which rules are mandatory vs fallback-only?”
- “Which layer owns entrance spawn truth: room plan, transition cache, or runtime?”
- “How should town/forest/interior share common invariants while keeping distinct styles?”

## 14) Proposed future architecture boundaries (analysis-only)

1. **Graph Planner** (pure topology + room roles + progression contracts).
2. **Room Layout Planner** (anchor contracts + internal route constraints, still abstract).
3. **Room Realizer** (terrain/object/enemy realization honoring planner contracts).
4. **Validator** (single consolidated stage with strict failure reasons).
5. **Transition Compiler** (spawn/corridor cache from validated room data only).
6. **Region Bridge** (town/forest/interior linking without mutating upstream contracts).

## 15) Recommended next rewrite phases (analysis only)

1. Formalize generator spec (data contracts for graph node, room plan, entrances/exits, transition spawn contract).
2. Build deterministic graph diagnostics suite (branch/loop/depth distributions as CI metric).
3. Isolate validation into one authority and remove duplicate post-fix paths.
4. Replace hub-only pathing with role-aware intra-room routing model.
5. Unify town/forest/interior exit semantics via one transition contract.
6. Decommission legacy/parallel generation paths once parity harness exists.

## Explicit answers to required diagnostic questions

- **Why is the graph so linear?** Because generator growth is tree-first with weak branch probability and practically no loop-creation path under defaults.
- **Is linearity caused by graph design, room validation, fallback behavior, or all three?** All three, with graph design as primary driver; room/hub carving and fallback repairs amplify it.
- **Which parts are still clean/reusable?** `RoomGraphGenerator` core data shape, `RoomPlanner` anchor derivation model, transition precompute concept in `TransitionCache`.
- **Which parts should likely be deleted later?** Legacy `MapGenerator` path and duplicated connectivity/collision helper copies after consolidation.
- **Mixed responsibilities needing separation?** Graph planning vs room realization vs transition spawn correction vs world-map bridge mutation.
- **What belongs at graph-planning stage?** Room roles, required critical path, optional branches/loops, lock/key semantics, progression pacing.
- **What belongs at room-generation stage?** Geometry realization honoring anchor/route contracts, traversability envelopes.
- **What belongs at object-placement stage?** Biome flavor density/distribution under immutable route safety constraints.
- **What to validate early vs late?** Early: graph invariants + anchor feasibility contracts. Late: realized tile/object collision and spawn safety.
- **What makes generation fragile now?** Late multi-layer repairs and post-hoc mutation of entrances/exits.
- **What makes it inefficient now?** Repeated full-map passes + generate-then-repair patterns + broad startup prewarm.
- **What makes it hard to tune?** Rules scattered across constants/config/defaults and implicit call-order assumptions.
- **What makes it hard to reason about?** No single source of truth for transition and connectivity semantics.
- **What should become formal data/config?** Room role taxonomy, branch/loop targets, connectivity guarantees, repair policies, placement safety classes.
