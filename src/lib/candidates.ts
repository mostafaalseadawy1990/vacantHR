// Candidate profile enrichment: field definitions shared by the admin views, the portal and CSV export.

export const AVAILABILITY_AR: Record<string, string> = {
  immediate: 'متاح فورًا',
  '2weeks': 'خلال أسبوعين',
  '1month': 'خلال شهر',
  '2months': 'خلال شهرين أو أكثر',
  not_looking: 'مش بيدوّر حاليًا',
};

export const SOURCE_AR: Record<string, string> = {
  website: 'الموقع', linkedin: 'LinkedIn', facebook: 'Facebook', referral: 'ترشيح', headhunt: 'بحث مباشر', other: 'أخرى',
};

export type CandidateProfile = {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  headline: string | null; city: string | null; years_experience: number | null; education: string | null;
  current_company: string | null; expected_salary: number | null; availability: string | null;
  linkedin_url: string | null; portfolio_url: string | null; birth_year: number | null; bio: string | null;
  cv_path: string | null; skills: string[] | null; tags: string[] | null; admin_notes: string | null; source: string | null;
  created_at: string; updated_at?: string;
};

/** Reads the candidate-editable fields from a form (portal + admin share this). */
export function readCandidateFields(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const n = (k: string) => { const v = parseInt(s(k), 10); return Number.isFinite(v) ? v : null; };
  const url = (k: string) => { const v = s(k); if (!v) return null; return /^https?:\/\//i.test(v) ? v : `https://${v}`; };
  return {
    headline: s('headline') || null,
    city: s('city') || null,
    years_experience: n('years_experience'),
    education: s('education') || null,
    current_company: s('current_company') || null,
    expected_salary: n('expected_salary'),
    availability: AVAILABILITY_AR[s('availability')] ? s('availability') : null,
    linkedin_url: url('linkedin_url'),
    portfolio_url: url('portfolio_url'),
    birth_year: n('birth_year'),
    bio: s('bio').slice(0, 1500) || null,
    skills: s('skills').split(/[,،]/).map((x) => x.trim()).filter(Boolean),
  };
}

/** 0–100 profile completeness, with the missing items (Arabic labels) so the UI can nudge. */
export function completeness(p: Partial<CandidateProfile>): { pct: number; missing: string[] } {
  const checks: Array<[boolean, string]> = [
    [!!p.full_name, 'الاسم'],
    [!!p.phone, 'رقم الهاتف'],
    [!!p.headline, 'المسمى المهني'],
    [!!p.city, 'المدينة'],
    [p.years_experience != null, 'سنوات الخبرة'],
    [!!p.education, 'المؤهل'],
    [!!(p.skills && p.skills.length >= 3), '٣ مهارات على الأقل'],
    [!!p.availability, 'الجاهزية للعمل'],
    [!!p.cv_path, 'السيرة الذاتية'],
    [!!p.bio, 'نبذة عنك'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([ok]) => !ok).map(([, l]) => l) };
}

export const waLink = (phone?: string | null) => {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '').replace(/^0/, '20');
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
};
