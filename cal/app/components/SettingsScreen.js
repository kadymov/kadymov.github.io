import { html } from '../utils.js';
import { useState, useRef } from 'https://esm.sh/preact@10/hooks';
import { FavoriteItem } from './FavoriteItem.js';

export function SettingsScreen({ dailyGoal, favorites, onSetDailyGoal, onAddFavorite, onRemoveFavorite, onBack }) {
  const [goalInput, setGoalInput] = useState(String(dailyGoal));

  // Форма добавления избранного
  const [favName, setFavName] = useState('');
  const [favGrams, setFavGrams] = useState('');
  const [favCal, setFavCal] = useState('');
  const [showFavForm, setShowFavForm] = useState(false);

  const favNameRef = useRef(null);
  const favGramsRef = useRef(null);
  const favCalRef = useRef(null);

  function handleGoalBlur() {
    const val = parseInt(goalInput);
    if (val > 0) onSetDailyGoal(val);
    else setGoalInput(String(dailyGoal));
  }

  function handleGoalKeyDown(e) {
    if (e.key === 'Enter') e.target.blur();
  }

  function handleAddFav() {
    const name = favName.trim();
    const g = parseInt(favGrams);
    const c = parseInt(favCal);
    if (!name) { favNameRef.current && favNameRef.current.focus(); return; }
    if (!g || g <= 0) { favGramsRef.current && favGramsRef.current.focus(); return; }
    if (!c || c <= 0) { favCalRef.current && favCalRef.current.focus(); return; }
    onAddFavorite({ name, grams: g, calories: c });
    setFavName('');
    setFavGrams('');
    setFavCal('');
    setShowFavForm(false);
  }

  function handleFavKeyDown(e, nextRef) {
    if (e.key === 'Enter') {
      if (nextRef) nextRef.current && nextRef.current.focus();
      else handleAddFav();
    }
  }

  return html`
    <div class="settings-screen">
      <div class="settings-header">
        <button class="settings-back-btn" onClick=${onBack} aria-label="Назад">‹</button>
        <h1>Настройки</h1>
        <div style="width:40px"></div>
      </div>

      <div class="settings-body">

        <div class="settings-section">
          <div class="settings-section-title">Норма калорий</div>
          <div class="input-group">
            <label>Калорий в день</label>
            <input
              type="number"
              value=${goalInput}
              min="100"
              inputmode="numeric"
              onInput=${e => setGoalInput(e.target.value)}
              onBlur=${handleGoalBlur}
              onKeyDown=${handleGoalKeyDown}
            />
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Избранные продукты</div>

          ${favorites.length === 0 && !showFavForm && html`
            <div class="fav-empty">Список пуст. Добавьте любимые продукты.</div>
          `}

          <div class="fav-list">
            ${favorites.map(item => html`
              <${FavoriteItem}
                key=${item.id}
                item=${item}
                onRemove=${onRemoveFavorite}
              />
            `)}
          </div>

          ${showFavForm ? html`
            <div class="fav-form">
              <div class="input-group">
                <label>Название</label>
                <input
                  ref=${favNameRef}
                  type="text"
                  value=${favName}
                  placeholder="Например: Греча"
                  autocomplete="off"
                  onInput=${e => setFavName(e.target.value)}
                  onKeyDown=${e => handleFavKeyDown(e, favGramsRef)}
                />
              </div>
              <div class="input-row">
                <div class="input-group">
                  <label>Граммы</label>
                  <input
                    ref=${favGramsRef}
                    type="number"
                    value=${favGrams}
                    placeholder="150"
                    min="0"
                    inputmode="numeric"
                    onInput=${e => setFavGrams(e.target.value)}
                    onKeyDown=${e => handleFavKeyDown(e, favCalRef)}
                  />
                </div>
                <div class="input-group">
                  <label>Калории</label>
                  <input
                    ref=${favCalRef}
                    type="number"
                    value=${favCal}
                    placeholder="320"
                    min="0"
                    inputmode="numeric"
                    onInput=${e => setFavCal(e.target.value)}
                    onKeyDown=${e => handleFavKeyDown(e, null)}
                  />
                </div>
              </div>
              <div class="fav-form-actions">
                <button class="btn-add" onClick=${handleAddFav}>Сохранить</button>
                <button class="btn-cancel" onClick=${() => setShowFavForm(false)}>Отмена</button>
              </div>
            </div>
          ` : html`
            <button class="btn-add-fav" onClick=${() => { setShowFavForm(true); setTimeout(() => favNameRef.current && favNameRef.current.focus(), 50); }}>
              + Добавить продукт
            </button>
          `}
        </div>

      </div>
    </div>
  `;
}
