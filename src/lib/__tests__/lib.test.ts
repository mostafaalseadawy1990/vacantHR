import { describe, it, expect } from 'vitest';
import { renderMarkdown, salaryLabel, EMPLOYMENT_TYPE_AR, type Job } from '../jobs';
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
