import type { CloudWord } from '$lib/types/cloud';

export type AggregatedQuestion = {
  question: { text: string; answerType: 'single' | 'multi' };
  topWords: CloudWord[];
  totalVotes: number;
};

export type ResultsTemplateInput = {
  surveyTitle: string;
  surveyCode: string;
  questions: AggregatedQuestion[];
};

const NAVY = '#0E2A5C';
const MUTED = '#6B7280';
const SURFACE = '#F7F8FA';
const TEXT = '#1A1A1A';
const BORDER = '#E5E7EB';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function resultsHtml(opts: ResultsTemplateInput): string {
  const items = opts.questions
    .map((q, i) => {
      const tags = q.topWords
        .slice(0, 10)
        .map(
          ([word, count]) =>
            `<li style="display:inline-block;background:${SURFACE};padding:4px 12px;margin:2px;border-radius:4px;font-size:14px;">${escapeHtml(word)} <span style="color:${MUTED};">×${count}</span></li>`
        )
        .join('');
      return `
        <tr><td style="padding:16px 0;border-top:1px solid ${BORDER};">
          <div style="color:${MUTED};font-size:13px;">Вопрос ${i + 1}${q.question.answerType === 'multi' ? ' (несколько слов)' : ''}</div>
          <div style="font-size:16px;color:${TEXT};margin:4px 0 12px;font-weight:500;">${escapeHtml(q.question.text)}</div>
          <div style="color:${MUTED};font-size:13px;margin-bottom:8px;">Голосов: ${q.totalVotes} · топ-10:</div>
          <ul style="list-style:none;padding:0;margin:0;">${tags || '<li style="color:' + MUTED + ';">— нет ответов</li>'}</ul>
          <div style="margin-top:12px;color:${MUTED};font-size:13px;">См. вложение <strong>cloud_q${i + 1}.png</strong></div>
        </td></tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"></head>
<body style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;color:${TEXT};background:#FFFFFF;margin:0;padding:24px;">
  <table width="100%" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
    <tr><td>
      <div style="border-bottom:3px solid ${NAVY};padding:16px 0;">
        <div style="font-weight:600;color:${NAVY};font-size:13px;letter-spacing:0.05em;">ОБЛАКО ТЕГОВ · ШКОЛА №2090</div>
        <h1 style="font-size:22px;margin:8px 0 0;color:${NAVY};font-weight:600;">${escapeHtml(opts.surveyTitle)}</h1>
        <div style="color:${MUTED};font-size:13px;margin-top:4px;">Код опроса: <code style="font-family:monospace;">${opts.surveyCode}</code></div>
      </div>
      <p style="margin:24px 0 8px;">Опрос завершён. Результаты ниже, полные данные — в прикреплённом файле <strong>results-${opts.surveyCode}.csv</strong>.</p>
      <table width="100%" style="border-collapse:collapse;">${items}</table>
      <p style="color:${MUTED};font-size:12px;margin-top:32px;border-top:1px solid ${BORDER};padding-top:16px;">Это автоматическое сообщение от сервиса опросов ГБОУ Школа №2090.</p>
    </td></tr>
  </table>
</body></html>`;
}

export function resultsText(opts: ResultsTemplateInput): string {
  const lines: string[] = [`Результаты опроса: ${opts.surveyTitle}`, `Код: ${opts.surveyCode}`, ''];
  opts.questions.forEach((q, i) => {
    lines.push(`Вопрос ${i + 1}: ${q.question.text}`);
    lines.push(`  Голосов: ${q.totalVotes}`);
    if (q.topWords.length === 0) {
      lines.push('  — нет ответов');
    } else {
      q.topWords.slice(0, 10).forEach(([w, c]) => lines.push(`  ${w}: ${c}`));
    }
    lines.push('');
  });
  lines.push(`Полные результаты — в прикреплённом results-${opts.surveyCode}.csv.`);
  return lines.join('\n');
}
