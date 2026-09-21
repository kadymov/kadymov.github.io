// One gesture owns one direction. Repeats never accumulate after a delayed timer.
export class DirectionalHold {
  constructor(step, { schedule = (fn, delay) => setTimeout(fn, delay), cancel = timer => clearTimeout(timer) } = {}) {
    this.step = step;
    this.schedule = schedule;
    this.cancelTimer = cancel;
    this.pointers = new Set();
    this.timer = null;
    this.active = null;
    this.blocked = false;
  }
  down(id, x, y, direction = null) {
    this.pointers.add(id);
    if (this.pointers.size > 1 || this.blocked) { this.stop(); this.blocked = true; return; }
    this.active = { id, x, y, direction: null };
    if (direction) this.start(direction);
  }
  move(id, x, y) {
    const current = this.active;
    if (!current || current.id !== id || current.direction || this.blocked) return;
    const dx = x - current.x, dy = y - current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    this.start(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
  }
  start(direction) {
    this.active.direction = direction;
    if (!this.step(...direction)) { this.stop(); return; }
    this.timer = this.schedule(() => this.repeat(), 350);
  }
  repeat() {
    this.timer = null;
    if (!this.active || !this.step(...this.active.direction)) { this.stop(); return; }
    this.timer = this.schedule(() => this.repeat(), 150);
  }
  up(id) {
    this.pointers.delete(id);
    if (this.active?.id === id) this.stop();
    if (!this.pointers.size) this.blocked = false;
  }
  stop() {
    if (this.timer !== null) this.cancelTimer(this.timer);
    this.timer = null;
    this.active = null;
  }
  cancel() {
    this.stop();
    this.pointers.clear();
    this.blocked = false;
  }
}
