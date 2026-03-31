# Graph Generation Audit

## Plain-English model

The forest biome graph is generated as:

1. Build a mandatory main chain from `start` to `exit`.
2. Optionally attach side rooms to existing rooms while under room budget.
3. Ensure each room has at least a minimum degree (defaults usually already satisfied).

This produces a connected graph that is usually a tree and often close to a path with a few leaves.

## Technical model

Primary function: `generateRoomGraph({ seed, biomeConfig })`.

Data structures:

- `rooms: Map<string, RoomNode>`
- `roomGraph: Record<roomId, Record<direction, targetRoomId>>`
- `RoomNode.connections[]` with directional metadata and corridor requirements.

Key steps:

1. Resolve constraints: min/max room counts, min/max exits, branch probability.
2. Choose `targetRooms` and `mainPathLength` by RNG.
3. Create ordered main-path nodes (`start`, `main-*`, `exit`).
4. Connect main path bidirectionally with unique directional edges.
5. Grow side rooms (`side-*`) from eligible parents until stopping condition.
6. Run min-exit pass to add extra edges if degree < minimum.
7. Validate reverse links + adjacency map consistency.

## Why it becomes linear in practice

### Explicit structural causes

- Main path is always present and dominant.
- Side growth only creates parent-child additions, so graph grows as a tree.
- No explicit loop-creation phase exists.
- With default `minExitsPerRoom=1`, the extra-edge pass rarely adds connections.

### Empirical topology metrics (1000 seeds per biome preset)

- Forest: avg rooms 8.13, avg branch nodes 0.37, no-branch graphs 70.9%, loop graphs 0%.
- Cave: avg rooms 4.55, no-branch graphs 100%, loop graphs 0%.
- Mountain: no-branch 82.3%, loop graphs 0%.
- River: no-branch 77.9%, loop graphs 0%.

Interpretation: “branching is possible” but statistically suppressed; loop gameplay is absent.

## Graph rules by region type

- Forest/biome rooms use this graph system.
- Town and house interiors do **not** use this graph planner; they are single-map handcrafted/procedural layouts in `TownGenerator`.

Result: generation paradigms are mixed across region types.

## Special room roles

- Only explicit role names in graph are `start` and `exit` IDs on main path.
- No formal graph-level tags for boss, mini-boss, treasure, lock/key gates, or pacing phases.

## Backtracking support

- Bidirectional links are enforced at graph-level.
- Runtime backtracking works because every connection is two-way.
- However, lack of loops means backtracking is mostly “reverse along path,” not strategic routing.

## Source of truth status (graph scope)

- Graph source of truth: `rooms + roomGraph` in biome object.
- But downstream modules can alter practical traversal affordances (spawn correction, post-carving repairs), so realized experience diverges from graph intent.

## Clean/reusable graph components

- Deterministic seeded RNG and node/edge metadata envelope are reusable.
- Bidirectional consistency validation is good baseline hygiene.

## High-risk graph weaknesses

1. No explicit loop budget.
2. No branch-depth targets.
3. No room-role planning beyond start/exit names.
4. No separation between critical path edges and optional exploration edges.
