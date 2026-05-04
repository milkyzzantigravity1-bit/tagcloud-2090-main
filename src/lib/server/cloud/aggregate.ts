import { sql, eq } from 'drizzle-orm';
import { db } from '../db';
import { responses } from '../schema';
import type { CloudWord } from '$lib/types/cloud';

export async function aggregateQuestion(
  questionId: string,
  topN: number = 100
): Promise<CloudWord[]> {
  // Группируем по нормализованной форме, выбираем первое исходное написание
  const rows = await db
    .select({
      word: responses.word,
      wordNorm: responses.wordNorm,
      count: sql<number>`count(*)::int`
    })
    .from(responses)
    .where(eq(responses.questionId, questionId))
    .groupBy(responses.word, responses.wordNorm)
    .orderBy(sql`count(*) desc`)
    .limit(topN * 5);

  const merged = new Map<string, { word: string; count: number }>();
  for (const r of rows) {
    const existing = merged.get(r.wordNorm);
    if (!existing) {
      merged.set(r.wordNorm, { word: r.word, count: r.count });
    } else {
      existing.count += r.count;
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map((m) => [m.word, m.count] as CloudWord);
}
