// Shared Arabic labels + date formatters (one place instead of a copy per page).

export const APP_STATUS_AR: Record<string, string> = {
  submitted: 'تحت المراجعة', reviewing: 'قيد الفحص', shortlisted: 'قائمة مختصرة', rejected: 'مرفوض', hired: 'تم التعيين',
};
/** Candidate-facing wording (softer "rejected"). */
export const APP_STATUS_PUBLIC_AR: Record<string, string> = { ...APP_STATUS_AR, rejected: 'غير مناسب حاليًا' };
export const APP_STATUSES: Array<[string, string]> = Object.entries(APP_STATUS_AR);

export const REQ_STATUS_AR: Record<string, string> = {
  new: 'جديد', in_progress: 'شغّالين عليه', candidates_sent: 'أرسلنا مرشحين', closed: 'مغلق',
};
export const REQ_STATUSES: Array<[string, string]> = Object.entries(REQ_STATUS_AR);

export const MODE_AR: Record<string, string> = { online: 'أونلاين', onsite: 'في المقر', phone: 'هاتفيًا' };
export const INTERVIEW_STATUS_AR: Record<string, string> = { proposed: 'مقترحة', confirmed: 'مؤكدة', completed: 'تمت', cancelled: 'ملغاة' };
export const DECISION_AR: Record<string, string> = { pending: 'بانتظار قرارك', approved: 'وافقت', rejected: 'رفضت' };
export const JOB_STATUS_AR: Record<string, string> = { draft: 'مسودة', open: 'مفتوحة', closed: 'مغلقة' };

const AR = 'ar-EG';
export const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString(AR, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
export const fmtShort = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString(AR, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
export const fmtDay = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString(AR, { month: 'short', day: 'numeric' }) : '—';
export const fmtDT = (s: string | null | undefined) => s ? new Date(s).toLocaleString(AR, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const fmtFull = (s: string | null | undefined) => s ? new Date(s).toLocaleString(AR, { dateStyle: 'full', timeStyle: 'short' }) : '—';
