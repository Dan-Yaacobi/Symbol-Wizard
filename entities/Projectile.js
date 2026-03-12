export class Projectile {
  constructor(x, y, dx, dy) {
    this.type = 'projectile';
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.speed = 65;
    this.damage = 3;
    this.ttl = 0.9;
    this.color = '#8fe8ff';
    this.glowColor = '#d9f7ff';
    this.trailColor = '#9fdfff';
    this.radius = 1.1;
    this.size = 1.2;

    this.spriteFrames = [
      [
        ' ===> ',
        '====> ',
        ' ===> ',
      ],
      [
        ' >==> ',
        '>>==> ',
        ' >==> ',
      ],
    ];
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frameDuration = 0.06;

    // Directional sprites improve readability of travel direction in combat.
    this.directionalSpriteFrames = {
      east: [
        ['  ▶▶ ', '═◆▶▶ ', '  ▶▶ '],
        ['  ▷▶ ', '═◆▷▶ ', '  ▷▶ '],
      ],
      west: [
        [' ◀◀  ', '◀◀◆═ ', ' ◀◀  '],
        [' ◀◁  ', '◀◁◆═ ', ' ◀◁  '],
      ],
      north: [
        ['  ▲  ', ' ◇▲◇ ', '  ║  '],
        ['  △  ', ' ◇△◇ ', '  ║  '],
      ],
      south: [
        ['  ║  ', ' ◇▼◇ ', '  ▼  '],
        ['  ║  ', ' ◇▽◇ ', '  ▽  '],
      ],
      northeast: [
        ['   ◥▶ ', '  ◥◆▶ ', ' ◥▶   '],
        ['   ◣▶ ', '  ◣◆▶ ', ' ◣▶   '],
      ],
      northwest: [
        [' ◀◤   ', ' ◀◆◤  ', '   ◀◤ '],
        [' ◀◢   ', ' ◀◆◢  ', '   ◀◢ '],
      ],
      southeast: [
        [' ◣▶   ', '  ◣◆▶ ', '   ◣▶ '],
        [' ◤▶   ', '  ◤◆▶ ', '   ◤▶ '],
      ],
      southwest: [
        ['   ◢◀ ', ' ◀◆◢  ', ' ◀◢   '],
        ['   ◤◀ ', ' ◀◆◤  ', ' ◀◤   '],
      ],
    };

    this.trailParticles = [];
    this.trailSpawnTimer = 0;
    this.trailSpawnInterval = 0.045;
    this.trailParticleLifetime = { min: 0.15, max: 0.25 };
  }
}
