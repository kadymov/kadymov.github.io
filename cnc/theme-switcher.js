/**
 * Theme Switcher
 * Переключатель тем для всех HTML файлов
 */

class ThemeSwitcher {
  constructor() {
    this.themes = {
      'dark-blue': 'themes/dark-blue.css',
      'light': 'themes/light.css'
    };
    
    this.currentTheme = localStorage.getItem('selectedTheme') || 'dark-blue';
    this.init();
  }
  
  init() {
    this.createSwitcher();
    this.loadTheme(this.currentTheme);
  }
  
  createSwitcher() {
    // Создаем контейнер для переключателя
    const switcher = document.createElement('div');
    switcher.className = 'theme-switcher';
    
    // Создаем кнопки для каждой темы
    Object.keys(this.themes).forEach(themeKey => {
      const btn = document.createElement('button');
      btn.className = 'theme-btn';
      btn.textContent = this.getThemeName(themeKey);
      btn.onclick = () => this.switchTheme(themeKey);
      
      if (themeKey === this.currentTheme) {
        btn.classList.add('active');
      }
      
      switcher.appendChild(btn);
    });
    
    // Добавляем переключатель на страницу
    document.body.appendChild(switcher);
  }
  
  getThemeName(themeKey) {
    const names = {
      'dark-blue': 'Темная',
      'light': 'Светлая'
    };
    return names[themeKey] || themeKey;
  }
  
  switchTheme(themeKey) {
    if (this.themes[themeKey]) {
      this.currentTheme = themeKey;
      this.loadTheme(themeKey);
      this.updateActiveButton();
      localStorage.setItem('selectedTheme', themeKey);
    }
  }
  
  loadTheme(themeKey) {
    // Удаляем старую тему
    const existingLink = document.getElementById('theme-css');
    if (existingLink) {
      existingLink.remove();
    }
    
    // Добавляем новую тему
    const link = document.createElement('link');
    link.id = 'theme-css';
    link.rel = 'stylesheet';
    link.href = this.themes[themeKey];
    document.head.prepend(link);
  }
  
  updateActiveButton() {
    // Убираем активный класс у всех кнопок
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Добавляем активный класс к текущей кнопке
    const buttons = document.querySelectorAll('.theme-btn');
    const themeKeys = Object.keys(this.themes);
    const currentIndex = themeKeys.indexOf(this.currentTheme);
    
    if (buttons[currentIndex]) {
      buttons[currentIndex].classList.add('active');
    }
  }
}

// Инициализация переключателя тем после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  new ThemeSwitcher();
});

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeSwitcher;
} else if (typeof window !== 'undefined') {
  window.ThemeSwitcher = ThemeSwitcher;
}
