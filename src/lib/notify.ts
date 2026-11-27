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

/** Chat id from the env var, or the one saved from the admin settings page. */
export async function telegramChatId(ctx?: Ctx): Promise<string> {
  const { tgChat } = notifyEnv(ctx);
  if (tgChat) return String(tgChat);
  const s = await getSettings().catch(() => null);
  return String(s?.telegram_chat_id ?? '').trim();
}

/** Lists the chats that messaged the bot recently (so the admin can pick one without touching the API). */
export async function discoverTelegramChats(ctx?: Ctx): Promise<Array<{ id: string; name: string }>> {
  const { tgToken } = notifyEnv(ctx);
  if (!tgToken) return [];
  try {
    const res = await fetch(`https://api.telegram.org/bot${tgToken}/getUpdates?limit=100`);
    const j: any = await res.json();
    const out = new Map<string, string>();
    for (const u of j?.result ?? []) {
      const chat = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
      if (!chat) continue;
      const name = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id);
      out.set(String(chat.id), name);
    }
    return [...out].map(([id, name]) => ({ id, name }));
  } catch { return []; }
}

export async function sendTelegram(ctx: Ctx | undefined, text: string, url?: string): Promise<boolean> {
  const { tgToken } = notifyEnv(ctx);
  const tgChat = tgToken ? await telegramChatId(ctx) : '';
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
