import { html } from '../utils.js';

export function FoodItem({ food, index, onRemove }) {
  function handleClick() {
    if (confirm(`Удалить "${food.name}"?`)) {
      onRemove(index);
    }
  }

  return html`
    <div class="food-item" onClick=${handleClick}>
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
