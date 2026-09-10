/** Best-effort activity log. Never throws. */
export async function logAction(
  ctx: { locals?: any },
  supabase: any,
  action: string,
  target?: string,
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      actor_id: ctx.locals?.user?.id ?? null,
      actor_name: ctx.locals?.profile?.full_name ?? ctx.locals?.user?.email ?? null,
      action: String(action).slice(0, 80),
      target: target ? String(target).slice(0, 200) : null,
    });
  } catch { /* audit is best-effort */ }
}
