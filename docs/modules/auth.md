# Модуль `auth`

Регистрация, вход, сессии создателя опросов. Респонденты остаются полностью анонимными (не участвуют в auth).

## Папка

`src/lib/server/auth/`

## Файлы

- `hash.ts` — bcrypt-обёртка (11 rounds)
- `sessions.ts` — createSession / getSessionUser / deleteSession + COOKIE_NAME
- `validation.ts` — zod-схема CredentialsSchema (email + пароль 8-72 симв)
- `service.ts` — register / login с бизнес-логикой (включая «claim» существующих опросов)

## Публичный интерфейс

```ts
// hash.ts
export async function hashPassword(plain: string): Promise<string>;
export async function verifyPassword(plain: string, hash: string): Promise<boolean>;

// sessions.ts
export const COOKIE_NAME = 'tagcloud_session';
export const SESSION_TTL_DAYS = 30;
export type AuthUser = { id: string; email: string };

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }>;
export async function getSessionUser(sessionId: string | undefined | null): Promise<AuthUser | null>;
export async function deleteSession(sessionId: string): Promise<void>;
export async function purgeExpiredSessions(): Promise<void>;

// validation.ts
export const CredentialsSchema: z.ZodSchema<{ email: string; password: string }>;

// service.ts
export type AuthResult =
  | { ok: true; user: AuthUser; sessionId: string; expiresAt: Date; claimedExisting: boolean }
  | { ok: false; code: 'email_taken' | 'invalid_credentials'; message: string };

export async function register(creds: Credentials): Promise<AuthResult>;
export async function login(creds: Credentials): Promise<AuthResult>;
```

## БД (миграция 0002)

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text,                              -- NULLABLE для backfill
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,                             -- crypto.randomBytes(32).base64url
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

ALTER TABLE surveys ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX surveys_user_idx ON surveys(user_id, created_at);
```

## Backfill (в той же миграции)

```sql
INSERT INTO users (email, password_hash)
SELECT DISTINCT lower(creator_email), NULL FROM surveys
ON CONFLICT (email) DO NOTHING;

UPDATE surveys SET user_id = u.id
FROM users u WHERE lower(surveys.creator_email) = u.email AND surveys.user_id IS NULL;
```

После: каждый существующий опрос привязан к user. password_hash=NULL означает «email известен, но никто не зарегистрировался».

## Claim — особенность register

При POST /api/auth/register с `email`:
1. Если `user` уже есть И `password_hash IS NULL` → UPDATE `password_hash` ← `bcrypt(plain)`. **Это значит: ты «забрал» все опросы, ранее созданные с этим email.** В ответе `claimedExisting: true`.
2. Если `user` уже есть И `password_hash IS NOT NULL` → 409 `email_taken`.
3. Если `user` не существует → INSERT new.

## Сессии

- Cookie `tagcloud_session` httpOnly + sameSite=lax + secure (только в prod)
- ID сессии — `crypto.randomBytes(32).toString('base64url')` (43 символа base64url, ~256 бит энтропии)
- TTL — 30 дней, продлевается при login (новая сессия)
- Хранение — таблица `sessions` (НЕ в Redis: переживёт рестарт Redis, важно для UX «не разлогинило за ночь»)

## Endpoints

| Метод | Путь | Тело | Ответы |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password}` | 201 `{user, claimedExisting}` + Set-Cookie / 400 invalid_input / 409 email_taken |
| POST | `/api/auth/login` | `{email, password}` | 200 `{user}` + Set-Cookie / 400 / 401 invalid_credentials |
| POST | `/api/auth/logout` | — | 200 `{ok:true}` + Clear-Cookie |

## hooks.server.ts

```ts
export const handle: Handle = async ({ event, resolve }) => {
  const sid = event.cookies.get(COOKIE_NAME);
  event.locals.user = await getSessionUser(sid);
  return resolve(event);
};
```

После handle любой `+page.server.ts` или `+server.ts` может прочитать `event.locals.user`.

## Защита роутов

В `+page.server.ts`:
```ts
export const load = async ({ locals, url }) => {
  if (!locals.user) redirect(303, `/login?next=${url.pathname}`);
  // ...
};
```

В `+server.ts`:
```ts
if (!locals.user) return json({ error: { code: 'unauthorized' } }, { status: 401 });
```

## Бэккомпат для /s/[code]

Старые URL дашборда были `/s/CODE?t=<creator_token>` (без аккаунта). После этапа 6 поддерживаются оба способа:
- session (locals.user.id === survey.user_id) — новый, основной
- `?t=<token>` (survey.creator_token) — для старых ссылок

Логика в `getSurveyForCreator(code, { userId, token })` — пускает если хотя бы одно совпало.

## Готчи

- **Bcrypt rounds = 11.** Хеш ~100ms на современном CPU. Меньше — небезопасно, больше — DoS-вектор.
- **Bcrypt лимит — 72 байта.** Длинные пароли silently обрезаются — поэтому `z.string().max(72)` в валидации.
- **password_hash NULLABLE** — это нужно ТОЛЬКО для миграционного backfill. У "живых" users всегда есть hash. Если кто-то не активирован — он не может залогиниться (сразу 401).
- **Не возвращай password_hash в API** никогда. Сервис возвращает только `{id, email}`.
- **Не дай регистрироваться с email, который занят.** Полагаешься на UNIQUE constraint в БД + явная проверка.
- **Очистка expired sessions** — отдельный cron-job (можно добавить к существующему expiry-cron). На MVP не критично — таблица растёт медленно.
- **Восстановление пароля** — НЕ реализовано на этапе 6. Для production нужно: запрос → токен → email с magic-link → форма нового пароля. Зависит от рабочего SMTP.
- **Sessions vs JWT.** Выбраны sessions: проще logout (DELETE row), нет утечки секрета (нет HMAC-ключа), нет complications с refresh.
