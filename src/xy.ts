export default class XY {
  x: number;
  y: number;
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  toString() { return this.x + "," + this.y; }
  is(xy: XY) { return (this.x == xy.x && this.y == xy.y); }
  dist8(xy: XY) {
    let dx = xy.x - this.x;
    let dy = xy.y - this.y;
    return Math.max(Math.abs(dx), Math.abs(dy));
  }

  dist4(xy: XY) {
    let dx = xy.x - this.x;
    let dy = xy.y - this.y;
    return Math.abs(dx) + Math.abs(dy);
  }

  dist(xy: XY) {
    let dx = xy.x - this.x;
    let dy = xy.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  plus(xy: XY) {
    return new XY(this.x + xy.x, this.y + xy.y);
  }

  minus(xy: XY) {
    return new XY(this.x - xy.x, this.y - xy.y);
  }

  div(divisor: number) {
    return new XY(this.x / divisor, this.y / divisor);
  }
}
