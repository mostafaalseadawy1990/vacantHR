# متغيرات البيئة على Cloudflare Pages

تُضاف من: Workers & Pages → vacanthr → Settings → Variables and secrets (Production)، ثم إعادة النشر.

| المتغير | الوظيفة | إلزامي |
|---|---|---|
| `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` | الاتصال بقاعدة البيانات | نعم |
| `RESEND_API_KEY` + `EMAIL_FROM` | إرسال البريد (إشعارات الإدارة + رسائل المرشحين) | لا |
| `TELEGRAM_BOT_TOKEN` | إشعارات تيليجرام. المحادثة تُختار من لوحة الإدارة → الإعدادات → SEO والتحليلات → "اكتشاف محادثة تيليجرام" | لا |
| `TELEGRAM_CHAT_ID` | يتجاوز المحادثة المحفوظة في الإعدادات (اختياري) | لا |
| `META_PIXEL_ID` + `META_CAPI_TOKEN` | Meta Conversions API (تتبع التحويلات من السيرفر) | لا |
| `META_TEST_EVENT_CODE` | مؤقت لمشاهدة الأحداث في "اختبار الأحداث"، يُحذف بعد التأكد | لا |

الرموز (Token / Key) تُحفظ بنوع **Secret** لا Text.
