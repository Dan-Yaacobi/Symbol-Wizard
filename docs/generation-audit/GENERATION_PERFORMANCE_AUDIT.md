# Generation Performance Audit

## Method

- Static analysis of algorithmic passes and retry loops.
- Runtime timing via lightweight, non-invasive harness invoking existing generators (no gameplay logic changes).
- Existing in-engine timing logs (`[GenerationTiming]`) used as corroborating stage-level evidence.

## Representative scenario timings (ms)

Environment: Node runtime, generator-only invocations.

| Scenario | Min | Avg | P50 | P90 | P95 | Max |
|---|---:|---:|---:|---:|---:|---:|
| Town generation | 902.87 | 1160.94 | 1146.08 | 1606.38 | 1606.38 | 1606.38 |
| Forest biome entry from town | 1213.95 | 1375.10 | 1390.91 | 1545.86 | 1545.86 | 1545.86 |
| House interior generation | 748.14 | 912.48 | 850.59 | 1223.05 | 1318.25 | 1318.25 |
| Multi-room connected forest area | 4874.97 | 5565.70 | 5645.70 | 6175.02 | 6175.02 | 6175.02 |

## Stage-level observations from built-in logs

Typical forest-room ranges observed:

- `map_generation`: ~220–380 ms.
- `object_placement`: ~50–115 ms.
- `enemy_spawning`: ~27–113 ms.
- `room_generation_total`: ~440–850 ms.

## Hotspot analysis

### Algorithmically expensive sections

1. **Grid-wide passes** (often repeated):
   - Terrain initialization,
   - Path-distance field BFS,
   - Density field construction,
   - Candidate pool construction,
   - Collision map rebuilds,
   - Flood-fill connectivity checks.

2. **Validation reachability checks**:
   - Per-exit BFS from spawn in `RoomValidationSystem`.

3. **Transition cache compilation**:
   - Path connectivity component extraction + per-entrance spawn search/correction.

### Cheap individually but multiplicative

- Candidate center selection + validation attempts in object placement.
- Cluster spawn attempts and rejection loops in enemy/object systems.
- Prewarm recursion materializing all connected rooms at startup.

### Hidden n² / scaling risks

- Clearance conflict checks in object placement compare candidate vs placed set (can trend O(n²) as object count rises).
- Multiple per-room full scans with map size growth (O(W*H) each pass; many passes per room).

## Redundant/repeated work

- Collision map built in multiple modules (`RuntimeSystems`, `WorldMapManager`, `TownGenerator`).
- Connectivity repairs happen in both room-level and world-map-level systems.
- Transition validity checked during generation and again in transition cache diagnostics.

## Generate-then-discard patterns

- Rooms can be fully generated, then altered by post-processing repairs and spawn corrections.
- Startup prewarm eagerly generates rooms that may not be visited soon.

## Structural inefficiencies

- Topology decisions are mostly complete early, but physical realization still performs broad expensive passes before final transition-level spawn correctness is guaranteed.
- Validation is comparatively late; significant work may precede repair decisions.

## Determinism and caching opportunities (future design)

1. Cache deterministic intermediate fields (path-distance, density) keyed by room seed + config hash.
2. Unify collision map builder and avoid repeated recomputation across layers.
3. Stage-gate validation earlier (anchor feasibility before full object/enemy phases).
4. Separate preview/planning from full realization so startup prewarm can use lighter artifacts.
