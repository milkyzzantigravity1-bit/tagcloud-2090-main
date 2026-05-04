import { env } from '$env/dynamic/private';
import { getTransporter } from './smtp';
import { resultsHtml, resultsText, type AggregatedQuestion } from './templates';

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendResultsInput = {
  to: string;
  surveyTitle: string;
  surveyCode: string;
  questions: AggregatedQuestion[];
  attachments: EmailAttachment[];
};

export async function sendResultsEmail(input: SendResultsInput): Promise<void> {
  const t = getTransporter();
  if (!t) throw new Error('SMTP не настроен (SMTP_HOST/USER/PASSWORD пусты)');

  const fromAddr = env.SMTP_FROM ?? env.SMTP_USER!;
  await t.sendMail({
    from: fromAddr,
    to: input.to,
    subject: `Результаты опроса "${input.surveyTitle}"`,
    text: resultsText(input),
    html: resultsHtml(input),
    attachments: input.attachments
  });
}
