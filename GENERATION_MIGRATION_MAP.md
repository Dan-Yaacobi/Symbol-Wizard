# GENERATION_MIGRATION_MAP.md

## 1. Module Mapping

| Current Module | Current Responsibility | Spec Stage | Status | Notes |
|---|---|---|---|---|
| RoomGraphGenerator | Builds graph topology | GraphPlanner | KEEP (adapt) | Add loops + roles later |
| RoomPlanner | Creates anchors/spawn areas | RoomPlanCompiler | KEEP (adapt) | Needs stronger contracts |
| PathGenerator | Carves hub paths | RoomRealizer | REPLACE | Violates route diversity |
| TerrainGenerator | Tile generation + clearings | RoomRealizer | KEEP | Must obey plan contracts |
| ObjectPlacementSystem | Objects + safety masks | RoomRealizer | KEEP (adapt) | Must not break routes |
| RoomValidationSystem | Validates traversal | GenerationValidator | KEEP (merge) | Merge with others |
| RoomRepairSystem | Fixes traversal | GenerationRepairPolicy | RESTRICT | Too powerful now |
| TransitionCache | Spawn correction | TransitionCompiler | KEEP (rewrite rules) | Remove correction logic |
| RoomTransitionSystem | Runtime transitions | Runtime | KEEP | Should become dumb consumer |
| WorldMapManager | Map loading + mutation | RegionBridgeCompiler | RESTRICT/REPLACE | Must stop mutating rooms |
| TownGenerator | Town layout | RoomRealizer (town variant) | KEEP (isolate) | Needs unified contract |
| RegionGenerationSystem | Connectivity helpers | ??? | DELETE/ABSORB | Duplication source |
