// Server-side hardening for HTML coming from the admin rich-text editor.
// Only admins can write it, but we still strip anything executable so a
// stolen admin session can't turn the blog into an XSS vector.

const BLOCKED_BLOCKS = /<(script|style|object|embed|form|textarea|select)\b[^>]*>[\s\S]*?<\/\1>/gi;
const BLOCKED_TAGS = /<\/?(script|style|object|embed|form|input|button|textarea|select|meta|link|base)\b[^>]*>/gi;
const IFRAME = /<iframe\b([^>]*)>([\s\S]*?)<\/iframe>/gi;
const EVENT_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const BAD_URL = /\s+(href|src|xlink:href)\s*=\s*("|')?\s*(javascript|data|vbscript):[^"'\s>]*("|')?/gi;
const ALLOWED_IFRAME = /^https:\/\/(www\.)?(youtube(-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/)/i;

export function sanitizeHtml(html: string): string {
  let out = (html ?? '').replace(/<!--[\s\S]*?-->/g, '');
  // Keep <iframe> only for YouTube / Vimeo embeds (what the editor's video button inserts).
  out = out.replace(IFRAME, (_m, attrs: string) => {
    const src = /\ssrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? '';
    if (!ALLOWED_IFRAME.test(src)) return '';
    return `<iframe class="ql-video" src="${src}" frameborder="0" allowfullscreen loading="lazy"></iframe>`;
  });
  out = out.replace(BLOCKED_BLOCKS, '');
  out = out.replace(BLOCKED_TAGS, '');
  out = out.replace(EVENT_ATTR, '');
  out = out.replace(BAD_URL, '');
  return out.trim();
}

/** True when the editor content is more than an empty paragraph. */
export function hasContent(html: string): boolean {
  return (html ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim().length > 0 || /<(img|iframe)\b/i.test(html ?? '');
}
