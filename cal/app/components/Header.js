import { html } from '../utils.js';

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const DAYS = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

function formatDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function Header({ dateKey, isToday, onPrev, onNext, onSettings, onChart }) {
  return html`
    <div class="header">
      <div class="header-top">
        <button class="settings-icon-btn" onClick=${onChart} aria-label="График">📊</button>
        <h1>Калории</h1>
        <button class="settings-icon-btn" onClick=${onSettings} aria-label="Настройки">⚙️</button>
      </div>
      <div class="date-nav">
        <button class="date-nav-btn" onClick=${onPrev} aria-label="Предыдущий день">‹</button>
        <div class="date-nav-label">
          <span class="date">${formatDateKey(dateKey)}</span>
          ${isToday && html`<span class="date-today-badge">сегодня</span>`}
        </div>
        <button
          class=${'date-nav-btn' + (isToday ? ' date-nav-btn--disabled' : '')}
          onClick=${onNext}
          aria-label="Следующий день"
          disabled=${isToday}
        >›</button>
      </div>
    </div>
  `;
}
