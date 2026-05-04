# Модуль `surveys`

Создание, чтение и хранение опросов. Генерация уникального 6-символьного кода и токена создателя.

## Папка

`src/lib/server/surveys/`

## Файлы

- `codes.ts` — генератор кода (alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, 6 символов, проверка коллизий)
- `validation.ts` — zod-схемы для входных данных
- `create.ts` — транзакционное создание (survey + questions[])
- `get.ts` — чтение survey по коду (публичное и приватное представление)

## Публичный интерфейс

```ts
// codes.ts
export function generateCode(): string;                 // 6 символов
export async function generateUniqueCode(): Promise<string>;  // с retry на коллизии (макс 5 попыток)

// create.ts
export type CreateSurveyInput = {
  title?: string;
  creatorEmail: string;
  caseSensitive: boolean;
  colorScheme: 'mono' | 'random' | 'custom';
  customPalette?: string[];      // hex-цвета, обязательно если colorScheme==='custom'
  expiresAt: Date;
  questions: Array<{ text: string; answerType: 'single' | 'multi' }>;
};

export type CreateSurveyResult = {
  id: string;
  code: string;
  creatorToken: string;          // UUID, передаётся в URL дашборда
  expiresAt: Date;
};

export async function createSurvey(input: CreateSurveyInput): Promise<CreateSurveyResult>;

// get.ts
export type SurveyPublic = {
  code: string;
  title: string | null;
  expiresAt: Date;
  status: 'active' | 'expired' | 'sent' | 'failed';
  questions: Array<{ id: string; text: string; answerType: 'single' | 'multi'; position: number }>;
};

export type SurveyForCreator = SurveyPublic & {
  creatorEmail: string;
  caseSensitive: boolean;
  colorScheme: 'mono' | 'random' | 'custom';
  customPalette: string[] | null;
  createdAt: Date;
};

export async function getSurveyPublic(code: string): Promise<SurveyPublic | null>;
export async function getSurveyForCreator(code: string, token: string): Promise<SurveyForCreator | null>;
```

## Зависимости

- `db` (drizzle), `qr` (для возврата QR из API endpoint, не из самого модуля)

## Зод-схемы (validation.ts)

- `text` ≤ 500 символов
- `creatorEmail` валидный email
- `expiresAt` ≥ `now() + 1h`, ≤ `now() + 30d`
- `questions.length` 1..50
- `customPalette`: 1..10 строк, каждая matches `^#[0-9A-Fa-f]{6}$`. Обязательна если `colorScheme === 'custom'`.
- `caseSensitive`: boolean

## Изменения в БД

Этап 2 добавляет миграцию 0001:

```sql
ALTER TABLE surveys ADD COLUMN creator_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX surveys_creator_token_idx ON surveys (creator_token);
```

В `schema.ts` — `creatorToken: uuid('creator_token').notNull().defaultRandom().unique()`.

## Готчи

- Код генерируется БЕЗ символов `0/O/1/I/l` — иначе пользователи их путают, диктуя код голосом.
- При коллизии `code` (UNIQUE constraint) — повторить генерацию (до 5 раз). После — 500.
- `creator_token` НЕЛЬЗЯ возвращать в публичных эндпоинтах. Хранится у создателя в URL дашборда.
- Создание survey + questions — в одной транзакции (`db.transaction(async (tx) => ...)`). Иначе при падении посередине останется опрос без вопросов.
- `expiresAt` приходит как ISO-строка от клиента — парсить через `z.coerce.date()`, сразу проверять диапазон.
- НЕ возвращать `id` survey в публичных API — только `code`. `id` — внутренний.
