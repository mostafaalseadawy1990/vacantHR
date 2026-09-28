// Shared helpers for the ordered CMS lists (testimonials, faqs, pricing, guide sections).

/** Moves an item one step up/down by swapping `position` with its neighbour, then renumbers 1..n. */
export async function moveItem(supabase: any, table: string, id: string, dir: 'up' | 'down') {
  const { data } = await supabase.from(table).select('id').order('position').order('created_at');
  const ids: string[] = (data ?? []).map((r: any) => r.id);
  const i = ids.indexOf(id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((rid, idx) => supabase.from(table).update({ position: idx + 1 }).eq('id', rid)));
}

/** Toggles the `published` flag. */
export async function togglePublished(supabase: any, table: string, id: string) {
  const { data } = await supabase.from(table).select('published').eq('id', id).maybeSingle();
  if (!data) return;
  await supabase.from(table).update({ published: !data.published }).eq('id', id);
}

/** Handles the shared list actions (move / toggle / delete). Returns true when it handled one. */
export async function handleListAction(supabase: any, table: string, form: FormData): Promise<boolean> {
  const action = String(form.get('_action') || '');
  const id = String(form.get('id') || '');
  if (!id) return false;
  if (action === 'move_up') { await moveItem(supabase, table, id, 'up'); return true; }
  if (action === 'move_down') { await moveItem(supabase, table, id, 'down'); return true; }
  if (action === 'toggle') { await togglePublished(supabase, table, id); return true; }
  if (action === 'delete') { await supabase.from(table).delete().eq('id', id); return true; }
  return false;
}
