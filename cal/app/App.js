import { html } from './utils.js';
import { useState } from 'https://esm.sh/preact@10/hooks';
import { useFoods, getTodayKey, offsetDateKey } from './hooks/useFoods.js';
import { useSettings } from './hooks/useSettings.js';
import { Header } from './components/Header.js';
import { Gauge } from './components/Gauge.js';
import { MacroStats } from './components/MacroStats.js';
import { FoodList } from './components/FoodList.js';
import { AddModal } from './components/AddModal.js';
import { SettingsScreen } from './components/SettingsScreen.js';
import { initFoodsDB } from './data/foodsDb.js';

await initFoodsDB();


export function App() {
  const [selectedDate, setSelectedDate] = useState(getTodayKey);
  const { foods, addFood, removeFood } = useFoods(selectedDate);
  const { dailyGoal, favorites, setDailyGoal, addFavorite, removeFavorite, isFavorite, toggleFavorite } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [screen, setScreen] = useState('main'); // 'main' | 'settings'

  const todayKey = getTodayKey();
  const isToday = selectedDate === todayKey;

  const total = foods.reduce((sum, f) => sum + f.calories, 0);
  const remaining = Math.max(dailyGoal - total, 0);
  const fraction = total / dailyGoal;

  function goToPrev() {
    setSelectedDate(prev => offsetDateKey(prev, -1));
  }

  function goToNext() {
    if (!isToday) {
      setSelectedDate(prev => offsetDateKey(prev, +1));
    }
  }

  function toggleModal() {
    setModalOpen(prev => !prev);
  }

  if (screen === 'settings') {
    return html`
      <${SettingsScreen}
        dailyGoal=${dailyGoal}
        favorites=${favorites}
        onSetDailyGoal=${setDailyGoal}
        onAddFavorite=${addFavorite}
        onRemoveFavorite=${removeFavorite}
        onBack=${() => setScreen('main')}
      />
    `;
  }

  return html`
    <${Header}
      dateKey=${selectedDate}
      isToday=${isToday}
      onPrev=${goToPrev}
      onNext=${goToNext}
      onSettings=${() => setScreen('settings')}
    />
    <${Gauge} remaining=${remaining} fraction=${fraction} />
    <${MacroStats} total=${total} goal=${dailyGoal} count=${foods.length} />
    <${FoodList} foods=${foods} onRemove=${removeFood} />

    <button
      class=${'fab' + (modalOpen ? ' rotated' : '')}
      aria-label="Добавить продукт"
      onClick=${toggleModal}
    >+</button>

    <${AddModal}
      isOpen=${modalOpen}
      onClose=${() => setModalOpen(false)}
      onAdd=${addFood}
      favorites=${favorites}
      isFavorite=${isFavorite}
      toggleFavorite=${toggleFavorite}
    />
  `;
}
