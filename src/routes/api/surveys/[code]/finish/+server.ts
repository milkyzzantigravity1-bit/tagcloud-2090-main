import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { surveys } from '$lib/server/schema';
import { isValidCode } from '$lib/server/surveys/codes';
import { processExpired } from '$lib/server/expiry/process';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, url, locals }) => {
  const code = params.code!;
  if (!isValidCode(code)) {
    return json({ error: { code: 'invalid_code', message: 'Некорректный код' } }, { status: 400 });
  }

  const token = url.searchParams.get('t') ?? undefined;
  const userId = locals.user?.id;
  if (!userId && !token) {
    return json({ error: { code: 'unauthorized', message: 'Нужен вход или токен' } }, { status: 401 });
  }

  const [survey] = await db.select().from(surveys).where(eq(surveys.code, code)).limit(1);
  if (!survey) {
    return json({ error: { code: 'survey_not_found', message: 'Опрос не найден' } }, { status: 404 });
  }

  // Проверка прав: session-владелец ИЛИ совпадение токена.
  const accessOk =
    (userId !== undefined && survey.userId === userId) ||
    (token !== undefined && survey.creatorToken === token);
  if (!accessOk) {
    return json({ error: { code: 'forbidden', message: 'Нет доступа' } }, { status: 403 });
  }

  // Атомарный переход active → expired. Если кто-то уже забрал — 409.
  const [claimed] = await db
    .update(surveys)
    .set({ status: 'expired', expiresAt: new Date() })
    .where(and(eq(surveys.id, survey.id), eq(surveys.status, 'active')))
    .returning();

  if (!claimed) {
    return json(
      {
        error: {
          code: 'already_finished',
          message: 'Опрос уже завершён',
          status: survey.status
        }
      },
      { status: 409 }
    );
  }

  // Синхронно обрабатываем: aggregate → PNG → CSV → sendMail.
  // processExpired выставит status='sent' или 'failed' и broadcast notifyClosed.
  await processExpired(claimed);

  const [final] = await db
    .select({ status: surveys.status })
    .from(surveys)
    .where(eq(surveys.id, survey.id))
    .limit(1);

  return json({ ok: true, status: final.status });
};
