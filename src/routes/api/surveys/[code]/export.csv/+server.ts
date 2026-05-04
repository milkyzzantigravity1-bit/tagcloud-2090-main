import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { surveys } from '$lib/server/schema';
import { isValidCode } from '$lib/server/surveys/codes';
import { buildSurveyCsv } from '$lib/server/export/csv';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const code = params.code!;
  const token = url.searchParams.get('t');
  if (!isValidCode(code)) error(400, 'Некорректный код');
  if (!token) error(401, 'Нужен токен создателя');

  const [survey] = await db.select().from(surveys).where(eq(surveys.code, code)).limit(1);
  if (!survey) error(404, 'Опрос не найден');
  if (survey.creatorToken !== token) error(403, 'Неверный токен');

  const csv = await buildSurveyCsv(survey.id);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="results-${survey.code}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
};
