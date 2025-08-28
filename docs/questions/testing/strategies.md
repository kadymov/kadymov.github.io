# Стратегии тестирования frontend-приложений

## Описание
Вопрос касается различных подходов к тестированию frontend-приложений, включая unit, integration и e2e тестирование, а также современные инструменты и best practices для обеспечения качества кода.

## Детальный ответ

### Пирамида тестирования

#### 1. Unit тестирование (основание пирамиды)
Unit тесты проверяют отдельные функции, компоненты или модули в изоляции.

```javascript
// Тестирование утилитных функций
// utils/validation.js
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

// utils/validation.test.js
import { validateEmail, formatCurrency } from './validation';

describe('validateEmail', () => {
  it('should return true for valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
  });

  it('should return false for invalid email', () => {
    expect(validateEmail('invalid-email')).toBe(false);
    expect(validateEmail('test@')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
    expect(validateEmail(123)).toBe(false);
  });
});

describe('formatCurrency', () => {
  it('should format USD currency correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle different currencies', () => {
    expect(formatCurrency(1000, 'EUR')).toBe('€1,000.00');
    expect(formatCurrency(1000, 'GBP')).toBe('£1,000.00');
  });

  it('should handle edge cases', () => {
    expect(formatCurrency(-100)).toBe('-$100.00');
    expect(formatCurrency(0.01)).toBe('$0.01');
  });
});
```

#### 2. Component тестирование (React)
```javascript
// components/UserCard.jsx
import React from 'react';

export function UserCard({ user, onEdit, onDelete, isLoading = false }) {
  if (isLoading) {
    return <div data-testid="loading">Loading...</div>;
  }

  if (!user) {
    return <div data-testid="no-user">No user data</div>;
  }

  return (
    <div data-testid="user-card">
      <h3 data-testid="user-name">{user.name}</h3>
      <p data-testid="user-email">{user.email}</p>
      <div className="actions">
        <button 
          data-testid="edit-button"
          onClick={() => onEdit(user.id)}
        >
          Edit
        </button>
        <button 
          data-testid="delete-button"
          onClick={() => onDelete(user.id)}
          className="danger"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// components/UserCard.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserCard } from './UserCard';

const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com'
};

describe('UserCard', () => {
  it('should render user information correctly', () => {
    render(<UserCard user={mockUser} />);
    
    expect(screen.getByTestId('user-card')).toBeInTheDocument();
    expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
    expect(screen.getByTestId('user-email')).toHaveTextContent('john@example.com');
  });

  it('should show loading state', () => {
    render(<UserCard isLoading={true} />);
    
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('user-card')).not.toBeInTheDocument();
  });

  it('should show no user message when user is null', () => {
    render(<UserCard user={null} />);
    
    expect(screen.getByTestId('no-user')).toBeInTheDocument();
    expect(screen.queryByTestId('user-card')).not.toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = jest.fn();
    render(<UserCard user={mockUser} onEdit={onEdit} />);
    
    fireEvent.click(screen.getByTestId('edit-button'));
    
    expect(onEdit).toHaveBeenCalledWith('1');
  });

  it('should call onDelete when delete button is clicked', () => {
    const onDelete = jest.fn();
    render(<UserCard user={mockUser} onDelete={onDelete} />);
    
    fireEvent.click(screen.getByTestId('delete-button'));
    
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('should have correct CSS classes', () => {
    render(<UserCard user={mockUser} />);
    
    const deleteButton = screen.getByTestId('delete-button');
    expect(deleteButton).toHaveClass('danger');
  });
});
```

#### 3. Custom Hooks тестирование
```javascript
// hooks/useCounter.js
import { useState, useCallback } from 'react';

export function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount(prev => prev - 1);
  }, []);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  const setValue = useCallback((value) => {
    setCount(value);
  }, []);

  return {
    count,
    increment,
    decrement,
    reset,
    setValue
  };
}

// hooks/useCounter.test.js
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useCounter());
    
    expect(result.current.count).toBe(0);
  });

  it('should initialize with custom value', () => {
    const { result } = renderHook(() => useCounter(10));
    
    expect(result.current.count).toBe(10);
  });

  it('should increment count', () => {
    const { result } = renderHook(() => useCounter(5));
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(6);
  });

  it('should decrement count', () => {
    const { result } = renderHook(() => useCounter(5));
    
    act(() => {
      result.current.decrement();
    });
    
    expect(result.current.count).toBe(4);
  });

  it('should reset to initial value', () => {
    const { result } = renderHook(() => useCounter(10));
    
    act(() => {
      result.current.increment();
      result.current.increment();
    });
    
    expect(result.current.count).toBe(12);
    
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.count).toBe(10);
  });

  it('should set specific value', () => {
    const { result } = renderHook(() => useCounter());
    
    act(() => {
      result.current.setValue(100);
    });
    
    expect(result.current.count).toBe(100);
  });
});
```

### Integration тестирование

#### 1. Тестирование взаимодействия компонентов
```javascript
// components/UserList.jsx
import React, { useState, useEffect } from 'react';
import { UserCard } from './UserCard';
import { userService } from '../services/userService';

export function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const userData = await userService.getUsers();
      setUsers(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (userId) => {
    // Навигация к форме редактирования
    window.location.href = `/users/${userId}/edit`;
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure?')) {
      try {
        await userService.deleteUser(userId);
        setUsers(prev => prev.filter(user => user.id !== userId));
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (loading) {
    return <div data-testid="loading">Loading users...</div>;
  }

  if (error) {
    return <div data-testid="error">Error: {error}</div>;
  }

  return (
    <div data-testid="user-list">
      {users.length === 0 ? (
        <div data-testid="empty-state">No users found</div>
      ) : (
        users.map(user => (
          <UserCard
            key={user.id}
            user={user}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  );
}

// components/UserList.test.jsx
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { UserList } from './UserList';
import { userService } from '../services/userService';

// Мокаем сервис
jest.mock('../services/userService');
const mockUserService = userService as jest.Mocked<typeof userService>;

// Мокаем window.confirm и window.location
const mockConfirm = jest.fn();
const mockLocation = { href: '' };

Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true
});

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

const mockUsers = [
  { id: '1', name: 'John Doe', email: 'john@example.com' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
];

describe('UserList Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
  });

  it('should load and display users', async () => {
    mockUserService.getUsers.mockResolvedValue(mockUsers);

    render(<UserList />);

    // Проверяем loading состояние
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Ждем загрузки данных
    await waitFor(() => {
      expect(screen.getByTestId('user-list')).toBeInTheDocument();
    });

    // Проверяем, что пользователи отображаются
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(mockUserService.getUsers).toHaveBeenCalledTimes(1);
  });

  it('should handle loading error', async () => {
    const errorMessage = 'Failed to load users';
    mockUserService.getUsers.mockRejectedValue(new Error(errorMessage));

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
  });

  it('should show empty state when no users', async () => {
    mockUserService.getUsers.mockResolvedValue([]);

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('should handle edit user', async () => {
    mockUserService.getUsers.mockResolvedValue(mockUsers);

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByTestId('user-list')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTestId('edit-button');
    fireEvent.click(editButtons[0]);

    expect(mockLocation.href).toBe('/users/1/edit');
  });

  it('should handle delete user with confirmation', async () => {
    mockUserService.getUsers.mockResolvedValue(mockUsers);
    mockUserService.deleteUser.mockResolvedValue();
    mockConfirm.mockReturnValue(true);

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByTestId('user-list')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTestId('delete-button');
    fireEvent.click(deleteButtons[0]);

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure?');

    await waitFor(() => {
      expect(mockUserService.deleteUser).toHaveBeenCalledWith('1');
    });

    // Проверяем, что пользователь удален из списка
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should not delete user when confirmation is cancelled', async () => {
    mockUserService.getUsers.mockResolvedValue(mockUsers);
    mockConfirm.mockReturnValue(false);

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByTestId('user-list')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTestId('delete-button');
    fireEvent.click(deleteButtons[0]);

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure?');
    expect(mockUserService.deleteUser).not.toHaveBeenCalled();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
```

### Mock и stubbing

#### 1. Мокирование API вызовов
```javascript
// services/apiClient.js
class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async get(endpoint) {
    const response = await fetch(`${this.baseURL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async post(endpoint, data) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
}

// services/userService.js
import { ApiClient } from './apiClient';

const apiClient = new ApiClient('/api');

export const userService = {
  async getUsers() {
    return apiClient.get('/users');
  },

  async getUserById(id) {
    return apiClient.get(`/users/${id}`);
  },

  async createUser(userData) {
    return apiClient.post('/users', userData);
  },

  async updateUser(id, userData) {
    return apiClient.put(`/users/${id}`, userData);
  },

  async deleteUser(id) {
    return apiClient.delete(`/users/${id}`);
  }
};

// services/userService.test.js
import { userService } from './userService';

// Мокаем fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('userService', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('getUsers', () => {
    it('should fetch users successfully', async () => {
      const mockUsers = [
        { id: '1', name: 'John Doe' },
        { id: '2', name: 'Jane Smith' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      } as Response);

      const users = await userService.getUsers();

      expect(mockFetch).toHaveBeenCalledWith('/api/users');
      expect(users).toEqual(mockUsers);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(userService.getUsers()).rejects.toThrow('HTTP error! status: 500');
      expect(mockFetch).toHaveBeenCalledWith('/api/users');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(userService.getUsers()).rejects.toThrow('Network error');
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const newUser = { name: 'John Doe', email: 'john@example.com' };
      const createdUser = { id: '1', ...newUser };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createdUser,
      } as Response);

      const result = await userService.createUser(newUser);

      expect(mockFetch).toHaveBeenCalledWith('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });
      expect(result).toEqual(createdUser);
    });
  });
});
```

#### 2. Мокирование внешних зависимостей
```javascript
// utils/analytics.js
export const analytics = {
  track: (event, properties) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event, properties);
    }
  },

  identify: (userId, traits) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'GA_TRACKING_ID', {
        user_id: userId,
        custom_map: traits
      });
    }
  }
};

// components/AnalyticsButton.jsx
import React from 'react';
import { analytics } from '../utils/analytics';

export function AnalyticsButton({ children, event, properties, onClick }) {
  const handleClick = (e) => {
    analytics.track(event, properties);
    onClick?.(e);
  };

  return (
    <button onClick={handleClick}>
      {children}
    </button>
  );
}

// components/AnalyticsButton.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalyticsButton } from './AnalyticsButton';
import { analytics } from '../utils/analytics';

// Мокаем модуль analytics
jest.mock('../utils/analytics', () => ({
  analytics: {
    track: jest.fn(),
    identify: jest.fn()
  }
}));

const mockAnalytics = analytics as jest.Mocked<typeof analytics>;

describe('AnalyticsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track analytics event on click', () => {
    const mockOnClick = jest.fn();
    const eventName = 'button_clicked';
    const properties = { section: 'header' };

    render(
      <AnalyticsButton
        event={eventName}
        properties={properties}
        onClick={mockOnClick}
      >
        Click me
      </AnalyticsButton>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(mockAnalytics.track).toHaveBeenCalledWith(eventName, properties);
    expect(mockOnClick).toHaveBeenCalled();
  });

  it('should work without onClick handler', () => {
    const eventName = 'button_clicked';

    render(
      <AnalyticsButton event={eventName}>
        Click me
      </AnalyticsButton>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(mockAnalytics.track).toHaveBeenCalledWith(eventName, undefined);
  });
});
```

### E2E тестирование

#### 1. Playwright тесты
```javascript
// tests/e2e/userManagement.spec.js
import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users');
  });

  test('should display user list', async ({ page }) => {
    await expect(page.getByTestId('user-list')).toBeVisible();
    
    // Проверяем, что загружается список пользователей
    await expect(page.locator('[data-testid="user-card"]')).toHaveCount(3);
  });

  test('should create new user', async ({ page }) => {
    // Кликаем на кнопку добавления пользователя
    await page.click('[data-testid="add-user-button"]');
    
    // Заполняем форму
    await page.fill('[data-testid="name-input"]', 'John Doe');
    await page.fill('[data-testid="email-input"]', 'john@example.com');
    
    // Отправляем форму
    await page.click('[data-testid="submit-button"]');
    
    // Проверяем, что пользователь был добавлен
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('john@example.com')).toBeVisible();
    
    // Проверяем успешное уведомление
    await expect(page.getByText('User created successfully')).toBeVisible();
  });

  test('should edit existing user', async ({ page }) => {
    // Кликаем на кнопку редактирования первого пользователя
    await page.click('[data-testid="user-card"]:first-child [data-testid="edit-button"]');
    
    // Ждем загрузки формы редактирования
    await expect(page.getByTestId('edit-user-form')).toBeVisible();
    
    // Изменяем имя
    await page.fill('[data-testid="name-input"]', 'Updated Name');
    
    // Сохраняем изменения
    await page.click('[data-testid="save-button"]');
    
    // Проверяем, что изменения сохранились
    await expect(page.getByText('Updated Name')).toBeVisible();
  });

  test('should delete user with confirmation', async ({ page }) => {
    // Получаем количество пользователей до удаления
    const initialCount = await page.locator('[data-testid="user-card"]').count();
    
    // Кликаем на кнопку удаления
    await page.click('[data-testid="user-card"]:first-child [data-testid="delete-button"]');
    
    // Подтверждаем удаление в диалоге
    page.on('dialog', async dialog => {
      expect(dialog.message()).toBe('Are you sure you want to delete this user?');
      await dialog.accept();
    });
    
    // Проверяем, что пользователь удален
    await expect(page.locator('[data-testid="user-card"]')).toHaveCount(initialCount - 1);
  });

  test('should handle validation errors', async ({ page }) => {
    await page.click('[data-testid="add-user-button"]');
    
    // Пытаемся отправить пустую форму
    await page.click('[data-testid="submit-button"]');
    
    // Проверяем ошибки валидации
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    
    // Вводим невалидный email
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.click('[data-testid="submit-button"]');
    
    await expect(page.getByText('Please enter a valid email')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Отключаем сеть
    await page.route('**/api/users', route => route.abort());
    
    await page.goto('/users');
    
    // Проверяем, что отображается сообщение об ошибке
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByText('Failed to load users')).toBeVisible();
    
    // Проверяем кнопку retry
    await expect(page.getByTestId('retry-button')).toBeVisible();
  });
});
```

#### 2. Cypress тесты
```javascript
// cypress/integration/userFlow.spec.js
describe('User Flow', () => {
  beforeEach(() => {
    cy.visit('/');
    
    // Мокаем API вызовы
    cy.intercept('GET', '/api/users', { fixture: 'users.json' }).as('getUsers');
    cy.intercept('POST', '/api/users', { fixture: 'newUser.json' }).as('createUser');
  });

  it('should complete full user management flow', () => {
    // Переходим на страницу пользователей
    cy.get('[data-testid="users-nav"]').click();
    cy.wait('@getUsers');
    
    // Проверяем загрузку пользователей
    cy.get('[data-testid="user-list"]').should('be.visible');
    cy.get('[data-testid="user-card"]').should('have.length', 3);
    
    // Создаем нового пользователя
    cy.get('[data-testid="add-user-button"]').click();
    cy.get('[data-testid="user-form"]').should('be.visible');
    
    cy.get('[data-testid="name-input"]').type('John Doe');
    cy.get('[data-testid="email-input"]').type('john@example.com');
    cy.get('[data-testid="submit-button"]').click();
    
    cy.wait('@createUser');
    
    // Проверяем успешное создание
    cy.get('[data-testid="success-message"]').should('contain', 'User created');
    
    // Возвращаемся к списку
    cy.get('[data-testid="back-button"]').click();
    cy.get('[data-testid="user-list"]').should('be.visible');
  });

  it('should handle responsive design', () => {
    cy.viewport(375, 667); // Mobile viewport
    
    cy.get('[data-testid="users-nav"]').click();
    cy.wait('@getUsers');
    
    // Проверяем мобильную версию
    cy.get('[data-testid="mobile-menu"]').should('be.visible');
    cy.get('[data-testid="user-card"]').should('have.css', 'flex-direction', 'column');
  });

  it('should handle keyboard navigation', () => {
    cy.get('[data-testid="users-nav"]').click();
    cy.wait('@getUsers');
    
    // Навигация с клавиатуры
    cy.get('body').tab();
    cy.get('[data-testid="add-user-button"]').should('have.focus');
    
    cy.get('body').tab();
    cy.get('[data-testid="user-card"]:first [data-testid="edit-button"]').should('have.focus');
  });
});

// cypress/fixtures/users.json
[
  {
    "id": "1",
    "name": "Alice Johnson",
    "email": "alice@example.com"
  },
  {
    "id": "2", 
    "name": "Bob Smith",
    "email": "bob@example.com"
  },
  {
    "id": "3",
    "name": "Carol Brown",
    "email": "carol@example.com"
  }
]
```

### Visual Regression тестирование

#### 1. Chromatic (Storybook)
```javascript
// .storybook/main.js
module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    'chromatic/storybook'
  ],
};

// src/components/Button.stories.jsx
import React from 'react';
import { Button } from './Button';

export default {
  title: 'Components/Button',
  component: Button,
  parameters: {
    chromatic: { delay: 300 }, // Задержка для анимаций
  },
};

export const Primary = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Loading = {
  args: {
    variant: 'primary',
    loading: true,
    children: 'Loading Button',
  },
};

export const Disabled = {
  args: {
    variant: 'primary',
    disabled: true,
    children: 'Disabled Button',
  },
};

// Тестирование различных размеров
export const AllSizes = () => (
  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
    <Button size="small">Small</Button>
    <Button size="medium">Medium</Button>
    <Button size="large">Large</Button>
  </div>
);
```

#### 2. Percy (Visual Testing)
```javascript
// tests/visual/percy.spec.js
import { test } from '@playwright/test';
import { percySnapshot } from '@percy/playwright';

test.describe('Visual Regression Tests', () => {
  test('should match homepage design', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await percySnapshot(page, 'Homepage');
  });

  test('should match user list design', async ({ page }) => {
    await page.goto('/users');
    await page.waitForSelector('[data-testid="user-list"]');
    
    await percySnapshot(page, 'User List');
  });

  test('should match responsive design', async ({ page }) => {
    await page.goto('/');
    
    // Desktop
    await page.setViewportSize({ width: 1200, height: 800 });
    await percySnapshot(page, 'Homepage - Desktop');
    
    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await percySnapshot(page, 'Homepage - Tablet');
    
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await percySnapshot(page, 'Homepage - Mobile');
  });

  test('should match dark theme', async ({ page }) => {
    await page.goto('/');
    
    // Переключаем на темную тему
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForSelector('body[data-theme="dark"]');
    
    await percySnapshot(page, 'Homepage - Dark Theme');
  });
});
```

### Accessibility тестирование

#### 1. Jest + jest-axe
```javascript
// components/Form.test.jsx
import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { UserForm } from './UserForm';

expect.extend(toHaveNoViolations);

describe('UserForm Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(
      <UserForm onSubmit={() => {}} />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper form labels', () => {
    const { getByLabelText } = render(
      <UserForm onSubmit={() => {}} />
    );
    
    expect(getByLabelText('Name')).toBeInTheDocument();
    expect(getByLabelText('Email')).toBeInTheDocument();
  });

  it('should show validation errors with proper ARIA attributes', async () => {
    const { getByRole, findByRole } = render(
      <UserForm onSubmit={() => {}} />
    );
    
    const submitButton = getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);
    
    const nameInput = getByRole('textbox', { name: /name/i });
    const errorMessage = await findByRole('alert');
    
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby');
    expect(errorMessage).toBeInTheDocument();
  });
});
```

#### 2. Playwright + axe-playwright
```javascript
// tests/a11y/accessibility.spec.js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('should not have accessibility violations on homepage', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
      
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/users');
    
    // Табуляция по интерактивным элементам
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="add-user-button"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="user-card"]:first-child [data-testid="edit-button"]')).toBeFocused();
    
    // Enter должен активировать кнопку
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="user-form"]')).toBeVisible();
  });

  test('should work with screen reader', async ({ page }) => {
    await page.goto('/users');
    
    // Проверяем aria-labels и role attributes
    const userList = page.locator('[data-testid="user-list"]');
    await expect(userList).toHaveAttribute('role', 'list');
    
    const userCards = page.locator('[data-testid="user-card"]');
    await expect(userCards.first()).toHaveAttribute('role', 'listitem');
  });
});
```

### Performance тестирование

#### 1. Lighthouse CI
```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000', 'http://localhost:3000/users'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

#### 2. Bundle Size тестирование
```javascript
// tests/bundle-size.test.js
import { getPackageSize } from 'package-size';

describe('Bundle Size', () => {
  it('should keep main bundle under size limit', async () => {
    const size = await getPackageSize('dist/main.js');
    expect(size.gzipped).toBeLessThan(250 * 1024); // 250KB
  });

  it('should keep vendor bundle under size limit', async () => {
    const size = await getPackageSize('dist/vendor.js');
    expect(size.gzipped).toBeLessThan(500 * 1024); // 500KB
  });
});
```

### Test Utils и Helpers

#### 1. Custom Render для React
```javascript
// test-utils/render.jsx
import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from 'styled-components';
import { defaultTheme } from '../src/theme';

function render(
  ui,
  {
    initialEntries = ['/'],
    theme = defaultTheme,
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            {children}
          </ThemeProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

// Экспортируем все из RTL
export * from '@testing-library/react';
// Переопределяем render
export { render };
```

#### 2. Mock Factories
```javascript
// test-utils/factories.js
import { faker } from '@faker-js/faker';

export const createMockUser = (overrides = {}) => ({
  id: faker.datatype.uuid(),
  name: faker.name.fullName(),
  email: faker.internet.email(),
  avatar: faker.image.avatar(),
  createdAt: faker.date.past(),
  ...overrides,
});

export const createMockPost = (overrides = {}) => ({
  id: faker.datatype.uuid(),
  title: faker.lorem.sentence(),
  content: faker.lorem.paragraphs(3),
  authorId: faker.datatype.uuid(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

export const createMockUsers = (count = 3) => 
  Array.from({ length: count }, () => createMockUser());

// Использование в тестах
import { createMockUser, createMockUsers } from '../test-utils/factories';

describe('UserList', () => {
  it('should render multiple users', () => {
    const users = createMockUsers(5);
    render(<UserList users={users} />);
    
    expect(screen.getAllByTestId('user-card')).toHaveLength(5);
  });
});
```

### Test Configuration

#### 1. Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test-utils/**',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
};

// src/test-utils/setup.js
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Увеличиваем timeout для медленных тестов
configure({ testIdAttribute: 'data-testid' });

// Мокаем matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Мокаем IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
```

## Best Practices

1. **Пирамида тестирования**: 70% unit, 20% integration, 10% e2e
2. **Test-first approach**: Пишите тесты до или вместе с кодом
3. **Один assert на тест**: Фокусируйтесь на одном аспекте
4. **Дескриптивные названия**: Тест должен читаться как спецификация
5. **Изоляция тестов**: Каждый тест должен быть независимым
6. **Тестируйте поведение, не реализацию**: Фокус на пользовательский опыт
7. **Используйте data-testid**: Для стабильных селекторов
8. **Мокайте внешние зависимости**: API, localStorage, timers

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Build application
        run: npm run build
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Связанные темы
- [Performance Optimization](../performance/optimization.md) - Тестирование производительности
- [TypeScript](../typescript/advanced-types.md) - Типизация тестов
- [State Management](../architecture/state-management.md) - Тестирование состояния

## Рекомендации для собеседования

**Senior-level ожидания**:
- Глубокое понимание стратегий тестирования
- Опыт с различными инструментами (Jest, RTL, Playwright, Cypress)
- Знание best practices и anti-patterns
- Понимание TDD/BDD подходов
- Опыт с визуальным и accessibility тестированием

**Частые вопросы**:
- Разница между unit, integration и e2e тестами
- Как тестировать async код и хуки?
- Что такое test doubles (mock, stub, spy)?
- Как организовать тесты в большом проекте?
- Как тестировать пользовательские взаимодействия?
