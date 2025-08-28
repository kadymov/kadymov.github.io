# SSR/SSG & React Server Components - Senior Cheat Sheet

## Основные подходы

### SSR (Server-Side Rendering)
- **Что**: Рендеринг React на сервере, отправка готового HTML
- **Плюсы**: Быстрый FCP, лучшее SEO, работа на медленных устройствах
- **Минусы**: Нагрузка на сервер, проблемы гидратации, медленный TTI

```jsx
// Next.js SSR
export async function getServerSideProps(context) {
  const data = await fetchUserData(context.params.id);
  return { props: { user: data } };
}

export default function UserPage({ user }) {
  return <div>{user.name}</div>;
}
```

### SSG (Static Site Generation)
- **Что**: Генерация статического HTML во время сборки
- **Плюсы**: Максимальная производительность, CDN, отличное SEO
- **Минусы**: Не для динамического контента, время сборки

```jsx
// Next.js SSG + ISR
export async function getStaticProps() {
  const posts = await fetchPosts();
  return {
    props: { posts },
    revalidate: 60 // ISR - регенерация каждые 60 сек
  };
}

export async function getStaticPaths() {
  const posts = await fetchPosts();
  return {
    paths: posts.map(p => ({ params: { id: p.id } })),
    fallback: 'blocking'
  };
}
```

### RSC (React Server Components)
- **Что**: Компоненты выполняются ТОЛЬКО на сервере
- **Плюсы**: Прямой доступ к DB, меньший бандл, async/await из коробки
- **Минусы**: Новая парадигма, сложность

```jsx
// Server Component (по умолчанию в Next.js App Router)
async function BlogPost({ id }) {
  const post = await db.posts.findById(id); // Прямой доступ к DB
  const comments = await db.comments.findByPostId(id);
  
  return (
    <article>
      <h1>{post.title}</h1>
      <CommentSection comments={comments} /> {/* Client Component */}
    </article>
  );
}

// Client Component
'use client';
function CommentSection({ comments }) {
  const [newComment, setNewComment] = useState('');
  // Интерактивность только здесь
}
```

## Сравнение

| | SSR | SSG | RSC |
|---|-----|-----|-----|
| **Performance** | Средняя | Высокая | Высокая |
| **SEO** | ✅ | ✅ | ✅ |
| **Dynamic Content** | ✅ | ❌ (ISR) | ✅ |
| **Bundle Size** | Большой | Большой | **Меньше** |
| **DB Access** | Ограниченный | Ограниченный | **Прямой** |
| **Complexity** | Средняя | Низкая | Высокая |

## Проблемы гидратации

### Mismatch проблема
```jsx
// ❌ Проблема - разные данные сервер/клиент
function Component() {
  const [time, setTime] = useState(Date.now()); // Разное время на сервере и клиенте
  return <div>{time}</div>;
}

// ✅ Решение - useEffect или динамическая загрузка
import dynamic from 'next/dynamic';

const ClientOnlyComponent = dynamic(
  () => import('./ClientComponent'),
  { ssr: false }
);

// Или с useEffect
function TimeComponent() {
  const [time, setTime] = useState(null);
  
  useEffect(() => {
    setTime(Date.now());
  }, []);
  
  return <div>{time || 'Loading...'}</div>;
}
```

### Selective Hydration (React 18)
```jsx
// Автоматическая селективная гидратация с Suspense
function App() {
  return (
    <div>
      <Header /> {/* Гидратируется сразу */}
      
      <Suspense fallback={<Skeleton />}>
        <HeavyComponent /> {/* Гидратируется когда нужно */}
      </Suspense>
    </div>
  );
}
```

## Next.js App Router (RSC)

### Структура
```
app/
  layout.js      // Root layout (Server Component)
  page.js        // Home page (Server Component)
  posts/
    page.js      // Posts page (Server Component)
    [id]/
      page.js    // Dynamic route (Server Component)
```

### Server Actions
```jsx
// Server Action
async function createPost(formData) {
  'use server';
  
  const title = formData.get('title');
  await db.posts.create({ title });
  revalidatePath('/posts');
}

// Использование в Server Component
export default function CreatePost() {
  return (
    <form action={createPost}>
      <input name="title" />
      <button type="submit">Create</button>
    </form>
  );
}
```

### Data Fetching patterns
```jsx
// Параллельные запросы
async function Page() {
  const postsPromise = fetchPosts();
  const usersPromise = fetchUsers();
  
  const [posts, users] = await Promise.all([postsPromise, usersPromise]);
  
  return (
    <div>
      <PostList posts={posts} />
      <UserList users={users} />
    </div>
  );
}

// Потоковая загрузка
export default async function Page() {
  return (
    <div>
      <Suspense fallback={<PostsSkeleton />}>
        <Posts />
      </Suspense>
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments />
      </Suspense>
    </div>
  );
}
```

## Performance оптимизация

### Streaming SSR
```jsx
// Потоковая отправка HTML частями
import { renderToReadableStream } from 'react-dom/server';

const stream = await renderToReadableStream(<App />, {
  onError(error) {
    console.error(error);
  }
});
```

### Bundle optimization
```jsx
// Разделение Server/Client кода
// server-utils.js (только на сервере)
export function connectDB() { ... }

// Client Component с минимальным JS
'use client';
export function InteractiveButton() {
  return <button onClick={() => alert('clicked')}>Click</button>;
}
```

## Best Practices

### 1. Правильное разделение Server/Client
```jsx
// ✅ Server Component для данных
async function ProductPage({ id }) {
  const product = await fetchProduct(id);
  
  return (
    <div>
      <h1>{product.name}</h1>
      <AddToCartButton product={product} /> {/* Client для интерактивности */}
    </div>
  );
}

// ✅ Client Component для интерактивности
'use client';
function AddToCartButton({ product }) {
  const [loading, setLoading] = useState(false);
  // Логика добавления в корзину
}
```

### 2. Избегание waterfall запросов
```jsx
// ❌ Waterfall
async function BlogPost({ id }) {
  const post = await fetchPost(id);
  const author = await fetchAuthor(post.authorId); // Ждет первый запрос
  
  return <div>...</div>;
}

// ✅ Параллельные запросы
async function BlogPost({ id }) {
  const [post, author] = await Promise.all([
    fetchPost(id),
    fetchAuthor(id) // Если знаем authorId заранее
  ]);
}
```

### 3. Кеширование
```jsx
// Next.js встроенное кеширование запросов
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 } // Кеш на 1 час
  });
  return res.json();
}
```

## Senior Rules

1. **SSG > SSR > Client** - для производительности
2. **RSC для data-heavy логики** - прямой доступ к DB
3. **Client Components минимально** - только для интерактивности
4. **Избегай waterfall** - используй Promise.all
5. **Suspense boundaries** - для потоковой загрузки
6. **Server Actions** для мутаций без API routes
7. **Кеширование на всех уровнях** - CDN, fetch cache, React cache
8. **Мониторь Core Web Vitals** - особенно FCP, LCP, CLS

## Когда что использовать

- **SSG** - блоги, landing pages, документация
- **SSR** - e-commerce, dashboards, персонализированный контент
- **RSC** - приложения с тяжелой серверной логикой
- **Client-only** - админки, SPA с аутентификацией

**Главное**: Начинай с сервера, добавляй клиент только где нужна интерактивность!
