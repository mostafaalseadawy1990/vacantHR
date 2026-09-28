// Minimal HTML → .docx (WordprocessingML) converter for RTL Arabic documents.
// Supports h1–h3, p, ul/ol + li, blockquote, strong/b, em/i, u, br. Everything else is flattened to text.
import { zipSync, strToU8 } from 'fflate';

type Run = { text: string; b?: boolean; i?: boolean; u?: boolean };
type Block = { kind: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'quote'; runs: Run[]; ordered?: boolean };

const decode = (s: string) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Splits inline HTML into styled runs. */
function inlineRuns(html: string): Run[] {
  const runs: Run[] = [];
  let b = 0, i = 0, u = 0;
  const parts = html.split(/(<\/?(?:strong|b|em|i|u|br)\b[^>]*>)/i);
  for (const part of parts) {
    if (!part) continue;
    const m = /^<(\/?)(strong|b|em|i|u|br)\b/i.exec(part);
    if (m) {
      const close = m[1] === '/', tag = m[2].toLowerCase();
      if (tag === 'br') runs.push({ text: '\n' });
      else if (tag === 'strong' || tag === 'b') b += close ? -1 : 1;
      else if (tag === 'em' || tag === 'i') i += close ? -1 : 1;
      else if (tag === 'u') u += close ? -1 : 1;
      continue;
    }
    const text = decode(part.replace(/<[^>]+>/g, ''));
    if (text) runs.push({ text, b: b > 0, i: i > 0, u: u > 0 });
  }
  return runs;
}

function blocks(html: string): Block[] {
  const out: Block[] = [];
  // Mark list items with their list type first.
  const marked = html
    .replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner) => inner.replace(/<li\b/gi, '<li data-ol="1"'))
    .replace(/<\/?(ul|ol)\b[^>]*>/gi, '');
  const re = /<(h1|h2|h3|p|li|blockquote|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null; let last = 0;
  while ((m = re.exec(marked))) {
    const before = marked.slice(last, m.index).replace(/<[^>]+>/g, '').trim();
    if (before) out.push({ kind: 'p', runs: inlineRuns(before) });
    last = m.index + m[0].length;
    const tag = m[1].toLowerCase(), attrs = m[2], inner = m[3];
    const kind: Block['kind'] = tag === 'li' ? 'li' : tag === 'blockquote' ? 'quote' : tag === 'div' ? 'p' : (tag as any);
    const runs = inlineRuns(inner);
    if (runs.some((r) => r.text.trim())) out.push({ kind, runs, ordered: /data-ol/.test(attrs) });
  }
  const tail = marked.slice(last).replace(/<[^>]+>/g, '').trim();
  if (tail) out.push({ kind: 'p', runs: inlineRuns(tail) });
  return out;
}

function runXml(r: Run, extra = ''): string {
  const props = `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${r.b ? '<w:b/><w:bCs/>' : ''}${r.i ? '<w:i/><w:iCs/>' : ''}${r.u ? '<w:u w:val="single"/>' : ''}${extra}<w:rtl/></w:rPr>`;
  if (r.text === '\n') return `<w:r>${props}<w:br/></w:r>`;
  return `<w:r>${props}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
}

function paraXml(bk: Block): string {
  const sz = bk.kind === 'h1' ? 36 : bk.kind === 'h2' ? 30 : bk.kind === 'h3' ? 26 : 24;
  const heading = bk.kind.startsWith('h');
  const color = heading ? '<w:color w:val="0E7C66"/>' : bk.kind === 'quote' ? '<w:color w:val="64748B"/>' : '';
  const num = bk.kind === 'li' ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${bk.ordered ? 2 : 1}"/></w:numPr>` : '';
  const spacing = heading ? '<w:spacing w:before="280" w:after="120"/>' : '<w:spacing w:after="120"/>';
  const pPr = `<w:pPr>${num}<w:bidi/><w:jc w:val="start"/>${spacing}</w:pPr>`;
  const runs = bk.runs.map((r) => runXml({ ...r, b: r.b || heading }, `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${color}`)).join('');
  return `<w:p>${pPr}${runs}</w:p>`;
}

/** Builds a .docx (as bytes) from HTML. */
export function htmlToDocx(html: string, opts: { title: string; footer?: string }): Uint8Array {
  const body = [
    paraXml({ kind: 'h1', runs: [{ text: opts.title }] }),
    ...blocks(html).map(paraXml),
    opts.footer ? paraXml({ kind: 'quote', runs: [{ text: opts.footer, i: true }] }) : '',
  ].join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:bidi/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200"/></w:sectPr></w:body></w:document>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="start"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="arabicAlpha"/><w:lvlText w:val="%1."/><w:lvlJc w:val="start"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:bidi="ar-EG"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:line="336" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    'word/document.xml': strToU8(document),
    'word/numbering.xml': strToU8(numbering),
    'word/styles.xml': strToU8(styles),
    'word/_rels/document.xml.rels': strToU8(docRels),
  }, { level: 6 });
}
