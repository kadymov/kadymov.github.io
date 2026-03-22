import { useState, useEffect } from 'https://esm.sh/preact@10/hooks';

const SETTINGS_KEY = 'calorie_settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { dailyGoal: 2000, favorites: [] };
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  function setDailyGoal(goal) {
    setSettings(prev => ({ ...prev, dailyGoal: goal }));
  }

  function addFavorite(item) {
    const newItem = { id: Date.now(), ...item };
    setSettings(prev => ({ ...prev, favorites: [...prev.favorites, newItem] }));
  }

  function removeFavorite(id) {
    setSettings(prev => ({
      ...prev,
      favorites: prev.favorites.filter(f => f.id !== id),
    }));
  }

  function isFavorite({ name, grams, calories }) {
    return settings.favorites.some(
      f => f.name === name && f.grams === grams && f.calories === calories
    );
  }

  function toggleFavorite({ name, grams, calories }) {
    const existing = settings.favorites.find(
      f => f.name === name && f.grams === grams && f.calories === calories
    );
    if (existing) {
      removeFavorite(existing.id);
    } else {
      addFavorite({ name, grams, calories });
    }
  }

  return {
    dailyGoal: settings.dailyGoal,
    favorites: settings.favorites,
    setDailyGoal,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
  };
}
