# Core Systems Explanation

## Symbol Rendering Engine
- Maintains a `CellBuffer` of `{char, fg, bg}` cells.
- Rebuilds frame from map + entities each tick.
- Uses monospaced canvas text rendering for symbol graphics.

## Camera System
- Follows player position.
- Clamps viewport to world bounds.
- Converts world ↔ screen coordinates for aiming and rendering.

## Entity System
- Base `Entity` class with shared transform/combat properties.
- Specialized entities: Player, Enemy, NPC.
- Projectiles and gold pickups modeled as lightweight objects.

## Collision Detection
- Tile collision for movement against blocked cells.
- Circle overlap for projectile-to-enemy hits.

## Projectile and Combat
- Magic Bolt projectile with TTL, velocity, damage, and animated symbol sequence.
- Enemies die at 0 HP and emit gold drops.

## Animation System
- Minimal animation through projectile frame cycling and enemy jitter in AI update.
- Designed to preserve silhouette readability.

## Procedural Map System
- Room carve with randomized wooden blockers for variation.
- Guarantees navigable test dungeon larger than viewport.

## Dialogue System
- Tree-structured nodes with speaker, line, and options.
- Chat UI binds numeric choice keys to options.

## UI System
- Chat box below game viewport for narrative interaction.
- HUD drawn in-world with HP and gold counters.
