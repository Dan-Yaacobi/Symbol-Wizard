# Room / Map Generation Audit

## Ordered room pipeline (forest room)

1. **Plan creation** (`RoomPlanner.createPlan`)  
   - Computes spawn area and edge anchors from graph connections.
2. **Reservation phase** (`ExitAnchorSystem.reserve`)  
   - Claims anchor/corridor/spawn masks and `noDecorMask`.
3. **Terrain init** (`TerrainGenerator.initializeTiles`)  
   - Builds base tile grid by biome style.
4. **Required path carving** (`PathGenerator.carveRequiredPaths`)  
   - Carves from central hub to all entrances/exits.
5. **Clearing carving** (`TerrainGenerator.carveForestClearings`)  
   - Adds open areas post-path.
6. **Object safety mask prep**  
   - Merge road/reservations/clearings + anchor/intersection expansions.
7. **Landmark placement** (`ObjectPlacementSystem.placeLandmarks`)  
8. **Object placement** (`ObjectPlacementSystem.placeObjects`)  
9. **Terrain decoration pass** (`TerrainGenerator.decorate`)  
10. **Exit trigger build** (`ExitTriggerSystem.build`)  
11. **Validation** (`RoomValidationSystem.validate`)  
12. **Repair + revalidate** (`RoomRepairSystem.repair` then validate again)
13. **Collision map build** (`RuntimeSystems.buildCollisionMap`)  
14. **Enemy spawn** (`spawnEnemiesForRoom`)  
15. **Transition cache compile** (`buildRoomTransitionCache`)  

## Stage assumptions and hidden dependencies

- Planner assumes graph directions are already valid and complete.
- Path carving assumes central hub is viable universal connector.
- Object placement assumes safety masks from earlier passes are sufficient; later validation can still fail.
- Validation assumes object footprints are final; repairs modify terrain but do not re-run full object layout.
- Transition cache assumes final room geometry and objects are stable; later world-map normalization may still mutate entrances.

## Entrances/exits and traversability guarantees

### Guarantees currently present

- Exit triggers are generated for every planned exit anchor.
- Validation checks:
  - graph consistency,
  - landing walkability and safety radius,
  - corridor width constraints,
  - spawn-to-anchor and spawn-to-landing reachability.
- Repair can force roads through corridor/landing spaces.

### Guarantees missing or weak

- No guarantee of high-quality route topology (only reachability).
- No guarantee of meaningful optional routes inside room.
- No guarantee that post-normalization mutations (e.g., town-link entrance adjustments) preserve original planning intent without additional surgical fixes.

## What can accidentally block traversal

- Dense terrain and object placement (pre-validation).
- Entrance spawn tile collisions requiring transition-cache correction.
- WorldMapManager post-linking changes that inject or realign entrances after generation.

## Town vs wilderness vs interior generation paradigms

- **Wilderness/forest**: graph-driven rooms + planner/reservation/path/object/validation pipeline.
- **Town**: bespoke town layout pipeline (plaza, houses, envelope, town exit road, region connectivity repairs).
- **House interior**: fixed-size room template with light random furniture.

These are three different paradigms with partially shared utilities but no unified generation contract.

## Spawn placement model

- Player spawn at runtime uses entrance-driven spawn target resolved via `TransitionCache` (corrected if needed).
- Enemy spawn uses `EncounterGenerator` + zones + distance constraints from entrances/exits/spawn/path masks.
- NPC and static object spawns are generator-specific (town scripts, object placement rules, interior hardcoded spots).

## Quality diagnosis (room-level)

Rooms feel similar because:

- The same hub-to-anchor carving grammar is applied almost universally.
- Repair paths carve deterministic safety corridors that smooth out uniqueness.
- Object placement is safety-heavy around paths/anchors, often producing broad central roads + peripheral clutter bands.
