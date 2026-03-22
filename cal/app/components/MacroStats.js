import { html } from '../utils.js';

export function MacroStats({ total, goal, count }) {
  return html`
    <div class="macros">
      <div class="macro-item">
        <div class="macro-value">${total}</div>
        <div class="macro-label">Съедено</div>
      </div>
      <div class="macro-item">
        <div class="macro-value">${goal}</div>
        <div class="macro-label">Цель</div>
      </div>
      <div class="macro-item">
        <div class="macro-value">${count}</div>
        <div class="macro-label">Приёмов</div>
      </div>
    </div>
  `;
}
