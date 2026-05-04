import { eq } from 'drizzle-orm';
import { db } from '../db';
import { questions } from '../schema';
import { aggregateQuestion } from '../cloud/aggregate';

const BOM = '﻿';

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return '"' + value.replace(/"/g, '""') + '"';
  return value;
}

export async function buildSurveyCsv(surveyId: string): Promise<string> {
  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.surveyId, surveyId))
    .orderBy(questions.position);

  const rows: string[] = ['question,word,count'];
  for (const q of qs) {
    const top = await aggregateQuestion(q.id, 1000);
    if (top.length === 0) {
      rows.push([csvEscape(q.text), '', '0'].join(','));
      continue;
    }
    for (const [word, count] of top) {
      rows.push([csvEscape(q.text), csvEscape(word), String(count)].join(','));
    }
  }
  return BOM + rows.join('\n');
}
