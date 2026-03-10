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
    this.color = '#4eb2ff';
    this.radius = 1.1;

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
  }
}
