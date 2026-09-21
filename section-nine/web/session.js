import { Game } from '../src/engine.js';
import { entityAt, adjacent, getEntity } from '../src/world.js';

export const DEFAULT_SETTINGS = Object.freeze({ dpad: false, textSize: 'normal' });
const VIEWS = new Set(['map', 'dialogue', 'journal', 'observations', 'directory', 'menu', 'help', 'restart', 'ending', 'targets']);

export class MobileSession {
  constructor(game = new Game()) {
    this.game = game;
    this.settings = { ...DEFAULT_SETTINGS };
    this.scroll = 0;
    this.feedback = '';
    this.planFloor = game.state.player.floor;
    this.planZoom = 1;
  }
  move(dx, dy) {
    const game = this.game;
    if (game.mode !== 'map' || game.paused || Math.abs(dx) + Math.abs(dy) !== 1) return false;
    game.facing = { x: dx, y: dy };
    const p = game.state.player;
    const entity = entityAt(p.x + dx, p.y + dy, p.floor, game.state);
    if (entity) { this.feedback = `${entity.name} — рядом. Нажмите кнопку действия.`; return false; }
    const moved = game.move(dx, dy);
    this.feedback = moved ? '' : 'Проход закрыт. Обойдите стену или мебель.';
    return moved;
  }
  open(view) {
    if (!VIEWS.has(view) || ['dialogue', 'ending'].includes(view)) return false;
    this.game.close();
    this.game.mode = view;
    this.scroll = 0;
    this.feedback = '';
    if (view === 'directory') { this.planFloor = this.game.state.player.floor; this.planZoom = 1; }
    return true;
  }
  interact(id = this.game.interactionTarget?.id) {
    if (!id) return false;
    if (this.game.mode === 'targets') this.game.close();
    const result = this.game.talk(id);
    if (result) this.scroll = 0;
    return result;
  }
  choose(index) {
    const result = this.game.choose(index);
    if (result) this.scroll = 0;
    return result;
  }
  close() { this.game.close(); this.scroll = 0; this.feedback = ''; }
  restart() { this.game.restart(); this.scroll = 0; this.feedback = ''; }
  snapshot() {
    return {
      version: 1, state: this.game.state, settings: this.settings,
      view: { mode: this.game.mode, dialogue: this.game.dialogue, paused: this.game.paused, guide: this.game.guide, facing: this.game.facing, scroll: this.scroll, planFloor: this.planFloor, planZoom: this.planZoom },
    };
  }
  static restore(raw) {
    if (!raw || raw.version !== 1 || !raw.state) throw new Error('Неизвестный формат мобильного сохранения.');
    const session = new MobileSession(new Game(raw.state));
    const game = session.game, view = raw.view ?? {};
    session.settings = {
      dpad: raw.settings?.dpad === true,
      textSize: ['normal', 'large', 'extra'].includes(raw.settings?.textSize) ? raw.settings.textSize : 'normal',
    };
    game.paused = view.paused === true;
    game.guide = view.guide === true;
    if (view.facing && Math.abs(view.facing.x) + Math.abs(view.facing.y) === 1 && Number.isInteger(view.facing.x) && Number.isInteger(view.facing.y)) game.facing = view.facing;
    game.mode = VIEWS.has(view.mode) ? view.mode : 'map';
    session.scroll = Number.isFinite(view.scroll) ? Math.max(0, view.scroll) : 0;
    session.planFloor = [23, 24].includes(view.planFloor) ? view.planFloor : game.state.player.floor;
    session.planZoom = [1, 2, 3].includes(view.planZoom) ? view.planZoom : 1;
    if (game.mode === 'ending' && !game.state.completed) game.mode = 'map';
    if (game.mode === 'dialogue') {
      const saved = view.dialogue;
      try {
        if (!saved || typeof saved.node !== 'string' || saved.node.length > 200 || !getEntity(saved.id, game.state) || !adjacent(game.state.player, game.state).some(e => e.id === saved.id)) throw new Error('Unavailable dialogue');
        game.dialogue = { id: saved.id, node: saved.node, greeting: null };
        if (!game.currentNode) throw new Error('Unavailable node');
        if (saved.greeting && typeof saved.greeting.text === 'string' && saved.greeting.text.length <= 4000 && typeof saved.greeting.replace === 'boolean') {
          game.dialogue.greeting = { text: saved.greeting.text.replace(/[\x00-\x09\x0b-\x1f\x7f-\x9f]/g, ' '), replace: saved.greeting.replace };
        }
      } catch { game.close(); session.scroll = 0; }
    }
    return session;
  }
}
