import { json } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
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

  const accessOk =
    (userId !== undefined && survey.userId === userId) ||
    (token !== undefined && survey.creatorToken === token);
  if (!accessOk) {
    return json({ error: { code: 'forbidden', message: 'Нет доступа' } }, { status: 403 });
  }

  // Можно retry только если опрос завершён неудачно или застрял в обработке
  const [claimed] = await db
    .update(surveys)
    .set({ status: 'expired' })
    .where(and(eq(surveys.id, survey.id), inArray(surveys.status, ['failed', 'expired'])))
    .returning();

  if (!claimed) {
    return json(
      {
        error: {
          code: 'cannot_retry',
          message: `Нельзя retry для статуса ${survey.status}`,
          status: survey.status
        }
      },
      { status: 409 }
    );
  }

  await processExpired(claimed);

  const [final] = await db
    .select({ status: surveys.status })
    .from(surveys)
    .where(eq(surveys.id, survey.id))
    .limit(1);

  return json({ ok: true, status: final.status });
};
