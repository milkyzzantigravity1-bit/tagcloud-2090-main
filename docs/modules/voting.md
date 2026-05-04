# Модуль `voting`

Приём голосов от анонимных респондентов: rate-limit, валидация, нормализация, батч-INSERT.

## Папка

`src/lib/server/voting/`

## Файлы

- `validation.ts` — zod-схема входа
- `rate-limit.ts` — Redis-лимиты по хэшу IP
- `validate.ts` — бизнес-валидация (длина слова, тип ответа, статус опроса)
- `submit.ts` — батч-очередь и flush в Postgres

## Публичный интерфейс

```ts
// rate-limit.ts
export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export async function checkRateLimit(ip: string, code: string): Promise<RateLimitResult>;
export async function markVoted(ip: string, code: string, ttlSec: number): Promise<void>;
export async function hasVoted(ip: string, code: string): Promise<boolean>;

// validate.ts
export type ValidationError =
  | { code: 'survey_not_found' }
  | { code: 'survey_expired' }
  | { code: 'question_not_found' }
  | { code: 'word_too_long'; max: number }
  | { code: 'too_many_words'; max: number }
  | { code: 'whitespace_in_single' };

export type ValidationResult =
  | { ok: true; normalized: string[] }                 // нормализованные слова
  | { ok: false; error: ValidationError };

export async function validateAnswer(
  code: string,
  questionId: string,
  words: string[]
): Promise<ValidationResult>;

// submit.ts
export async function submitAnswer(
  questionId: string,
  rawWords: string[],
  normalizedWords: string[]
): Promise<void>;   // кладёт в очередь, не ждёт INSERT
```

## Зависимости

- `db` (для bulk insert и чтения метаданных), `redis` (rate-limit, voted, cloud-counter)
- `surveys` (читает survey/question — но через прямой SQL с JOIN, не через `surveys/get.ts` — экономим на запросах)

## Endpoint

POST `/api/surveys/:code/answer`

Тело:
```json
{
  "questionId": "uuid",
  "words": ["слово", "ещё одно"]
}
```

Ответ:
- 200 `{ ok: true }`
- 400 `{ error: { code: 'whitespace_in_single', message: 'Ответ должен быть одним словом' } }`
- 404 `{ error: { code: 'survey_not_found', ... } }`
- 410 `{ error: { code: 'survey_expired', ... } }`
- 429 `{ error: { code: 'rate_limit', retryAfterSec: 30 } }`
- 409 `{ error: { code: 'already_voted' } }`

## Rate-limit

Соль ротируется ежедневно — храним в Redis ключе `salt:<YYYYMMDD>`, TTL 48h. Если ключ отсутствует — генерируется (через `crypto.randomBytes(32).toString('hex')`).

```ts
const todaySalt = await getOrCreateSalt(new Date());
const ipHash = sha256(ip + todaySalt);

// rate-limit (60 sec window, max 30 запросов)
const key = `rl:${ipHash}`;
const cnt = await redis.incr(key);
if (cnt === 1) await redis.expire(key, 60);
if (cnt > 30) return { allowed: false, retryAfterSec: await redis.ttl(key) };
```

`hasVoted`/`markVoted` — отдельный ключ `voted:${ipHash}:${code}` с TTL до `expiresAt`.

## Батчинг (submit.ts)

In-memory буфер `Array<{questionId, word, wordNorm}>`. Flush триггеры:
- по таймеру каждые 200 мс
- по достижении 100 элементов

Flush — один `INSERT INTO responses (question_id, word, word_norm) VALUES ...` через `db.insert(responses).values(buf)`.

Параллельно с INSERT — `redis.zincrby(\`cloud:${questionId}\`, 1, wordNorm)` (не ждём).

## Получение IP

```ts
const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
  ?? request.headers.get('x-real-ip')
  ?? '0.0.0.0';
```

В dev — Vite отдаёт реальный IP в `request.headers.get('x-forwarded-for')` через адаптер.

## Готчи

- Hash IP **не сохраняется** в Postgres. Только Redis с TTL.
- При `answerType === 'single'` нужно дополнительно проверять `words.length === 1` (не только отсутствие пробела).
- `words` после `.trim()` — пустые строки выкидывать.
- Если буфер не успел flushнуться при выключении сервера — допускается потеря последних 200 мс голосов (приемлемо).
- НЕ использовать `for word of words: db.insert(...)` — это N запросов вместо 1 batch.
- Для `answerType === 'multi'` — каждое слово создаёт отдельную запись `responses`. Один POST → N inserts.
- Для `caseSensitive=false` нормализация — `String.prototype.toLocaleLowerCase('ru-RU')` (важно для турецкой `i`-проблемы; для русского эффект небольшой, но привычка).
