import { html } from '../utils.js';

export function FoodItem({ food, index, onEdit }) {
  return html`
    <div class="food-item" onClick=${() => onEdit(index, food)}>
      <div class="food-info">
        <div class="food-name">${food.name}</div>
        <div class="food-grams">${food.grams} г</div>
      </div>
      <div class="food-calories">
        ${food.calories} <span>ккал</span>
      </div>
    </div>
  `;
}
