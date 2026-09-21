import { MobileSession } from './session.js';
export const SAVE_KEY = 'section-nine.mobile.v1';
export class MobileStorage {
  constructor(getStorage) {
    this.getStorage = getStorage;
    this.enabled = true;
    this.warning = '';
    this.lastSaved = 0;
  }
  load() {
    try {
      const text = this.getStorage().getItem(SAVE_KEY);
      if (!text) return new MobileSession();
      if (text.length > 2 * 1024 * 1024) throw new Error('Слишком большой файл.');
      return MobileSession.restore(JSON.parse(text));
    } catch {
      this.enabled = false;
      this.warning = 'Не удалось прочитать сохранение. Новый сеанс без записи; исходные данные сохранены. Сброс доступен через «Новое прохождение».';
      return new MobileSession();
    }
  }
  save(session, force = true, now = Date.now()) {
    if (!this.enabled || (!force && now - this.lastSaved < 5000)) return false;
    try {
      this.getStorage().setItem(SAVE_KEY, JSON.stringify(session.snapshot()));
      this.lastSaved = now;
      return true;
    } catch {
      this.enabled = false;
      this.warning = 'Автосохранение недоступно. Можно продолжить без записи; после закрытия приложения прогресс может быть потерян.';
      return false;
    }
  }
  reset(session) {
    this.enabled = true;
    this.warning = '';
    return this.save(session);
  }
}
