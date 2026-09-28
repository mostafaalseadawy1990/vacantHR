import { describe, it, expect } from 'vitest';
import { renderMarkdown, salaryLabel, normalizeApplyUrl, EMPLOYMENT_TYPE_AR, type Job } from '../jobs';
import { ytEmbed } from '../settings';
import { toCsv } from '../csv';

describe('renderMarkdown', () => {
  it('renders headings, lists, bold, links', () => {
    const html = renderMarkdown('## عنوان\n\n- بند أول\n- بند تاني\n\n**غامق** و [رابط](https://x.com)');
    expect(html).toContain('<h3>عنوان</h3>');
    expect(html).toContain('<ul><li>بند أول</li><li>بند تاني</li></ul>');
    expect(html).toContain('<strong>غامق</strong>');
    expect(html).toContain('<a href="https://x.com" rel="noopener">رابط</a>');
  });
  it('escapes raw html', () => {
    expect(renderMarkdown('<script>x</script>')).toContain('&lt;script&gt;');
  });
  it('only allows https images', () => {
    expect(renderMarkdown('![a](https://x.com/i.png)')).toContain('<img src="https://x.com/i.png"');
    expect(renderMarkdown('![a](http://x.com/i.png)')).not.toContain('<img');
  });
});

describe('salaryLabel', () => {
  const base = { salary_currency: 'EGP' } as Job;
  it('hidden when salary_visible is false', () => {
    expect(salaryLabel({ ...base, salary_visible: false, salary_min: 100, salary_max: 200 })).toBeNull();
  });
  it('range when both present', () => {
    expect(salaryLabel({ ...base, salary_visible: true, salary_min: 10000, salary_max: 20000 }))
      .toBe('10,000–20,000 EGP');
  });
  it('min only', () => {
    expect(salaryLabel({ ...base, salary_visible: true, salary_min: 15000, salary_max: null }))
      .toBe('من 15,000 EGP');
  });
});

describe('EMPLOYMENT_TYPE_AR', () => {
  it('maps all enum values', () => {
    expect(EMPLOYMENT_TYPE_AR.full_time).toBe('دوام كامل');
    expect(EMPLOYMENT_TYPE_AR.temporary).toBe('مشروعي');
  });
});

describe('ytEmbed', () => {
  it('handles watch, youtu.be, embed, shorts', () => {
    const id = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
    expect(ytEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(id);
    expect(ytEmbed('https://youtu.be/dQw4w9WgXcQ')).toBe(id);
    expect(ytEmbed('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(id);
  });
  it('returns null for non-youtube', () => {
    expect(ytEmbed('https://vimeo.com/123')).toBeNull();
    expect(ytEmbed('')).toBeNull();
    expect(ytEmbed(null)).toBeNull();
  });
});

describe('toCsv', () => {
  it('adds BOM and quotes fields with commas/quotes/newlines', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'he said "hi"'], [1, null]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"x,y"');
    expect(csv).toContain('"he said ""hi"""');
    expect(csv.trim().split('\r\n').length).toBe(3);
  });
});

describe('normalizeApplyUrl', () => {
  it('accepts http(s) and adds a missing scheme', () => {
    expect(normalizeApplyUrl('https://forms.gle/abc')).toBe('https://forms.gle/abc');
    expect(normalizeApplyUrl('forms.gle/abc')).toBe('https://forms.gle/abc');
  });
  it('rejects empty and non-http values', () => {
    expect(normalizeApplyUrl('')).toBeNull();
    expect(normalizeApplyUrl('javascript:alert(1)')).toBeNull();
  });
});

import { sanitizeHtml, hasContent } from '../html';
describe('sanitizeHtml', () => {
  it('strips scripts, event handlers and javascript: urls', () => {
    const out = sanitizeHtml('<p onclick="x()">hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a>');
    expect(out).toBe('<p>hi</p><a>x</a>');
  });
  it('keeps youtube iframes and drops others', () => {
    expect(sanitizeHtml('<iframe src="https://www.youtube.com/embed/abc"></iframe>')).toContain('youtube.com/embed/abc');
    expect(sanitizeHtml('<iframe src="https://evil.com/x"></iframe>')).toBe('');
  });
  it('hasContent ignores empty paragraphs', () => {
    expect(hasContent('<p><br></p>')).toBe(false);
    expect(hasContent('<p><img src="x.png"></p>')).toBe(true);
  });
});

import { completeness, waLink } from '../candidates';
describe('candidates', () => {
  it('completeness counts filled fields', () => {
    expect(completeness({}).pct).toBe(0);
    expect(completeness({ full_name: 'a', phone: '1', headline: 'x', city: 'c', years_experience: 2, education: 'e', skills: ['a','b','c'], availability: 'immediate', cv_path: 'p', bio: 'b' }).pct).toBe(100);
  });
  it('waLink normalises Egyptian numbers', () => {
    expect(waLink('01012345678')).toBe('https://wa.me/201012345678');
    expect(waLink('')).toBeNull();
  });
});

import { htmlToDocx } from '../docx';
import { unzipSync, strFromU8 } from 'fflate';
describe('htmlToDocx', () => {
  it('produces a docx with headings, lists and bold runs', () => {
    const bytes = htmlToDocx('<h2>المهام</h2><ul><li>تسجيل <strong>القيود</strong></li><li>مراجعة</li></ul><p>نص &amp; آخر</p>', { title: 'محاسب' });
    const files = unzipSync(bytes);
    const doc = strFromU8(files['word/document.xml']);
    expect(Object.keys(files)).toContain('[Content_Types].xml');
    expect(doc).toContain('محاسب');
    expect(doc).toContain('<w:numPr>');
    expect(doc).toContain('<w:b/>');
    expect(doc).toContain('نص &amp; آخر');
  });
});
