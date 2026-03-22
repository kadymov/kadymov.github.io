import { html } from '../utils.js';

export function FavoriteItem({ item, onRemove }) {
  return html`
    <div class="fav-item">
      <div class="fav-item-info">
        <div class="fav-item-name">${item.name}</div>
        <div class="fav-item-meta">${item.grams} г · ${item.calories} ккал</div>
      </div>
      <button
        class="fav-item-remove"
        onClick=${() => onRemove(item.id)}
        aria-label="Удалить из избранного"
      >✕</button>
    </div>
  `;
}
