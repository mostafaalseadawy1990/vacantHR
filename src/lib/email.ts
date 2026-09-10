/**
 * Best-effort transactional email via Resend.
 * No-ops (with a console warning) when RESEND_API_KEY is missing, so the app
 * works before email is configured. Never throws.
 */
type Ctx = { locals?: any };

function readEnv(ctx?: Ctx) {
  const runtimeEnv = ctx?.locals?.runtime?.env ?? {};
  return {
    key: runtimeEnv.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY,
    from: runtimeEnv.EMAIL_FROM ?? import.meta.env.EMAIL_FROM ?? 'Vacant HR <noreply@vacanthr.com>',
  };
}

export function emailLayout(heading: string, bodyHtml: string, cta?: { text: string; url: string }): string {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#F5F7F8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#0F172A;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border:1px solid #E7EAEE;border-radius:14px;padding:28px;">
      <div style="font-weight:700;font-size:18px;color:#0E7C66;margin-bottom:16px;">Vacant HR</div>
      <h1 style="font-size:20px;margin:0 0 12px;">${heading}</h1>
      <div style="font-size:15px;line-height:1.9;color:#334155;">${bodyHtml}</div>
      ${cta ? `<p style="margin-top:22px;"><a href="${cta.url}" style="background:#0E7C66;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block;font-weight:600;">${cta.text}</a></p>` : ''}
    </div>
    <p style="color:#64748B;font-size:12px;text-align:center;margin-top:16px;">vacanthr.com</p>
  </div></body></html>`;
}

export async function sendEmail(
  ctx: Ctx | undefined,
  opts: { to: string | string[]; subject: string; html: string; replyTo?: string },
): Promise<void> {
  const { key, from } = readEnv(ctx);
  const to = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(Boolean);
  if (!key || to.length === 0) {
    console.warn('[email] skipped (no RESEND_API_KEY or no recipient):', opts.subject);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: opts.subject, html: opts.html, reply_to: opts.replyTo }),
    });
    if (!res.ok) console.warn('[email] resend error', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.warn('[email] fetch failed', e);
  }
}
