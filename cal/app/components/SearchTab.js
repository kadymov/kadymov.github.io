import { html } from '../utils.js';
import { useState, useRef, useEffect } from 'https://esm.sh/preact@10/hooks';
import { searchFoods } from '../data/foodsDb.js';

export function SearchTab({ onAdd, onClose, isFavorite, toggleFavorite }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null); // { id, name, kcalPer100 }
  const [weight, setWeight] = useState('100');

  const searchRef = useRef(null);
  const weightRef = useRef(null);

  // Автофокус на поле поиска при монтировании
  useEffect(() => {
    const t = setTimeout(() => searchRef.current && searchRef.current.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // При выборе продукта — фокус на поле веса
  useEffect(() => {
    if (selected) {
      const t = setTimeout(() => weightRef.current && weightRef.current.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [selected]);

  async function handleSearch(e) {
    const q = e.target.value;
    setQuery(q);
    setResults(await searchFoods(q));
    setSelected(null);
  }

  function handleSelect(item) {
    setSelected(item);
    setWeight('100');
  }

  function handleBack() {
    setSelected(null);
  }

  const calcCalories = selected
    ? Math.round((parseFloat(weight) || 0) * selected.kcalPer100 / 100)
    : 0;

  // Текущий produit для проверки избранного
  const currentItem = selected && parseInt(weight) > 0
    ? { name: selected.name, grams: parseInt(weight), calories: calcCalories }
    : null;
  const isCurrentFav = currentItem ? isFavorite(currentItem) : false;

  function handleAdd() {
    if (!selected) return;
    const g = parseInt(weight);
    if (!g || g <= 0) {
      weightRef.current && weightRef.current.focus();
      return;
    }
    onAdd({ name: selected.name, grams: g, calories: calcCalories });
    onClose();
  }

  function handleWeightKeyDown(e) {
    if (e.key === 'Enter') handleAdd();
  }

  // Экран выбранного продукта
  if (selected) {
    return html`
      <div class="search-selected">
        <button class="search-back-btn" onClick=${handleBack}>
          ‹ <span>Вернуться к поиску</span>
        </button>

        <div class="search-selected-card">
          <div class="search-selected-name">${selected.name}</div>
          <div class="search-selected-base">${selected.kcalPer100} ккал на 100 г</div>

          <div class="input-group" style="margin-top: 20px;">
            <label>Вес (г)</label>
            <input
              ref=${weightRef}
              type="number"
              value=${weight}
              min="1"
              inputmode="numeric"
              onInput=${e => setWeight(e.target.value)}
              onKeyDown=${handleWeightKeyDown}
            />
          </div>

          <div class="search-calories-preview">
            <span class="search-calories-value">${calcCalories}</span>
            <span class="search-calories-unit"> ккал</span>
          </div>

          <div class="add-action-row">
            <button
              class=${'fav-toggle-btn' + (isCurrentFav ? ' fav-toggle-btn--active' : '') + (!currentItem ? ' fav-toggle-btn--hidden' : '')}
              onClick=${() => currentItem && toggleFavorite(currentItem)}
              aria-label=${isCurrentFav ? 'Убрать из избранного' : 'В избранное'}
              title=${isCurrentFav ? 'Убрать из избранного' : 'В избранное'}
            >${isCurrentFav ? '♥' : '♡'}</button>
            <button class="btn-add btn-add--flex" onClick=${handleAdd}>Добавить</button>
          </div>
        </div>
      </div>
    `;
  }

  // Экран поиска
  return html`
    <div class="search-wrap">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input
          ref=${searchRef}
          class="search-input"
          type="text"
          value=${query}
          placeholder="Найти продукт..."
          autocomplete="off"
          onInput=${handleSearch}
        />
        ${query && html`
          <button class="search-clear" onClick=${() => { setQuery(''); setResults([]); searchRef.current && searchRef.current.focus(); }}>✕</button>
        `}
      </div>

      <div class="search-results">
        ${results.length === 0 && query.length > 0 && html`
          <div class="search-empty">Ничего не найдено по запросу «${query}»</div>
        `}
        ${results.length === 0 && query.length === 0 && html`
          <div class="search-hint">Начните вводить название продукта</div>
        `}
        ${results.map(item => html`
          <div class="search-result-item" key=${item.id} onClick=${() => handleSelect(item)}>
            <div class="search-result-info">
              <div class="search-result-name">${item.name}</div>
              <div class="search-result-cat">${item.category}</div>
            </div>
            <div class="search-result-kcal">${item.kcalPer100}<span> ккал/100г</span></div>
          </div>
        `)}
      </div>
    </div>
  `;
}
