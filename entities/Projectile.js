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
    this.color = '#66aaff';
    this.frames = ['-', '-', '-', '>'];
  }
}
