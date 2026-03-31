# GENERATION_ARCHITECTURE_PLAN.md

## 1. Purpose

This document defines:
- the **final architectural structure** of the generation system,
- the **verdict on all current modules**,
- the **new systems to introduce**,
- the **rewrite order**,
- and **what must be added or removed**.

This document works together with:
- `GENERATION_SPEC.md` → rules and invariants
- `GENERATION_MIGRATION_MAP.md` → module mapping

This file answers:
> what the system should look like, and how to get there.

---

## 2. Target Architecture Overview

The generator must be structured into strict stages:

1. Graph Planning
2. Room Planning
3. Room Realization
4. Validation
5. Transition Compilation
6. Region Bridging
7. Runtime Consumption

Each stage has:
- a **single owner**
- a **clear contract**
- **no overlapping authority**

---

## 3. Final System Ownership

| Stage | Owner System |
|---|---|
| Graph Planning | GraphPlanner |
| Room Planning | RoomPlanCompiler |
| Room Realization | RoomRealizer (Terrain + Objects + Routes) |
| Validation | GenerationValidator |
| Repair | GenerationRepairPolicy |
| Transition Compilation | TransitionCompiler |
| Region Bridging | RegionBridgeCompiler |
| Runtime | MapLoader + RoomTransitionSystem |

---

## 4. Module Verdict (Full Classification)

### 🟢 KEEP (with upgrades if noted)

#### RoomGraphGenerator → GraphPlanner
- KEEP → EXTEND
- Add:
  - loops
  - branch targets
  - room roles

---

#### RoomPlanner → RoomPlanCompiler
- KEEP → MAJOR UPGRADE
- Must become:
  - contract system
  - route definition layer

Add:
- requiredRoutes
- optionalRoutes
- reservedZones
- spawn contract
- placement budgets

---

#### TerrainGenerator
- KEEP
- Must obey room plan strictly

---

#### ObjectPlacementSystem
- KEEP → CONSTRAIN

Must:
- respect reserved zones
- not block routes
- not break spawn validity

---

#### RoomTransitionSystem
- KEEP

Must:
- become pure runtime consumer
- no fallback logic

---

#### BiomeGenerator
- KEEP → CLEAN

Must:
- handle graph lifecycle
- handle room cache

Must NOT:
- mutate generation results
- contain generation logic

---

---

### 🟡 KEEP BUT TRANSFORM

#### TransitionCache → TransitionCompiler
- KEEP → REWRITE BEHAVIOR

Must:
- only compile
- never correct

Remove:
- spawn correction logic
- hidden fallback behavior

---

#### RoomValidationSystem → GenerationValidator
- KEEP → EXPAND + MERGE

Must absorb:
- world-map validation
- transition validation

Becomes:
- single validation authority

---

#### RoomRepairSystem → GenerationRepairPolicy
- KEEP → HEAVILY RESTRICT

Allowed:
- small corridor cleanup
- landing cleanup

Forbidden:
- structural fixes
- graph mutation
- entrance rewriting

---

---

### 🔴 RESTRICT / SPLIT

#### WorldMapManager
- SPLIT into:

##### MapLoader (NEW)
- loading
- caching
- no mutation

##### RegionBridgeCompiler (NEW)
- handles region connections

REMOVE from WorldMapManager:
- normalizeForestRoom
- ensureForestEntranceReachable
- any mutation of room internals

---

---

### 🔴 REPLACE

#### PathGenerator → RouteRealizer
- DELETE & REBUILD

Reason:
- hub-and-spokes design enforces sameness
- ignores room plan

Replacement:
- route-based system
- supports multiple paths
- respects required/optional routes

---

---

### 🔴 DELETE / ABSORB

#### RegionGenerationSystem
- DELETE / ABSORB into:
  - GenerationValidator
  - RegionBridgeCompiler

---

#### MapGenerator (legacy)
- DELETE

---

---

## 5. New Systems to Introduce

### GraphPlanner
Location:
