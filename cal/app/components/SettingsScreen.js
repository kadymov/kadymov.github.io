import { html } from '../utils.js';
import { useState, useRef, useEffect } from 'https://esm.sh/preact@10/hooks';
import { FavoriteItem } from './FavoriteItem.js';
import { searchFoods } from '../data/foodsDb.js';

export function SettingsScreen({ dailyGoal, favorites, onSetDailyGoal, onAddFavorite, onRemoveFavorite, onBack }) {
  const [goalInput, setGoalInput] = useState(String(dailyGoal));

  // Форма добавления избранного
  const [favName, setFavName] = useState('');
  const [favGrams, setFavGrams] = useState('');
  const [favCal, setFavCal] = useState('');
  const [showFavForm, setShowFavForm] = useState(false);

  // Поиск по базе при добавлении
  const [favSearchResults, setFavSearchResults] = useState([]);
  const [favSelectedFromDb, setFavSelectedFromDb] = useState(null); // { name, kcalPer100 }
  const [showDropdown, setShowDropdown] = useState(false);

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

  // ── Пункт 1: подтверждение удаления ──
  function handleRemoveFavorite(id) {
    if (window.confirm('Удалить продукт из избранного?')) {
      onRemoveFavorite(id);
    }
  }

  // ── Поле имени с поиском по базе ──
  async function handleFavNameInput(e) {
    const val = e.target.value;
    setFavName(val);
    setFavSelectedFromDb(null); // сбрасываем выбор из БД при ручном изменении

    if (val.trim().length >= 1) {
      const results = await searchFoods(val.trim());
      setFavSearchResults(results.slice(0, 8));
      setShowDropdown(results.length > 0);
    } else {
      setFavSearchResults([]);
      setShowDropdown(false);
    }
  }

  // Автовычисление калорий при изменении граммов (если выбран продукт из БД)
  useEffect(() => {
    if (favSelectedFromDb) {
      const g = parseInt(favGrams);
      if (g > 0) {
        setFavCal(String(Math.round(g * favSelectedFromDb.kcalPer100 / 100)));
      } else {
        setFavCal('');
      }
    }
  }, [favGrams, favSelectedFromDb]);

  function handleSelectFromDb(item) {
    setFavName(item.name);
    setFavSelectedFromDb({ name: item.name, kcalPer100: item.kcalPer100 });
    setFavSearchResults([]);
    setShowDropdown(false);
    // Если уже введены граммы — сразу считаем калории
    const g = parseInt(favGrams);
    if (g > 0) {
      setFavCal(String(Math.round(g * item.kcalPer100 / 100)));
    }
    setTimeout(() => favGramsRef.current && favGramsRef.current.focus(), 50);
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
    setFavSelectedFromDb(null);
    setFavSearchResults([]);
    setShowDropdown(false);
    setShowFavForm(false);
  }

  function handleFavGramsKeyDown(e) {
    if (e.key === 'Enter') favCalRef.current && favCalRef.current.focus();
  }

  function handleFavCalKeyDown(e) {
    if (e.key === 'Enter') handleAddFav();
  }

  function handleCancelFavForm() {
    setFavName('');
    setFavGrams('');
    setFavCal('');
    setFavSelectedFromDb(null);
    setFavSearchResults([]);
    setShowDropdown(false);
    setShowFavForm(false);
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
                onRemove=${handleRemoveFavorite}
              />
            `)}
          </div>

          ${showFavForm ? html`
            <div class="fav-form">
              <div class="input-group" style="position:relative">
                <label>Название</label>
                <input
                  ref=${favNameRef}
                  type="text"
                  value=${favName}
                  placeholder="Найти или ввести название"
                  autocomplete="off"
                  onInput=${handleFavNameInput}
                  onKeyDown=${e => { if (e.key === 'Enter' && !showDropdown) favGramsRef.current && favGramsRef.current.focus(); }}
                  onBlur=${() => setTimeout(() => setShowDropdown(false), 150)}
                  onFocus=${() => { if (favSearchResults.length > 0) setShowDropdown(true); }}
                />
                ${showDropdown && html`
                  <div class="fav-db-dropdown">
                    ${favSearchResults.map(item => html`
                      <div
                        class="fav-db-dropdown-item"
                        key=${item.id}
                        onMouseDown=${() => handleSelectFromDb(item)}
                      >
                        <span class="fav-db-dropdown-name">${item.name}</span>
                        <span class="fav-db-dropdown-kcal">${item.kcalPer100} ккал/100г</span>
                      </div>
                    `)}
                  </div>
                `}
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
                    onKeyDown=${handleFavGramsKeyDown}
                  />
                </div>
                <div class="input-group">
                  <label>Калории${favSelectedFromDb ? html` <span class="fav-cal-auto">(авто)</span>` : ''}</label>
                  <input
                    ref=${favCalRef}
                    type="number"
                    value=${favCal}
                    placeholder="320"
                    min="0"
                    inputmode="numeric"
                    readOnly=${!!favSelectedFromDb}
                    style=${favSelectedFromDb ? 'opacity:0.7' : ''}
                    onInput=${e => { if (!favSelectedFromDb) setFavCal(e.target.value); }}
                    onKeyDown=${handleFavCalKeyDown}
                  />
                </div>
              </div>
              <div class="fav-form-actions">
                <button class="btn-add" onClick=${handleAddFav}>Сохранить</button>
                <button class="btn-cancel" onClick=${handleCancelFavForm}>Отмена</button>
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
