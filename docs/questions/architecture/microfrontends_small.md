# Microfrontends - Senior Cheat Sheet

## Основная концепция

**Микрофронтенды** = независимо разрабатываемые frontend-приложения, составляющие единое целое

**Принципы**:
- Автономные команды
- Независимое развертывание  
- Технологическая свобода
- Изоляция кода и состояния

## Подходы к реализации

### 1. Module Federation (Webpack 5)
```javascript
// Host приложение
const ModuleFederationPlugin = require('@module-federation/webpack');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      remotes: {
        header: 'header@http://localhost:3001/remoteEntry.js',
        dashboard: 'dashboard@http://localhost:3002/remoteEntry.js',
      },
    }),
  ],
};

// Использование
const Header = React.lazy(() => import('header/Header'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Header />
    </Suspense>
  );
}
```

### 2. Single-SPA Framework
```javascript
import { registerApplication, start } from 'single-spa';

registerApplication({
  name: 'header-app',
  app: () => System.import('header-app'),
  activeWhen: () => true,
});

registerApplication({
  name: 'dashboard-app',
  app: () => System.import('dashboard-app'),
  activeWhen: (location) => location.pathname.startsWith('/dashboard'),
});

start();
```

### 3. Build-time Integration
```javascript
// NPM пакеты
// package.json
{
  "dependencies": {
    "@company/header-mf": "^1.2.0",
    "@company/sidebar-mf": "^2.1.0"
  }
}

// Простая интеграция, но требует пересборки
```

## Коммуникация между MF

### CustomEvents - базовый подход
```javascript
// Отправка
const event = new CustomEvent('user-updated', {
  detail: { userId: 123, name: 'John' }
});
window.dispatchEvent(event);

// Получение
useEffect(() => {
  const handler = (event) => setUser(event.detail);
  window.addEventListener('user-updated', handler);
  return () => window.removeEventListener('user-updated', handler);
}, []);
```

### EventBus - продвинутый подход
```javascript
class EventBus {
  constructor() { this.events = {}; }
  
  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  }
  
  emit(event, data) {
    this.events[event]?.forEach(cb => cb(data));
  }
  
  off(event, callback) {
    this.events[event] = this.events[event]?.filter(cb => cb !== callback);
  }
}

window.eventBus = new EventBus();
```

### Shared State
```javascript
// Глобальные сервисы
window.sharedServices = {
  userService: {
    getCurrentUser: () => fetch('/api/user/current'),
    updateUser: (data) => fetch('/api/user', { method: 'PUT', body: JSON.stringify(data) })
  },
  globalState: { user: null, theme: 'light' }
};
```

## Стилизация и консистентность

### Design System
```javascript
// Общий пакет @company/design-system
export const Button = styled.button`
  background: ${props => props.theme.primary};
  padding: 8px 16px;
  border-radius: 4px;
`;

// Использование в MF
import { Button, theme } from '@company/design-system';
```

### CSS изоляция
```javascript
// CSS-in-JS с prefixes
const useStyles = createUseStyles({
  container: { padding: '16px' }
}, { 
  generateId: (rule, sheet) => `mf-${microfrontendName}-${rule.key}` 
});
```

## Error Handling

### Error Boundaries для каждого MF
```javascript
class MFErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    window.errorReporting?.captureException(error, {
      microfrontend: this.props.name,
      extra: errorInfo
    });
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Ошибка в {this.props.name}</div>;
    }
    return this.props.children;
  }
}
```

## Testing стратегии

### Contract Testing
```javascript
describe('Header MF Contract', () => {
  it('should emit user-logout event with correct structure', () => {
    const eventSpy = jest.fn();
    window.addEventListener('user-logout', eventSpy);
    
    fireEvent.click(screen.getByTestId('logout-button'));
    
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { userId: expect.any(String), timestamp: expect.any(Number) }
      })
    );
  });
});
```

## Развертывание

### Independent Deployment
```yaml
# CI/CD pipeline для каждого MF
on:
  push:
    paths: ['packages/header/**']

jobs:
  deploy:
    steps:
      - name: Build & Deploy
        run: |
          cd packages/header
          npm run build
          aws s3 sync dist s3://mf-cdn/header/
```

### Версионирование
```javascript
const VERSIONS = {
  header: process.env.HEADER_VERSION || 'latest',
  dashboard: process.env.DASHBOARD_VERSION || 'latest'
};

const loadMF = (name, version = 'latest') => {
  const script = document.createElement('script');
  script.src = `https://cdn.company.com/${name}/${version}/remoteEntry.js`;
  document.head.appendChild(script);
};
```

## Преимущества vs Недостатки

### ✅ Преимущества
- **Автономные команды** - независимая разработка
- **Технологическое разнообразие** - разные стеки
- **Масштабируемость** - легче масштабировать команды
- **Отказоустойчивость** - изоляция сбоев

### ❌ Недостатки  
- **Сложность** - архитектуры и инфраструктуры
- **Performance** - дублирование, больше запросов
- **Консистентность** - сложно поддерживать UX
- **Debugging** - сложная отладка взаимодействий

## Когда использовать

### ✅ Подходит для:
- **Большие команды** (>50 разработчиков)
- **Сложные домены** с четкими границами
- **Legacy migration** - постепенный переход
- **Разные темпы разработки** команд
- **Технологическое разнообразие** необходимо

### ❌ НЕ подходит для:
- **Маленькие команды** (<10 разработчиков)  
- **Простые приложения** - overkill
- **Тесно связанная функциональность**
- **Стартапы** - преждевременная оптимизация
- **Нет четких границ** доменов

## Senior Best Practices

1. **Start with monolith** - MF это эволюция, не стартовая точка
2. **Domain boundaries** - четкие границы ответственности по доменам
3. **Shared dependencies** - управляй общими зависимостями (React, Router)
4. **Design system** - обязательно для консистентности UI
5. **Contract testing** - тестируй интерфейсы между MF
6. **Independent deployment** - каждый MF должен деплоиться независимо
7. **Error isolation** - ошибка в одном MF не должна ронять остальные
8. **Performance monitoring** - следи за размерами бандлов и загрузкой
9. **Versioning strategy** - семантическое версионирование API
10. **Team autonomy** - команды должны быть кросс-функциональными

## Архитектурные решения

### Routing
```javascript
// Single-SPA подход
import { navigateToUrl } from 'single-spa';

function Navigation() {
  return (
    <nav>
      <a href="/dashboard" onClick={navigateToUrl}>Dashboard</a>
    </nav>
  );
}
```

### State sharing
```javascript
// Minimal shared state - только критичные данные
window.globalState = {
  currentUser: null,
  theme: 'light',
  locale: 'en'
};
```

## Performance соображения

- **Bundle duplication** - следи за размерами
- **Loading waterfalls** - оптимизируй порядок загрузки
- **Runtime overhead** - Module Federation добавляет overhead
- **Caching strategy** - версионирование для эффективного кеширования

## Monitoring

```javascript
// Performance tracking
const measureMFLoad = (name) => {
  performance.mark(`${name}-start`);
  return {
    end: () => {
      performance.mark(`${name}-end`);
      performance.measure(`${name}-load`, `${name}-start`, `${name}-end`);
      const measure = performance.getEntriesByName(`${name}-load`)[0];
      console.log(`${name} loaded in ${measure.duration}ms`);
    }
  };
};
```

**Главное**: Микрофронтенды решают организационные проблемы больших команд, а не технические. Не используй их для маленьких проектов!
