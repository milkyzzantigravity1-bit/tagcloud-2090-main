# Модули `expiry`, `email`, `export`

Объединены в один документ — тесно связаны. Реализуются вместе на этапе 5.

## Папки

- `src/lib/server/expiry/`
- `src/lib/server/email/`
- `src/lib/server/export/`

## Cron (expiry)

`expiry/cron.ts` — `node-cron`-задача каждую минуту:

```ts
import cron from 'node-cron';
cron.schedule('* * * * *', async () => {
  const expired = await db
    .select()
    .from(surveys)
    .where(and(eq(surveys.status, 'active'), lt(surveys.expiresAt, new Date())))
    .limit(20);    // не больше 20 за тик, чтоб не положить SMTP
  for (const s of expired) await processExpired(s);
});
```

Запускается из `hooks.server.ts` один раз при старте процесса.

`expiry/process.ts` — обработка одного опроса:

```ts
export async function processExpired(survey: Survey): Promise<void> {
  // 1. agg для каждого вопроса
  const questions = await db.select().from(questionsTable).where(eq(questionsTable.surveyId, survey.id));
  const aggregated = await Promise.all(
    questions.map(async (q) => ({
      question: q,
      words: await aggregateQuestion(q.id, 100)
    }))
  );

  // 2. PNG per question
  const pngs = await Promise.all(
    aggregated.map(async ({ question, words }) => ({
      filename: \`cloud_\${slugify(question.text)}.png\`,
      content: await renderPng(words, survey.colorScheme, survey.customPalette)
    }))
  );

  // 3. CSV
  const csv = buildCsv(aggregated);

  // 4. send mail
  try {
    await sendResultsEmail(survey, aggregated, pngs, csv);
    await db.update(surveys).set({ status: 'sent' }).where(eq(surveys.id, survey.id));
  } catch (err) {
    console.error('[expiry]', survey.code, err);
    await db.update(surveys).set({ status: 'failed' }).where(eq(surveys.id, survey.id));
  }

  // 5. broadcast 'closed' через realtime (если кто-то ещё на дашборде)
  notifyRoomClosed(survey.code, 'sent');
}
```

Retry: отдельная cron-задача каждый час перебирает `status='failed'`, считает попытки в Redis-счётчике `retry:<id>`, при ≥ 3 — оставляет в `failed` навсегда.

## Email (Yandex SMTP)

`email/smtp.ts`:

```ts
import { createTransport } from 'nodemailer';
import { env } from '$env/dynamic/private';

export const transporter = createTransport({
  host: env.SMTP_HOST,           // smtp.yandex.ru
  port: Number(env.SMTP_PORT),   // 465
  secure: env.SMTP_SECURE === 'true',
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD      // app-password, НЕ основной
  }
});

export async function verifySmtp(): Promise<boolean> {
  try { await transporter.verify(); return true; } catch { return false; }
}
```

`email/templates.ts`:

```ts
export function resultsHtml(opts: {
  surveyTitle: string;
  surveyCode: string;
  questions: Array<{ text: string; topWords: Array<[string, number]> }>;
}): string;

export function resultsText(opts: ...): string;
```

HTML-шаблон — компактный, c фирменным `--c-navy` хедером (inline CSS, не классы — почтовые клиенты их режут).

`email/send.ts`:

```ts
export async function sendResultsEmail(survey, aggregated, pngs, csv) {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: survey.creatorEmail,
    subject: \`Результаты опроса "\${survey.title || survey.code}"\`,
    html: resultsHtml({ ... }),
    text: resultsText({ ... }),
    attachments: [
      ...pngs.map(p => ({ filename: p.filename, content: p.content })),
      { filename: 'results.csv', content: csv }
    ]
  });
}
```

## CSV (export)

`export/csv.ts`:

```ts
const BOM = '﻿';
export function buildCsv(aggregated: Array<{question: Question, words: CloudWord[]}>): string {
  const rows = ['question,word,count'];
  for (const { question, words } of aggregated) {
    for (const [word, count] of words) {
      rows.push([
        csvEscape(question.text),
        csvEscape(word),
        String(count)
      ].join(','));
    }
  }
  return BOM + rows.join('\n');
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
```

Endpoint `GET /api/surveys/:code/export.csv?t=<creatorToken>`:
- Проверка токена
- Aggregate по всем вопросам
- Возврат с заголовком `Content-Type: text/csv; charset=utf-8` + `Content-Disposition: attachment; filename="results-<code>.csv"`

## Зависимости

- `db`, `cloud` (aggregate + render-png), `realtime` (notifyRoomClosed)
- npm: `node-cron`, `nodemailer`

## Env-переменные (.env)

```
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your@yandex.ru
SMTP_PASSWORD=app-password-here
SMTP_FROM="Облако тегов 2090 <your@yandex.ru>"
```

App-password создаётся в [настройках Яндекс ID](https://id.yandex.ru/security/app-passwords) → пароли приложений.

## Готчи

- Yandex SMTP лимит ~500 писем/сутки. Для нашего сценария — хватит (1 опрос = 1 письмо). Логировать счётчик в Redis `mail:counter:YYYYMMDD` для мониторинга.
- `From` ДОЛЖЕН совпадать с авторизованным ящиком или быть его алиасом — иначе Yandex отдаст 553.
- HTML письмо — inline-стили только. Никаких `<link>` или `<style>` (Gmail режет).
- Аттач PNG — НЕ кодировать в base64 в html. Прикреплять отдельно.
- CSV — с BOM (`﻿` в начале), иначе Excel на Windows откроет кракозябры.
- `cron.schedule` запускается от `hooks.server.ts` — его нужно защитить от двойного запуска при HMR в dev (флаг `__cronStarted` на `globalThis`).
- При фатальной ошибке БД во время `processExpired` — НЕ переводить в `sent`, оставить `active` и ретраить.
- В dev обычно SMTP-кредов нет — `verifySmtp()` падает в `false`. Cron всё равно стартует, но при первом письме ловит ошибку и переводит в `failed`. Это норма.
