# Стратегии тестирования Frontend (small)

## Пирамида тестирования

```
     E2E (10%)
  Integration (20%)
   Unit Tests (70%)
```

**Senior Focus**: Баланс между скоростью выполнения, стабильностью и покрытием багов.

## Unit тестирование

### Утилитные функции
```javascript
// utils/validation.test.js
describe('validateEmail', () => {
  it('validates emails correctly', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail(null)).toBe(false);
  });
});
```

### React Component Testing
```javascript
// UserCard.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';

describe('UserCard', () => {
  const mockUser = { id: '1', name: 'John', email: 'john@example.com' };
  
  it('renders user data and handles interactions', () => {
    const onEdit = jest.fn();
    render(<UserCard user={mockUser} onEdit={onEdit} />);
    
    expect(screen.getByText('John')).toBeInTheDocument();
    
    fireEvent.click(screen.getByTestId('edit-button'));
    expect(onEdit).toHaveBeenCalledWith('1');
  });

  it('shows loading state', () => {
    render(<UserCard isLoading />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});
```

### Custom Hooks Testing
```javascript
import { renderHook, act } from '@testing-library/react';

describe('useCounter', () => {
  it('manages counter state', () => {
    const { result } = renderHook(() => useCounter(5));
    
    expect(result.current.count).toBe(5);
    
    act(() => result.current.increment());
    expect(result.current.count).toBe(6);
    
    act(() => result.current.reset());
    expect(result.current.count).toBe(5);
  });
});
```

## Integration тестирование

```javascript
// UserList.test.jsx - тестирование взаимодействия компонентов
import { userService } from '../services/userService';

jest.mock('../services/userService');
const mockUserService = userService as jest.Mocked<typeof userService>;

describe('UserList Integration', () => {
  it('loads and manages users', async () => {
    mockUserService.getUsers.mockResolvedValue([mockUser]);
    mockUserService.deleteUser.mockResolvedValue();
    window.confirm = jest.fn().mockReturnValue(true);

    render(<UserList />);

    // Проверяем загрузку
    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    // Тестируем удаление
    fireEvent.click(screen.getByTestId('delete-button'));
    
    await waitFor(() => {
      expect(mockUserService.deleteUser).toHaveBeenCalledWith('1');
      expect(screen.queryByText('John')).not.toBeInTheDocument();
    });
  });
});
```

## Mocking стратегии

### API Mocking
```javascript
// Мок всего модуля
jest.mock('../services/userService', () => ({
  userService: {
    getUsers: jest.fn(),
    createUser: jest.fn(),
    deleteUser: jest.fn()
  }
}));

// Мок fetch
global.fetch = jest.fn();

describe('API Service', () => {
  beforeEach(() => {
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  it('handles API calls', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockUser]
    });

    const users = await userService.getUsers();
    expect(fetch).toHaveBeenCalledWith('/api/users');
    expect(users).toEqual([mockUser]);
  });
});
```

### Dependency Injection для тестирования
```javascript
// Testable service
class UserService {
  constructor(private apiClient: ApiClient) {}
  
  async getUsers() {
    return this.apiClient.get('/users');
  }
}

// Test с mock dependency
describe('UserService', () => {
  it('fetches users via API client', async () => {
    const mockApiClient = { get: jest.fn().mockResolvedValue([mockUser]) };
    const userService = new UserService(mockApiClient);
    
    const users = await userService.getUsers();
    
    expect(mockApiClient.get).toHaveBeenCalledWith('/users');
    expect(users).toEqual([mockUser]);
  });
});
```

## E2E тестирование

### Playwright
```javascript
import { test, expect } from '@playwright/test';

test.describe('User Management E2E', () => {
  test('complete user flow', async ({ page }) => {
    await page.goto('/users');
    
    // Create user
    await page.click('[data-testid="add-user"]');
    await page.fill('[data-testid="name-input"]', 'John Doe');
    await page.click('[data-testid="submit"]');
    
    // Verify creation
    await expect(page.getByText('John Doe')).toBeVisible();
    
    // Delete user with confirmation
    await page.click('[data-testid="delete-button"]');
    page.on('dialog', dialog => dialog.accept());
    
    await expect(page.getByText('John Doe')).toBeHidden();
  });

  test('handles errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/users', route => route.abort());
    
    await page.goto('/users');
    await expect(page.getByTestId('error-message')).toBeVisible();
  });
});
```

### Cypress
```javascript
describe('User Flow', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/users', { fixture: 'users.json' }).as('getUsers');
  });

  it('manages users end-to-end', () => {
    cy.visit('/users');
    cy.wait('@getUsers');
    
    cy.get('[data-testid="user-card"]').should('have.length', 3);
    
    // Test responsive behavior
    cy.viewport(375, 667);
    cy.get('[data-testid="mobile-menu"]').should('be.visible');
  });
});
```

## Advanced Testing Patterns

### Visual Regression Testing
```javascript
// Storybook + Chromatic
export default {
  title: 'Components/Button',
  component: Button,
  parameters: {
    chromatic: { 
      delay: 300,
      viewports: [375, 768, 1200] 
    }
  }
};

// Percy with Playwright
import { percySnapshot } from '@percy/playwright';

test('visual regression', async ({ page }) => {
  await page.goto('/dashboard');
  await percySnapshot(page, 'Dashboard - Desktop');
  
  await page.setViewportSize({ width: 375, height: 667 });
  await percySnapshot(page, 'Dashboard - Mobile');
});
```

### Accessibility Testing
```javascript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('meets WCAG standards', async () => {
    const { container } = render(<UserForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// Playwright + axe
import AxeBuilder from '@axe-core/playwright';

test('accessibility compliance', async ({ page }) => {
  await page.goto('/');
  
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
    
  expect(results.violations).toEqual([]);
});
```

### Performance Testing
```javascript
// Lighthouse CI
module.exports = {
  ci: {
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }]
      }
    }
  }
};

// Bundle size testing
describe('Bundle Size', () => {
  it('keeps bundles under limits', async () => {
    const mainSize = await getPackageSize('dist/main.js');
    expect(mainSize.gzipped).toBeLessThan(250 * 1024);
  });
});
```

## Test Utilities & Helpers

### Custom Render Wrapper
```javascript
// test-utils/render.jsx
function render(ui, { theme = defaultTheme, ...options } = {}) {
  function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={testQueryClient}>
          <ThemeProvider theme={theme}>
            {children}
          </ThemeProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );
  }
  
  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react';
export { render };
```

### Test Factories
```javascript
// test-utils/factories.js
export const createUser = (overrides = {}) => ({
  id: faker.datatype.uuid(),
  name: faker.name.fullName(),
  email: faker.internet.email(),
  ...overrides
});

export const createUsers = (count = 3, overrides = {}) =>
  Array.from({ length: count }, () => createUser(overrides));
```

### Mock Service Worker (MSW)
```javascript
// mocks/handlers.js
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json([createUser(), createUser()]));
  }),
  
  rest.post('/api/users', (req, res, ctx) => {
    return res(ctx.json(createUser(req.body)));
  })
];

// Test setup
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Configuration

### Jest Setup
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|scss)$': 'identity-obj-proxy'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.{stories,test,spec}.{js,jsx,ts,tsx}'
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 }
  }
};

// src/test-setup.js
import '@testing-library/jest-dom';

// Mock globals
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
});
```

## Senior Testing Strategies

### Test Organization
```
src/
├── components/
│   ├── Button/
│   │   ├── Button.jsx
│   │   ├── Button.test.jsx
│   │   ├── Button.stories.jsx
│   │   └── index.js
│   └── __tests__/
│       └── integration/
├── hooks/
│   ├── useAuth.js
│   └── useAuth.test.js
├── utils/
│   ├── validation.js
│   └── validation.test.js
└── __tests__/
    ├── e2e/
    ├── integration/
    └── setup/
```

### Test Doubles Strategy
```javascript
// Mock - полная замена
const mockUserService = {
  getUsers: jest.fn().mockResolvedValue([]),
  createUser: jest.fn()
};

// Stub - предустановленные ответы
const stubApiClient = {
  get: jest.fn()
    .mockResolvedValueOnce([user1])
    .mockRejectedValueOnce(new Error('API Error'))
};

// Spy - отслеживание вызовов реального объекта
const userServiceSpy = jest.spyOn(userService, 'getUsers');
```

### Error Testing Patterns
```javascript
describe('Error Handling', () => {
  it('handles network failures', async () => {
    mockApiClient.get.mockRejectedValue(new Error('Network Error'));
    
    render(<UserList />);
    
    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });
  });

  it('handles validation errors', async () => {
    render(<UserForm />);
    
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
  });
});
```

### Async Testing Best Practices
```javascript
// ✅ Good - explicit waiting
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// ✅ Good - findBy queries (built-in waiting)
expect(await screen.findByText('Loaded')).toBeInTheDocument();

// ❌ Bad - implicit waiting
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 1000));
});
```

## CI/CD Integration

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16, 18, 20]
        
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          
      - name: Install & Test
        run: |
          npm ci
          npm run lint
          npm run test:unit -- --coverage
          npm run test:integration
          npm run build
          npm run test:e2e
          
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        
  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: chromaui/action@v1
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
```

## Best Practices Senior-level

**Test Strategy**:
- Unit: Fast feedback, edge cases, complex logic
- Integration: Component interactions, data flow
- E2E: Critical user journeys, cross-browser compatibility

**Test Structure (AAA Pattern)**:
```javascript
describe('feature', () => {
  it('should behave correctly when condition', () => {
    // Arrange
    const mockData = createTestData();
    
    // Act
    const result = performAction(mockData);
    
    // Assert
    expect(result).toMatchExpectedOutcome();
  });
});
```

**Anti-patterns to avoid**:
- Testing implementation details
- Brittle selectors (CSS classes instead of semantic queries)
- Shared test state between tests
- Over-mocking (testing mocks instead of behavior)
- Insufficient error scenario coverage

## Частые Senior вопросы

- **Как тестировать асинхронные операции и race conditions?**
- **Стратегии тестирования в микрофронтенд архитектуре?**
- **Оптимизация времени выполнения тест-сьюта?**
- **Тестирование accessibility и internationalization?**
- **Contract testing для API интеграций?**
- **Flaky tests - причины и решения?**
- **Test-driven development vs Behavior-driven development?**
- **Property-based testing для frontend приложений?**

## Метрики качества тестирования

- **Coverage**: Lines, Functions, Branches, Statements (80%+ target)
- **Mutation Testing**: Качество тестов (убивание мутантов)
- **Test Pyramid Balance**: Соотношение типов тестов
- **Execution Time**: Unit (<10s), Integration (<2min), E2E (<10min)
- **Flakiness Rate**: <1% нестабильных тестов
- **Defect Escape Rate**: Баги, пропущенные тестами
