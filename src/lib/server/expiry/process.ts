import { eq } from 'drizzle-orm';
import { db } from '../db';
import { surveys, questions, type Survey } from '../schema';
import { aggregateQuestion } from '../cloud/aggregate';
import { renderPng } from '../cloud/render-png';
import { buildSurveyCsv } from '../export/csv';
import { sendResultsEmail, type EmailAttachment } from '../email/send';
import { notifyClosed } from '../realtime/broadcast';

export async function processExpired(survey: Survey): Promise<void> {
  console.log(`[expiry] processing survey=${survey.code}`);
  try {
    const qs = await db
      .select()
      .from(questions)
      .where(eq(questions.surveyId, survey.id))
      .orderBy(questions.position);

    const aggregated = await Promise.all(
      qs.map(async (q) => {
        const topWords = await aggregateQuestion(q.id, 100);
        const totalVotes = topWords.reduce((s, [, c]) => s + c, 0);
        return { question: q, topWords, totalVotes };
      })
    );

    const attachments: EmailAttachment[] = [];
    for (let i = 0; i < aggregated.length; i++) {
      const a = aggregated[i];
      const png = await renderPng(a.topWords, survey.colorScheme, survey.customPalette);
      attachments.push({
        filename: `cloud_q${i + 1}.png`,
        content: png,
        contentType: 'image/png'
      });
    }

    const csv = await buildSurveyCsv(survey.id);
    attachments.push({
      filename: `results-${survey.code}.csv`,
      content: Buffer.from(csv, 'utf-8'),
      contentType: 'text/csv; charset=utf-8'
    });

    await sendResultsEmail({
      to: survey.creatorEmail,
      surveyTitle: survey.title ?? `Опрос ${survey.code}`,
      surveyCode: survey.code,
      questions: aggregated.map((a) => ({
        question: { text: a.question.text, answerType: a.question.answerType },
        topWords: a.topWords,
        totalVotes: a.totalVotes
      })),
      attachments
    });

    await db.update(surveys).set({ status: 'sent' }).where(eq(surveys.id, survey.id));
    notifyClosed(survey.code, 'sent');
    console.log(`[expiry] sent survey=${survey.code} to ${survey.creatorEmail}`);
  } catch (err) {
    console.error(`[expiry] failed survey=${survey.code}:`, err instanceof Error ? err.message : err);
    await db.update(surveys).set({ status: 'failed' }).where(eq(surveys.id, survey.id));
    notifyClosed(survey.code, 'expired');
  }
}
