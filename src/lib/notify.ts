/**
 * Admin notifications: fan out to every configured channel and never throw.
 *  - Email via Resend (RESEND_API_KEY + EMAIL_FROM) → sent to the contact email in settings
 *  - Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID) → instant push on the phone
 * Both are read from Cloudflare env vars (runtime) or import.meta.env locally.
 */
import { sendEmail, emailLayout } from './email';
import { getSettings } from './settings';

type Ctx = { locals?: any };

export function notifyEnv(ctx?: Ctx) {
  const env = ctx?.locals?.runtime?.env ?? {};
  return {
    resend: !!(env.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY),
    tgToken: env.TELEGRAM_BOT_TOKEN ?? import.meta.env.TELEGRAM_BOT_TOKEN,
    tgChat: env.TELEGRAM_CHAT_ID ?? import.meta.env.TELEGRAM_CHAT_ID,
  };
}

const escTg = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

export async function sendTelegram(ctx: Ctx | undefined, text: string, url?: string): Promise<boolean> {
  const { tgToken, tgChat } = notifyEnv(ctx);
  if (!tgToken || !tgChat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgChat, text, parse_mode: 'HTML', disable_web_page_preview: true,
        ...(url ? { reply_markup: { inline_keyboard: [[{ text: 'فتح في لوحة الإدارة', url }]] } } : {}),
      }),
    });
    return res.ok;
  } catch { return false; }
}

/** Notifies the team about a new event (contact message, application, client request…). */
export async function notifyAdmins(ctx: Ctx | undefined, n: { title: string; lines: string[]; url: string; replyTo?: string }): Promise<void> {
  const settings = await getSettings().catch(() => null);
  const to = settings?.contact_email;
  const tgText = `<b>${escTg(n.title)}</b>\n${n.lines.map(escTg).join('\n')}`;
  await Promise.all([
    sendTelegram(ctx, tgText, n.url),
    to ? sendEmail(ctx, {
      to, subject: n.title, replyTo: n.replyTo,
      html: emailLayout(n.title, n.lines.map((l) => `<p style="margin:0 0 6px">${l.replace(/</g, '&lt;')}</p>`).join(''), { text: 'فتح في لوحة الإدارة', url: n.url }),
    }) : Promise.resolve(),
  ]);
}
