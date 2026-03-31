# Generation Rewrite Recommendations (Analysis Only)

## Target outcomes

1. Predictable control over topology variety (branching, loops, pacing).
2. Single source of truth for transitions/spawn correctness.
3. Reduced repair complexity and duplicated logic.
4. Lower generation cost through staged validation and shared caches.

## Recommended future architecture

## A) Graph Planning Stage (pure, deterministic)

Inputs: biome profile, seed, progression profile.
Outputs:

- Room graph with typed edges (`critical`, `optional`, `shortcut`, `return`),
- Room role assignments (`entry`, `mid`, `challenge`, `reward`, `exit`, etc.),
- Constraints contract for each room (required anchors, min traversable corridors).

Do not generate tiles here.

## B) Room Plan Stage (still abstract)

For each graph node, compile:

- Anchor slots and reserved corridors,
- Route obligations (which anchors must be connected, optional route quotas),
- Placement budgets (objects, enemies, landmarks by zones).

## C) Room Realization Stage

Apply terrain/object/enemy generation against immutable room plan contracts.

- Fail fast if mandatory constraints cannot be met.
- Avoid mutating graph-level metadata here.

## D) Unified Validation/Repair Stage

One authority with explicit severity levels:

- Fatal (discard/retry room generation),
- Repairable (bounded repair operations),
- Informational.

Repairs should be deterministic and limited; record exact cause IDs.

## E) Transition Compilation Stage

Build transition cache and spawn resolution once from validated rooms.

- Runtime transition should never discover missing/invalid spawn unless data corruption occurs.

## F) Region Bridge Stage

Town/forest/interior transitions should use one normalized transition schema and should not mutate upstream room planning data.

## Rewrite phases (suggested sequence)

1. **Spec phase**: formalize data contracts and invariants.
2. **Instrumentation phase**: permanent diagnostics for graph quality and stage timings.
3. **Graph planner replacement**: introduce branch/loop/pacing targets with regression metrics.
4. **Room-plan contract layer**: separate abstract planning from realization.
5. **Validator consolidation**: merge duplicated connectivity/repair logic.
6. **Transition contract hardening**: eliminate runtime spawn ambiguity.
7. **Legacy cleanup**: remove unused generation modules after parity verification.

## What to keep vs replace

Keep/reuse:

- Seeded deterministic patterns and graph node metadata envelope.
- Planner idea of explicit anchors.
- Transition precompute concept (with stronger contract ownership).

Likely replace or heavily rewrite:

- Hub-only room path generation strategy.
- Distributed connectivity repair across multiple layers.
- Parallel/legacy region generation entry points.

## Config formalization priorities

Move from hidden code behavior to explicit data:

- Branch ratio targets,
- Loop budget and optional route density,
- Room role distributions by biome/depth,
- Required/optional traversal guarantees,
- Repair policy limits,
- Region-transition semantics.

## Non-goals for rewrite kickoff

- No balancing tweaks before architecture boundaries are stabilized.
- No content tuning until metrics and contracts are enforceable.
- No visual polish passes before topology and traversal quality are reliable.
