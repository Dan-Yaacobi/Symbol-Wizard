# Generation Risk Report

## Highest design risks

## 1) Fragmented authority over connectivity

Connectivity intent is spread across:

- `RoomValidationSystem` (checks),
- `RoomRepairSystem` (local fixes),
- `WorldMapManager.ensureForestEntranceReachable` (region-bridge fixes),
- `RegionGenerationSystem.ensureRegionConnectivity` (town/region fixes),
- `TransitionCache` (spawn-connectivity corrections).

Risk: no single trusted answer to “is this room/transition valid?”

## 2) Post-generation mutation of foundational data

`WorldMapManager` mutates room entrance data for town-linked forest entry and can reshape connectivity after room generation.

Risk: graph/plan assumptions can be invalidated downstream; debugging requires replaying full lifecycle.

## 3) Duplicate responsibilities and drift

- Collision map creation duplicated in at least three places.
- Path carving/connectivity helpers exist in multiple modules.
- Exit normalization appears in region and world-map pathways.

Risk: behavior divergence over time, harder tuning and maintenance.

## 4) Paradigm split across region types

Forest uses graph-based rooms; town uses bespoke layout; interior uses fixed template.

Risk: transition logic must bridge incompatible assumptions, causing glue logic growth.

## 5) Late-fix architecture (repair-first culture)

Generation allows invalid states then relies on layered repair.

Risk: expensive, brittle, and difficult to reason about root causes.

## Hidden couplings contributing to “out of control” feeling

- Room graph metadata influences room plan, but world-map code later rewrites entrance anchors.
- Transition runtime assumes `__transitionCache` exists; missing cache is runtime error path.
- Startup prewarm and map caches influence what generation work occurs and when, affecting perceived determinism and performance.

## Source-of-truth diagnosis

| Concern | Actual source today | Single source? |
|---|---|---|
| Room identity | `roomNode.id` + map ID wrappers (`forest-seed-roomId`) | Partial |
| Graph structure | `BiomeGenerator.currentBiome.rooms/roomGraph` | Mostly yes |
| Biome progression | Implicit by room depth and manual transitions | No |
| Room connections | Graph + normalized exits in map instances | No |
| Entrance/exit pairing | Connection metadata + trigger build + map normalization | No |
| Spawn locations | Entrance fields + transition cache corrections | No |
| Persistence/regeneration | `BiomeGenerator.roomCache` + `WorldMapManager.mapCache` | Split |
| Special room roles | Minimal (`start`, `exit`) + ad-hoc map types | No |
| World transition mapping | `WorldMapManager.resolveMapByExit` + exit metadata | Mostly |

## What should own authority in future

- Graph planner owns connection contracts and room roles.
- Room realization owns geometry/object realization only.
- Validation authority owns pass/fail and repair policy.
- Transition compiler owns spawn correction once, before runtime.
- World-map bridge owns region linking, not room-internal mutation.
