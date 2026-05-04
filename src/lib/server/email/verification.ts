import { env } from '$env/dynamic/private';
import { getTransporter } from './smtp';

const NAVY = '#0E2A5C';
const MUTED = '#6B7280';
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

export type VerificationEmailInput = {
  to: string;
  verifyUrl: string;
  ttlHours: number;
};

export function verificationHtml(input: VerificationEmailInput): string {
  const url = escapeHtml(input.verifyUrl);
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"></head>
<body style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;color:${TEXT};background:#FFFFFF;margin:0;padding:24px;">
  <table width="100%" style="max-width:560px;margin:0 auto;border-collapse:collapse;">
    <tr><td>
      <div style="border-bottom:3px solid ${NAVY};padding:16px 0;">
        <div style="font-weight:600;color:${NAVY};font-size:13px;letter-spacing:0.05em;">ОБЛАКО ТЕГОВ · ШКОЛА №2090</div>
        <h1 style="font-size:22px;margin:8px 0 0;color:${NAVY};font-weight:600;">Подтвердите email</h1>
      </div>
      <p style="margin:24px 0 16px;">Чтобы завершить регистрацию, перейдите по ссылке ниже:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${url}" style="display:inline-block;background:${NAVY};color:#FFFFFF;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;">Подтвердить email</a>
      </p>
      <p style="color:${MUTED};font-size:14px;margin:16px 0;">Если кнопка не работает, скопируйте адрес в браузер:</p>
      <p style="word-break:break-all;font-family:monospace;font-size:13px;color:${TEXT};background:#F7F8FA;padding:12px;border-radius:4px;">${url}</p>
      <p style="color:${MUTED};font-size:13px;margin:24px 0 0;border-top:1px solid ${BORDER};padding-top:16px;">
        Срок действия ссылки — ${input.ttlHours} часов. Если вы не регистрировались — просто проигнорируйте письмо.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

export function verificationText(input: VerificationEmailInput): string {
  return [
    'Подтвердите email',
    '',
    'Чтобы завершить регистрацию, перейдите по ссылке:',
    input.verifyUrl,
    '',
    `Срок действия ссылки — ${input.ttlHours} часов.`,
    'Если вы не регистрировались — проигнорируйте письмо.'
  ].join('\n');
}

export async function sendVerificationEmail(input: VerificationEmailInput): Promise<void> {
  const t = getTransporter();
  if (!t) throw new Error('SMTP не настроен (SMTP_HOST/USER/PASSWORD пусты)');

  const fromAddr = env.SMTP_FROM ?? env.SMTP_USER!;
  await t.sendMail({
    from: fromAddr,
    to: input.to,
    subject: 'Подтвердите email — Облако тегов',
    text: verificationText(input),
    html: verificationHtml(input)
  });
}
