# Generation Rules Catalog

## Explicit rules (declared constants/config)

| Rule | Location | Type | Influence | Assessment | Future spec? |
|---|---|---|---|---|---|
| `minRooms/maxRooms` per biome | `BiomeConfig` | Explicit | Graph size | Healthy but opaque without diagnostics | Yes |
| `minExitsPerRoom/maxExitsPerRoom` | `BiomeConfig` + `RoomGraphGenerator` | Explicit | Degree bounds | Weak effect under defaults | Yes |
| `branchProbability` | `BiomeConfig` + `RoomGraphGenerator` | Explicit | Side-room growth chance | Insufficient for non-linearity alone | Yes |
| `MIN_ROAD_WIDTH`, `PATH_CORRIDOR_WIDTH`, landing constants | `GenerationConstants` | Explicit | Traversal corridor geometry | Critical, should stay centralized | Yes |
| Path trail radii/wander chance | `PathGenerationConfig` | Explicit | Internal room path shape | Healthy knobs | Yes |
| Object safety distances/density | `ObjectGenerationConfig` | Explicit | Clutter placement and clearance | Important but costly | Yes |
| Enemy spawn distance constraints | `EncounterGenerator` defaults/runtime config | Explicit | Combat pacing + safety | Healthy | Yes |
| Forest room dimensions override | `WorldGenerationConfig` | Explicit | Room scale | Important for perf/feel | Yes |

## Implicit rules (encoded by call order/data shape)

| Rule | Where it emerges | Influence | Assessment |
|---|---|---|---|
| Main path is always primary traversal spine | Graph build order | Pacing linearization | Dangerous |
| Side rooms inherit parent depth | Side-growth step | Exploration shape | Acceptable but simplistic |
| Room routing is hub-centric | `PathGenerator` | Similar room flow every time | Dangerous |
| Objects place before final validation/repair | `RoomGenerator` order | Rework and accidental obstruction | Dangerous |
| Transition spawn truth can diverge from entrance definition | `TransitionCache` corrections | Debugging complexity | Dangerous |
| World map may mutate room entrances post-generation | `WorldMapManager.loadForest/normalizeForestRoom` | Hidden coupling across layers | Dangerous |

## Emergent rules (observed behavior not formally declared)

| Emergent rule | Structural reason | Healthy? |
|---|---|---|
| Forest graphs are mostly near-linear trees | Main-path-first + weak branching + no loop phase | No |
| Optional exploration is shallow | Low branch node counts + no deep side-role planning | No |
| Start-room transitions often need spawn correction | Entrance anchors + object/terrain constraints + cache post-check | No |
| Connectivity is preserved by repeated late repairs | Multiple validation/repair systems in sequence | Mixed |
| Town→forest linkage can feel “patched” | Post-generation entrance injection and path surgery | No |

## Rule ownership conflicts

- Exit/entrance semantics are touched by graph planner, room planner, trigger builder, world-map normalizer, and transition cache.
- Connectivity policy exists in room validation, room repair, world-map forest repair, and region connectivity helper.
- Collision map generation is duplicated instead of standardized.

## Rules that should be promoted into formal spec first

1. Graph topology targets (branch ratio, loop budget, max depth variance).
2. Room route contracts (required traversable corridors and optional route requirements).
3. Entrance/exit spawn contract with single authoritative correction policy.
4. Validation severity levels (fatal vs repairable) and who is allowed to repair.
5. Region transition contract across town/forest/interior.
