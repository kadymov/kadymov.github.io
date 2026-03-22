import { openDB } from 'https://esm.sh/idb@8';   // ← без npm, чистый ES-модуль

const DB_NAME = 'nutritionApp';
const STORE_NAME = 'foods';
const VERSION = 1;

let cachedFoods = null;        // самый быстрый in-memory кэш
let dbPromise = null;

// Открываем/создаём IndexedDB
async function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    }
  });
  return dbPromise;
}

// Загружаем готовый JSON в IndexedDB (только один раз)
export async function initFoodsDB() {
  const db = await getDB();
  const count = await db.count(STORE_NAME);

  if (count === 0) {
    console.log('Загружаем готовую базу в IndexedDB...');
    const res = await fetch('/app/data/foods.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error('Не найден foods-preprocessed.json');

    const foods = await res.json();

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await Promise.all(foods.map(food => store.put({...food, nameLower: food.name.toLowerCase()})));
    await tx.done;

    console.log('База успешно загружена в IndexedDB');
  }
}

// Получаем данные в память
async function getFoods() {
  if (cachedFoods) return cachedFoods;

  await initFoodsDB();
  const db = await getDB();
  cachedFoods = await db.getAll(STORE_NAME);
  return cachedFoods;
}

// Поиск по нескольким словам с сортировкой по длине имени
export async function searchFoods(query) {
  if (!query || query.trim().length === 0) return [];

  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const foods = await getFoods();

  const filtered = foods.filter(f => words.every(word => f.nameLower.includes(word)));
  filtered.sort((a, b) => a.name.length - b.name.length);

  return filtered.slice(0, 30);
}
