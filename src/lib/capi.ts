/**
 * Meta Conversions API (server-side events).
 * Mirrors the browser pixel events (Lead / SubmitApplication / CompleteRegistration) from the
 * server so conversions are counted even when the pixel is blocked or consent is declined.
 * Deduplicated with the pixel through a shared event_id.
 *  - META_PIXEL_ID + META_CAPI_TOKEN (Cloudflare env vars or import.meta.env locally)
 *  - META_TEST_EVENT_CODE (optional, shows events under "Test events" in Events Manager)
 * Never throws.
 */
type Ctx = { locals?: any; request?: Request };

export function capiEnv(ctx?: Ctx) {
  const env = ctx?.locals?.runtime?.env ?? {};
  return {
    pixelId: env.META_PIXEL_ID ?? import.meta.env.META_PIXEL_ID ?? '',
    token: env.META_CAPI_TOKEN ?? import.meta.env.META_CAPI_TOKEN ?? '',
    testCode: env.META_TEST_EVENT_CODE ?? import.meta.env.META_TEST_EVENT_CODE ?? '',
  };
}

export const newEventId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function sha256(v: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Normalises per Meta's rules (lowercase, trimmed; phone digits only with country code). */
export function normalizeUser(u: { email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null }) {
  const email = (u.email ?? '').trim().toLowerCase();
  let phone = (u.phone ?? '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  else if (phone.startsWith('0') && phone.length === 11) phone = '2' + phone; // Egyptian local → E.164 digits
  const firstName = (u.firstName ?? '').trim().toLowerCase();
  const lastName = (u.lastName ?? '').trim().toLowerCase();
  return { email, phone, firstName, lastName };
}

export function splitName(full?: string | null) {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

function cookie(req: Request | undefined, name: string): string | undefined {
  const raw = req?.headers.get('cookie') ?? '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export type CapiEvent = {
  name: 'Lead' | 'SubmitApplication' | 'CompleteRegistration' | 'Contact' | 'ViewContent';
  eventId: string;
  user?: { email?: string | null; phone?: string | null; fullName?: string | null; externalId?: string | null };
  params?: Record<string, unknown>;
  sourceUrl?: string;
};

export async function sendCapiEvent(ctx: Ctx | undefined, ev: CapiEvent): Promise<boolean> {
  const { pixelId, token, testCode } = capiEnv(ctx);
  if (!pixelId || !token) return false;
  const req = ctx?.request;
  try {
    const { email, phone, firstName, lastName } = normalizeUser({ ...ev.user, ...splitName(ev.user?.fullName) });
    const user_data: Record<string, unknown> = {
      client_ip_address: req?.headers.get('cf-connecting-ip') ?? req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      client_user_agent: req?.headers.get('user-agent') ?? undefined,
      fbp: cookie(req, '_fbp'),
      fbc: cookie(req, '_fbc'),
    };
    if (email) user_data.em = [await sha256(email)];
    if (phone) user_data.ph = [await sha256(phone)];
    if (firstName) user_data.fn = [await sha256(firstName)];
    if (lastName) user_data.ln = [await sha256(lastName)];
    if (ev.user?.externalId) user_data.external_id = [await sha256(ev.user.externalId)];
    for (const k of Object.keys(user_data)) if (user_data[k] === undefined) delete user_data[k];

    const body: Record<string, unknown> = {
      data: [{
        event_name: ev.name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: ev.eventId,
        action_source: 'website',
        event_source_url: ev.sourceUrl ?? req?.url,
        user_data,
        ...(ev.params ? { custom_data: ev.params } : {}),
      }],
      ...(testCode ? { test_event_code: testCode } : {}),
    };
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) console.warn('[capi] rejected', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (e) {
    console.warn('[capi] failed', e);
    return false;
  }
}
