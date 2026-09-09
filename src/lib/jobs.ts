export type Job = {
  id: string;
  slug: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'temporary';
  workplace: 'onsite' | 'hybrid' | 'remote';
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_visible: boolean;
  description_md: string;
  requirements_md: string;
  status: 'draft' | 'open' | 'closed';
  published_at: string | null;
  created_at: string;
};

export const EMPLOYMENT_TYPE_AR: Record<Job['employment_type'], string> = {
  full_time: 'دوام كامل',
  part_time: 'دوام جزئي',
  contract: 'عقد مؤقت',
  temporary: 'مشروعي',
};

export const WORKPLACE_AR: Record<Job['workplace'], string> = {
  onsite: 'من المقر',
  hybrid: 'هجين',
  remote: 'عن بُعد',
};

export function salaryLabel(job: Job): string | null {
  if (!job.salary_visible) return null;
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)}–${fmt(job.salary_max)} ${job.salary_currency}`;
  if (job.salary_min) return `من ${fmt(job.salary_min)} ${job.salary_currency}`;
  if (job.salary_max) return `حتى ${fmt(job.salary_max)} ${job.salary_currency}`;
  return null;
}

/** Minimal, safe Markdown → HTML for job descriptions (headings, lists, bold, paragraphs). */
export function renderMarkdown(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = (md ?? '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length + 1; // h2..h4
      html += `<h${level}>${inline(esc(h[2]))}</h${level}>`;
      continue;
    }

    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(esc(li[1]))}</li>`;
      continue;
    }

    closeList();
    html += `<p>${inline(esc(line))}</p>`;
  }
  closeList();
  return html;

  function inline(s: string) {
    return s
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
}
