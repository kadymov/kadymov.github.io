import { useState, useEffect } from 'https://esm.sh/preact@10/hooks';

const HISTORY_KEY = 'calorie_history';

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function offsetDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function useFoods(dateKey) {
  const [history, setHistory] = useState(loadHistory);

  const foods = history[dateKey] || [];

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  function addFood(food) {
    setHistory(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), food],
    }));
  }

  function removeFood(index) {
    setHistory(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter((_, i) => i !== index),
    }));
  }

  function updateFood(index, updatedFood) {
    setHistory(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).map((food, i) => i === index ? updatedFood : food),
    }));
  }

  return { foods, history, addFood, removeFood, updateFood };
}
