import { html } from '../utils.js';
import { useState, useRef, useEffect } from 'https://esm.sh/preact@10/hooks';

export function EditFoodModal({ isOpen, entry, onClose, onUpdate, onRemove }) {
  // entry = { index, food: { name, grams, calories } }
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [calories, setCalories] = useState('');

  // Запоминаем соотношение ккал/100г на момент открытия
  const [kcalPer100, setKcalPer100] = useState(0);
  // Флаг: пользователь вручную менял калории (не через авто-пересчёт)
  const [manualCal, setManualCal] = useState(false);

  const nameRef = useRef(null);
  const gramsRef = useRef(null);
  const calRef = useRef(null);

  useEffect(() => {
    if (isOpen && entry) {
      const { food } = entry;
      setName(food.name);
      setGrams(String(food.grams));
      setCalories(String(food.calories));
      setKcalPer100(food.grams > 0 ? food.calories / food.grams * 100 : 0);
      setManualCal(false);
      setTimeout(() => gramsRef.current && gramsRef.current.focus(), 350);
    }
  }, [isOpen, entry]);

  function handleGramsInput(e) {
    const g = e.target.value;
    setGrams(g);
    if (!manualCal && kcalPer100 > 0) {
      const newCal = Math.round((parseFloat(g) || 0) * kcalPer100 / 100);
      setCalories(String(newCal));
    }
  }

  function handleCaloriesInput(e) {
    setCalories(e.target.value);
    setManualCal(true);
  }

  function handleSave() {
    const trimmed = name.trim();
    const g = parseInt(grams);
    const c = parseInt(calories);
    if (!trimmed) { nameRef.current && nameRef.current.focus(); return; }
    if (!g || g <= 0) { gramsRef.current && gramsRef.current.focus(); return; }
    if (!c || c <= 0) { calRef.current && calRef.current.focus(); return; }
    onUpdate(entry.index, { name: trimmed, grams: g, calories: c });
    onClose();
  }

  function handleRemove() {
    if (confirm(`Удалить «${name}»?`)) {
      onRemove(entry.index);
      onClose();
    }
  }

  function handleKeyDown(e, nextRef, isSave) {
    if (e.key === 'Enter') {
      if (nextRef) nextRef.current && nextRef.current.focus();
      else if (isSave) handleSave();
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return html`
    <div
      class=${'modal-overlay' + (isOpen ? ' active' : '')}
      onClick=${handleOverlayClick}
    >
      <div class="modal">
        <div class="modal-handle"></div>
        <h2>Редактировать</h2>

        <div class="input-group">
          <label>Название</label>
          <input
            ref=${nameRef}
            type="text"
            value=${name}
            autocomplete="off"
            onInput=${e => setName(e.target.value)}
            onKeyDown=${e => handleKeyDown(e, gramsRef, false)}
          />
        </div>

        <div class="input-row">
          <div class="input-group">
            <label>Граммы</label>
            <input
              ref=${gramsRef}
              type="number"
              value=${grams}
              min="1"
              inputmode="numeric"
              onInput=${handleGramsInput}
              onKeyDown=${e => handleKeyDown(e, calRef, false)}
            />
          </div>
          <div class="input-group">
            <label>Калории</label>
            <input
              ref=${calRef}
              type="number"
              value=${calories}
              min="1"
              inputmode="numeric"
              onInput=${handleCaloriesInput}
              onKeyDown=${e => handleKeyDown(e, null, true)}
            />
          </div>
        </div>

        <button class="btn-add" onClick=${handleSave}>Сохранить</button>
        <button class="btn-delete" onClick=${handleRemove}>Удалить</button>
      </div>
    </div>
  `;
}
