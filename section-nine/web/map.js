import { WIDTH, HEIGHT, findPath } from '../src/world.js';
import { cellAppearance } from '../src/presentation.js';
import { objective } from '../src/engine.js';

export function camera(player, width, height, cell = 16) {
  const cols = Math.max(1, Math.min(WIDTH, Math.floor(width / cell)));
  const rows = Math.max(1, Math.min(HEIGHT, Math.floor(height / cell)));
  return {
    cols, rows, x: Math.max(0, Math.min(WIDTH - cols, player.x - Math.floor(cols / 2))),
    y: Math.max(0, Math.min(HEIGHT - rows, player.y - Math.floor(rows / 2))),
    left: (width - cols * cell) / 2, top: (height - rows * cell) / 2,
  };
}
export function paintMap(canvas, game, { overview = false, floor = game.state.player.floor, zoom = 1, availableWidth } = {}) {
  const rect = canvas.parentElement.getBoundingClientRect();
  const cell = overview ? Math.max(6, (availableWidth ?? rect.width) / WIDTH) * ({ 1: 1, 2: 2, 3: 4 }[zoom]) : 16;
  const width = overview ? WIDTH * cell : rect.width;
  const height = overview ? HEIGHT * cell : rect.height;
  if (width < 1 || height < 1) return;
  const ratio = window.devicePixelRatio || 1;
  const pw = Math.round(width * ratio), ph = Math.round(height * ratio);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  if (overview) { canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#091117'; ctx.fillRect(0, 0, width, height);
  const view = overview ? { x: 0, y: 0, cols: WIDTH, rows: HEIGHT, left: 0, top: 0 } : camera(game.state.player, width, height, cell);
  const route = game.guide && floor === game.state.player.floor ? new Set(findPath(game.state.player, objective(game.state).target, game.state).map(p => `${p.x},${p.y}`)) : new Set();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let y = 0; y < view.rows; y++) for (let x = 0; x < view.cols; x++) {
    const appearance = cellAppearance(game, view.x + x, view.y + y, 1, route, floor);
    const px = view.left + x * cell, py = view.top + y * cell;
    ctx.fillStyle = `rgb(${appearance.bg.join(',')})`; ctx.fillRect(px, py, cell, cell);
    ctx.fillStyle = `rgb(${appearance.fg.join(',')})`;
    const structural = /[─│┌┐└┘├┤┬┴┼╵╶╷╴═║┄┆]/.test(appearance.glyph);
    ctx.font = `${appearance.bold ? 'bold ' : ''}${cell * (structural ? 1 : .79)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    if (structural) {
      ctx.save(); ctx.translate(px + cell / 2, py + cell / 2);
      ctx.scale(cell / Math.max(1, ctx.measureText(appearance.glyph).width), 1);
      ctx.fillText(appearance.glyph, 0, 0); ctx.restore();
    } else ctx.fillText(appearance.glyph, px + cell / 2, py + cell / 2, cell);
  }
}
