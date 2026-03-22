import { html } from '../utils.js';
import { useState, useRef, useEffect } from 'https://esm.sh/preact@10/hooks';
import { SearchTab } from './SearchTab.js';

export function AddModal({ isOpen, onClose, onAdd, favorites, isFavorite, toggleFavorite }) {
  const [tab, setTab] = useState('search'); // 'search' | 'favorites' | 'manual'

  // Состояния вкладки "Вручную"
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [calories, setCalories] = useState('');

  // Состояние редактирования элемента избранного
  const [selectedFav, setSelectedFav] = useState(null);
  const [favWeight, setFavWeight] = useState('');

  const nameRef = useRef(null);
  const gramsRef = useRef(null);
  const calRef = useRef(null);
  const favWeightRef = useRef(null);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setGrams('');
      setCalories('');
      setTab('search');
      setSelectedFav(null);
      setFavWeight('');
    }
  }, [isOpen]);

  // Сброс selectedFav при смене вкладки
  useEffect(() => {
    setSelectedFav(null);
    setFavWeight('');
  }, [tab]);

  // Автофокус на вкладке Вручную
  useEffect(() => {
    if (isOpen && tab === 'manual') {
      const t = setTimeout(() => nameRef.current && nameRef.current.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [tab, isOpen]);

  // Автофокус на поле веса при выборе избранного
  useEffect(() => {
    if (selectedFav) {
      setFavWeight(String(selectedFav.grams));
      const t = setTimeout(() => favWeightRef.current && favWeightRef.current.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [selectedFav]);

  // ── Вкладка Вручную ──
  function handleAdd() {
    const trimmed = name.trim();
    const g = parseInt(grams);
    const c = parseInt(calories);
    if (!trimmed) { nameRef.current && nameRef.current.focus(); return; }
    if (!g || g <= 0) { gramsRef.current && gramsRef.current.focus(); return; }
    if (!c || c <= 0) { calRef.current && calRef.current.focus(); return; }
    onAdd({ name: trimmed, grams: g, calories: c });
    onClose();
  }

  function handleKeyDown(e, nextRef) {
    if (e.key === 'Enter') {
      if (nextRef) nextRef.current && nextRef.current.focus();
      else handleAdd();
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  // ── Вкладка Избранное: прямое добавление (кнопка +) ──
  function handleAddFavorite(fav, e) {
    e.stopPropagation();
    onAdd({ name: fav.name, grams: fav.grams, calories: fav.calories });
    onClose();
  }

  // ── Вкладка Избранное: редактирование (клик на тело карточки) ──
  function handleSelectFav(fav) {
    setSelectedFav(fav);
  }

  // kcalPer100 вычисляется из данных самого избранного
  const favKcalPer100 = selectedFav
    ? Math.round(selectedFav.calories / selectedFav.grams * 100)
    : 0;

  const favCalcCalories = selectedFav
    ? Math.round((parseFloat(favWeight) || 0) * favKcalPer100 / 100)
    : 0;

  const favCurrentItem = selectedFav && parseInt(favWeight) > 0
    ? { name: selectedFav.name, grams: parseInt(favWeight), calories: favCalcCalories }
    : null;
  const favCurrentIsFav = favCurrentItem ? isFavorite(favCurrentItem) : false;

  function handleAddFromFavEdit() {
    if (!selectedFav) return;
    const g = parseInt(favWeight);
    if (!g || g <= 0) { favWeightRef.current && favWeightRef.current.focus(); return; }
    onAdd({ name: selectedFav.name, grams: g, calories: favCalcCalories });
    onClose();
  }

  function handleFavWeightKeyDown(e) {
    if (e.key === 'Enter') handleAddFromFavEdit();
  }

  // ── Вкладка Вручную: проверка для кнопки ♡ ──
  const manualName = name.trim();
  const manualGrams = parseInt(grams);
  const manualCal = parseInt(calories);
  const manualValid = manualName && manualGrams > 0 && manualCal > 0;
  const manualItem = manualValid ? { name: manualName, grams: manualGrams, calories: manualCal } : null;
  const manualIsFav = manualItem ? isFavorite(manualItem) : false;

  return html`
    <div
      class=${'modal-overlay' + (isOpen ? ' active' : '')}
      onClick=${handleOverlayClick}
    >
      <div class="modal">
        <div class="modal-handle"></div>
        <h2>Добавить продукт</h2>

        <div class="modal-tabs">
          <button
            class=${'modal-tab' + (tab === 'search' ? ' modal-tab--active' : '')}
            onClick=${() => setTab('search')}
          >Поиск</button>
          <button
            class=${'modal-tab' + (tab === 'favorites' ? ' modal-tab--active' : '')}
            onClick=${() => setTab('favorites')}
          >Избранное</button>
          <button
            class=${'modal-tab' + (tab === 'manual' ? ' modal-tab--active' : '')}
            onClick=${() => setTab('manual')}
          >Вручную</button>
        </div>

        ${tab === 'search' && html`
          <${SearchTab}
            onAdd=${onAdd}
            onClose=${onClose}
            isFavorite=${isFavorite}
            toggleFavorite=${toggleFavorite}
            isOpen=${isOpen}
          />
        `}

        ${tab === 'favorites' && html`
          ${selectedFav ? html`
            <!-- Экран редактирования избранного -->
            <div class="search-selected">
              <button class="search-back-btn" onClick=${() => setSelectedFav(null)}>
                ‹ <span>Вернуться к избранному</span>
              </button>

              <div class="search-selected-card">
                <div class="search-selected-name">${selectedFav.name}</div>
                <div class="search-selected-base">${favKcalPer100} ккал на 100 г</div>

                <div class="input-group" style="margin-top: 20px;">
                  <label>Вес (г)</label>
                  <input
                    ref=${favWeightRef}
                    type="number"
                    value=${favWeight}
                    min="1"
                    inputmode="numeric"
                    onInput=${e => setFavWeight(e.target.value)}
                    onKeyDown=${handleFavWeightKeyDown}
                  />
                </div>

                <div class="search-calories-preview">
                  <span class="search-calories-value">${favCalcCalories}</span>
                  <span class="search-calories-unit"> ккал</span>
                </div>

                <div class="add-action-row">
                  <button
                    class=${'fav-toggle-btn' + (favCurrentIsFav ? ' fav-toggle-btn--active' : '') + (!favCurrentItem ? ' fav-toggle-btn--hidden' : '')}
                    onClick=${() => favCurrentItem && toggleFavorite(favCurrentItem)}
                    aria-label=${favCurrentIsFav ? 'Убрать из избранного' : 'В избранное'}
                    title=${favCurrentIsFav ? 'Убрать из избранного' : 'В избранное'}
                  >${favCurrentIsFav ? '♥' : '♡'}</button>
                  <button class="btn-add btn-add--flex" onClick=${handleAddFromFavEdit}>Добавить</button>
                </div>
              </div>
            </div>
          ` : html`
            <!-- Список избранного -->
            <div class="modal-fav-list">
              ${(!favorites || favorites.length === 0) ? html`
                <div class="modal-fav-empty">
                  <p>Список избранного пуст.</p>
                  <p>Добавьте продукты в настройках ⚙️</p>
                </div>
              ` : favorites.map(fav => html`
                <div
                  class="modal-fav-item modal-fav-item--clickable"
                  key=${fav.id}
                  onClick=${() => handleSelectFav(fav)}
                >
                  <div class="modal-fav-info">
                    <div class="modal-fav-name">${fav.name}</div>
                    <div class="modal-fav-meta">${fav.grams} г · ${fav.calories} ккал</div>
                  </div>
                  <button
                    class="modal-fav-add-btn"
                    onClick=${(e) => handleAddFavorite(fav, e)}
                    aria-label="Добавить"
                  >+</button>
                </div>
              `)}
            </div>
          `}
        `}

        ${tab === 'manual' && html`
          <div>
            <div class="input-group">
              <label>Название</label>
              <input
                ref=${nameRef}
                type="text"
                value=${name}
                placeholder="Например: Овсянка"
                autocomplete="off"
                onInput=${e => setName(e.target.value)}
                onKeyDown=${e => handleKeyDown(e, gramsRef)}
              />
            </div>

            <div class="input-row">
              <div class="input-group">
                <label>Граммы</label>
                <input
                  ref=${gramsRef}
                  type="number"
                  value=${grams}
                  placeholder="150"
                  min="0"
                  inputmode="numeric"
                  onInput=${e => setGrams(e.target.value)}
                  onKeyDown=${e => handleKeyDown(e, calRef)}
                />
              </div>
              <div class="input-group">
                <label>Калории</label>
                <input
                  ref=${calRef}
                  type="number"
                  value=${calories}
                  placeholder="320"
                  min="0"
                  inputmode="numeric"
                  onInput=${e => setCalories(e.target.value)}
                  onKeyDown=${e => handleKeyDown(e, null)}
                />
              </div>
            </div>

            <div class="add-action-row">
              <button
                class=${'fav-toggle-btn' + (manualIsFav ? ' fav-toggle-btn--active' : '') + (!manualValid ? ' fav-toggle-btn--hidden' : '')}
                onClick=${() => manualItem && toggleFavorite(manualItem)}
                aria-label=${manualIsFav ? 'Убрать из избранного' : 'В избранное'}
                title=${manualIsFav ? 'Убрать из избранного' : 'В избранное'}
              >${manualIsFav ? '♥' : '♡'}</button>
              <button class="btn-add btn-add--flex" onClick=${handleAdd}>Добавить</button>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}
