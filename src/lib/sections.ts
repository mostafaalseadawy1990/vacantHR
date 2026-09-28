// Editable page sections for the service pages (recruitment / hrm-saas / consulting / about).
import { anonClient } from './supabase';

export type SectionKind = 'hero' | 'feature' | 'steps' | 'rich' | 'cta' | 'stats' | 'pricing';
export type Section = {
  id: string; page: string; kind: SectionKind; eyebrow: string | null; title: string | null; body_html: string;
  image_path: string | null; reverse: boolean; cta_label: string | null; cta_href: string | null;
  cta2_label: string | null; cta2_href: string | null; items: Array<{ title: string; body: string }>;
  position: number; published: boolean;
};

export const SITE_PAGES: Array<{ key: string; label: string; href: string }> = [
  { key: 'recruitment', label: 'التوظيف', href: '/recruitment' },
  { key: 'hrm-saas', label: 'برنامج HRM', href: '/hrm-saas' },
  { key: 'consulting', label: 'الاستشارات', href: '/consulting' },
  { key: 'about', label: 'من نحن', href: '/about' },
];

export const KIND_AR: Record<SectionKind, string> = {
  hero: 'هيرو (عنوان الصفحة)', feature: 'ميزة (نص + صورة)', steps: 'خطوات مرقّمة', rich: 'نص حر',
  cta: 'دعوة لاتخاذ إجراء (شريط داكن)', stats: 'أرقام الإحصائيات (من الإعدادات)', pricing: 'باقات الأسعار (من المحتوى)',
};

export async function getSections(page: string): Promise<Section[]> {
  try {
    const { data, error } = await anonClient().from('site_sections').select('*').eq('page', page).eq('published', true).order('position');
    if (error) return [];
    return (data ?? []) as Section[];
  } catch { return []; }
}

const p = (t: string) => `<p>${t}</p>`;
type Seed = Partial<Section> & { kind: SectionKind };

/** The current static content of each page, used to seed the editor the first time. */
export const DEFAULT_SECTIONS: Record<string, Seed[]> = {
  recruitment: [
    { kind: 'hero', eyebrow: 'خدمة التوظيف', title: 'نوصلك للكفاءة الصح، مش أي كفاءة', body_html: p('فريقنا بيدور على المرشح المناسب لثقافة شركتك ومتطلبات الدور، مش بس اللي بيوافق على السيرة الذاتية.'), cta_label: 'اطلب مرشح', cta_href: '/contact' },
    { kind: 'feature', eyebrow: 'أنواع التوظيف', title: 'التوظيف الدائم', body_html: p('نتولى دورة التوظيف كاملة: كتابة الإعلان، الفرز، المقابلات الأولية، وتنسيق المقابلة النهائية مع فريقك، لحد ما تختار الشخص المناسب.') },
    { kind: 'feature', title: 'التوظيف المؤقت والمشاريعي', reverse: true, body_html: p('لو عندك حمل عمل موسمي أو مشروع محدد المدة، بنوفرلك كفاءات جاهزة للانضمام بسرعة من غير التزام توظيف طويل المدى.') },
    { kind: 'feature', title: 'التوظيف التنفيذي (Executive Search)', body_html: p('لأدوار القيادة العليا، بنستخدم منهجية بحث مباشر (Headhunting) مع سرية تامة، ونقدملك قائمة مختصرة من المرشحين المؤهلين فعليًا.') },
    { kind: 'steps', eyebrow: 'آلية العمل', title: 'رحلة التوظيف معانا', items: [
      { title: 'فهم المتطلبات', body: 'جلسة قصيرة لفهم طبيعة الدور، ثقافة الفريق، والميزانية.' },
      { title: 'البحث والفرز', body: 'ندور على المرشحين من قاعدة بياناتنا وقنوات البحث المباشر، ونعمل فرز أولي هاتفي.' },
      { title: 'تقديم القائمة المختصرة', body: 'بنقدملك 3-5 مرشحين مؤهلين مع تقرير تقييم لكل واحد.' },
      { title: 'المقابلة والتعيين', body: 'ننسق المقابلات النهائية، ونساعد في التفاوض على العرض حتى التوقيع.' },
    ] },
    { kind: 'cta', title: 'عندك دور شاغر محتاج تتملى؟', body_html: p('ابعتلنا تفاصيل الوظيفة ونرجعلك خلال 24 ساعة بخطة عمل مبدئية.'), cta_label: 'اطلب مرشح دلوقتي', cta_href: '/contact' },
  ],
  'hrm-saas': [
    { kind: 'hero', eyebrow: 'نظام إدارة الموارد البشرية', title: 'كل بيانات موظفينك في مكان واحد', body_html: p('حضور، رواتب، إجازات، وتقييم أداء — نظام سحابي بواجهة عربية، مصمم لفرق الموارد البشرية اللي عايزة توقف الشيتات المتفرقة.'), cta_label: 'اطلب تجربة مجانية', cta_href: '/contact', cta2_label: 'دليل الاستخدام والشروحات', cta2_href: '/hrm-guide' },
    { kind: 'feature', eyebrow: 'المميزات', title: 'الحضور والانصراف', body_html: p('تسجيل حضور عبر الموبايل أو البصمة، مع حساب تلقائي للتأخير والوقت الإضافي، وربط مباشر بكشوف الرواتب.') },
    { kind: 'feature', title: 'الرواتب', reverse: true, body_html: p('احتساب الرواتب والخصومات والبدلات تلقائيًا شهريًا، مع إصدار قسائم رواتب إلكترونية لكل موظف.') },
    { kind: 'feature', title: 'الإجازات والطلبات', body_html: p('تقديم طلبات الإجازة والموافقة عليها إلكترونيًا، مع رصيد إجازات محدث لحظيًا لكل موظف.') },
    { kind: 'feature', title: 'تقييم الأداء', reverse: true, body_html: p('دورات تقييم دورية قابلة للتخصيص، بمؤشرات أداء واضحة تساعدك في قرارات الترقية والتطوير.') },
    { kind: 'pricing', eyebrow: 'الأسعار', title: 'باقات تناسب حجم فريقك' },
    { kind: 'cta', title: 'جاهز تجرب النظام؟', body_html: p('احجز عرض تجريبي مباشر لمدة 20 دقيقة مع فريقنا، من غير أي التزام.'), cta_label: 'احجز عرض تجريبي', cta_href: '/contact' },
  ],
  consulting: [
    { kind: 'hero', eyebrow: 'الاستشارات', title: 'لما الهيكل التنظيمي يبقى واضح، القرارات بتبقى أسهل', body_html: p('نساعد الشركات الناشئة والمتوسطة تبني أساس موارد بشرية سليم، بدل ما تعالج المشاكل واحدة واحدة.'), cta_label: 'احجز جلسة تشخيص', cta_href: '/contact' },
    { kind: 'feature', eyebrow: 'مجالات الاستشارة', title: 'الهيكلة التنظيمية', body_html: p('مراجعة الهيكل الحالي لشركتك، وتحديد مستويات الإدارة والمسؤوليات بشكل يدعم النمو المستقبلي بدون تضارب صلاحيات.') },
    { kind: 'feature', title: 'السياسات الداخلية', reverse: true, body_html: p('صياغة دليل سياسات الموظفين: الحضور، الإجازات، السلوك الوظيفي، والإجراءات التأديبية، بما يتوافق مع قانون العمل.') },
    { kind: 'feature', title: 'مسارات النمو الوظيفي', body_html: p('تصميم مسارات ترقية واضحة لكل دور، تساعدك تحتفظ بالكفاءات وتقلل معدل ترك العمل.') },
    { kind: 'feature', title: 'أنظمة التعويضات والمزايا', reverse: true, body_html: p('مراجعة هيكل الرواتب والمزايا بمقارنة بسوق العمل، لضمان تنافسية عادلة داخليًا وخارجيًا.') },
    { kind: 'steps', eyebrow: 'طريقة التعامل', title: 'استشارة عملية، مش تقرير هيقعد في الدرج', items: [
      { title: 'تشخيص الوضع الحالي', body: 'نراجع الهيكل، السياسات، والبيانات المتاحة لفهم نقاط الضعف الفعلية.' },
      { title: 'خطة عمل واضحة', body: 'نقدم توصيات محددة بأولويات وجدول زمني واقعي للتنفيذ.' },
      { title: 'التنفيذ المشترك', body: 'نشتغل مع فريقك خطوة بخطوة، مش بس نسلم توصية ونمشي.' },
    ] },
    { kind: 'cta', title: 'عندك تحدي تنظيمي محدد؟', body_html: p('احجز جلسة تشخيص أولية مجانية لمدة 30 دقيقة.'), cta_label: 'احجز جلسة تشخيص', cta_href: '/contact' },
  ],
  about: [
    { kind: 'hero', eyebrow: 'من نحن', title: 'بنساعد الشركات تبني فرق قوية وأنظمة موارد بشرية تكبر معاها', body_html: p('Vacant HR اتأسست على فكرة بسيطة: الشركات الناشئة والمتوسطة محتاجة نفس جودة خدمات الموارد البشرية اللي عند الشركات الكبيرة، بس بشكل عملي وبتكلفة مناسبة. عشان كده جمعنا الخدمة البشرية (توظيف واستشارات) مع أداة تقنية (نظام HRM) تحت سقف واحد.') },
    { kind: 'rich', title: 'قصتنا', body_html: p('بدأنا كفريق توظيف صغير بيشتغل مع شركات ناشئة في القاهرة. مع الوقت لاحظنا إن العملاء بيرجعوا لنا بنفس المشاكل: هيكل تنظيمي مش واضح، سياسات مكتوبة على السريع، وبيانات موظفين متفرقة على شيتات إكسل. فقررنا نوسّع الخدمة عشان نغطي دورة الموارد البشرية كاملة — من أول ما تدوّر على موظف، لحد ما تدير أداءه ورواتبه.') },
    { kind: 'steps', title: 'قيمنا', items: [
      { title: 'الوضوح', body: 'توصيات محددة وخطوات واضحة، مش تقارير نظرية.' },
      { title: 'العملية', body: 'نشتغل مع فريقك على التنفيذ، مش بس التسليم.' },
      { title: 'الشفافية', body: 'أسعار واضحة ومواعيد واقعية من أول يوم.' },
    ] },
    { kind: 'rich', title: 'مين بنخدمهم', body_html: '<ul><li>الشركات الناشئة اللي بتوظف أول 10–50 موظف وعايزة تعمل الأساس صح.</li><li>الشركات المتوسطة اللي وصلت لمرحلة إن الشيتات مابقتش تكفي.</li><li>فرق الموارد البشرية اللي محتاجة دعم في التوظيف أو الاستشارات لمشروع محدد.</li></ul>' },
    { kind: 'rich', title: 'ليه Vacant HR', body_html: '<ul><li>خدمة بشرية وتقنية في مكان واحد — مش محتاج تتعامل مع أكتر من مورّد.</li><li>خبرة محلية بقانون العمل والتأمينات والسوق المصري.</li><li>واجهة عربية بالكامل لكل الأدوات.</li></ul>' },
    { kind: 'stats' },
    { kind: 'cta', title: 'نبدأ شغل سوا؟', body_html: p('احجز استشارة مجانية ونتكلم عن احتياج شركتك.'), cta_label: 'تواصل معنا', cta_href: '/contact' },
  ],
};
