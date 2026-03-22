import { html } from '../utils.js';
import { FoodItem } from './FoodItem.js';

export function FoodList({ foods, onEdit }) {
  return html`
    <div class="food-section">
      <div class="section-title">Сегодня</div>
      <div class="food-list">
        ${foods.length === 0
          ? html`
            <div class="empty-state">
              <div class="icon">🍽️</div>
              <p>Пока ничего не добавлено.<br/>Нажмите + чтобы начать.</p>
            </div>
          `
          : [...foods].reverse().map((food, i) => html`
            <${FoodItem}
              key=${foods.length - 1 - i}
              food=${food}
              index=${foods.length - 1 - i}
              onEdit=${onEdit}
            />
          `)
        }
      </div>
      ${foods.length > 0 && html`
        <div class="swipe-hint">Нажмите на элемент для редактирования</div>
      `}
    </div>
  `;
}
