import { REALTIME_TICK_MS } from './life.js';

// A monotonic clock drives the simulation, never player key frequency. A late
// callback advances at most once: returning from sleep must not fast-forward NPCs.
export class WorldClock {
  constructor(game, {
    now = () => performance.now(),
    enabled = () => true,
    onTick = () => {},
    schedule = (callback, interval) => setInterval(callback, interval),
    cancel = timer => clearInterval(timer),
  } = {}) {
    this.game = game;
    this.now = now;
    this.enabled = enabled;
    this.onTick = onTick;
    this.schedule = schedule;
    this.cancel = cancel;
    this.lastAt = null;
    this.timer = null;
  }
  reset() { this.lastAt = null; }
  poll() {
    if (!this.enabled() || !this.game.realtimeRunning) { this.reset(); return false; }
    const time = this.now();
    if (this.lastAt === null) { this.lastAt = time; return false; }
    if (time - this.lastAt < REALTIME_TICK_MS) return false;
    this.lastAt = time;
    return this.game.tickRealtime();
  }
  start() {
    if (this.timer !== null) return;
    this.reset();
    this.timer = this.schedule(() => { if (this.poll()) this.onTick(); }, 100);
  }
  stop() {
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
    this.reset();
  }
}
