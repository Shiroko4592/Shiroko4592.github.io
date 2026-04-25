const { escapeHtml } = require('./layout');

function parse(text) {
  if (!text) return { html: '', categories: [], links: [] };
  const ctx = { categories: [], links: [], footnotes: [] };
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Multi-line code block: {{{ ... }}}
    const codeStart = line.match(/^(\s*)\{\{\{(?:#!syntax\s+(\w+))?(.*)$/);
    if (codeStart && codeStart[3].indexOf('}}}') === -1) {
      const lang = codeStart[2] || '';
      const block = [];
      if (codeStart[3]) block.push(codeStart[3]);
      i++;
      while (i < lines.length && lines[i].indexOf('}}}') === -1) {
        block.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        const closeIdx = lines[i].indexOf('}}}');
        if (closeIdx > 0) block.push(lines[i].slice(0, closeIdx));
        i++;
      }
      const cls = lang ? `code lang-${escapeHtml(lang)}` : 'code';
      out.push(`<pre class="${cls}"><code>${escapeHtml(block.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading: == text ==
    const h = line.match(/^(={1,6})\s*(.+?)\s*\1\s*$/);
    if (h) {
      const level = h[1].length;
      const inner = parseInline(h[2], ctx);
      const slug = slugify(h[2]);
      out.push(`<h${level} class="wh wh-${level}" id="${slug}"><a class="anchor" href="#${slug}">§</a> ${inner}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^-{4,10}$/.test(line.trim())) {
      out.push('<hr/>');
      i++;
      continue;
    }

    // Table
    if (line.startsWith('||')) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith('||')) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(parseTable(tableLines, ctx));
      continue;
    }

    // Block quote
    if (line.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>+/, '').trimStart());
        i++;
      }
      const inner = quoteLines.map((l) => parseInline(l, ctx)).join('<br/>');
      out.push(`<blockquote class="wquote">${inner}</blockquote>`);
      continue;
    }

    // Lists (must start with at least one space)
    if (/^ +(\*|1\.|a\.|A\.|i\.|I\.) /.test(line)) {
      const listLines = [];
      while (i < lines.length && /^ +(\*|1\.|a\.|A\.|i\.|I\.) /.test(lines[i])) {
        listLines.push(lines[i]);
        i++;
      }
      out.push(parseList(listLines, ctx));
      continue;
    }

    // Indented (definition-like) line  ` text`
    if (/^ +\S/.test(line)) {
      const indentLines = [];
      while (i < lines.length && /^ +\S/.test(lines[i])) {
        indentLines.push(lines[i].trimStart());
        i++;
      }
      out.push(`<div class="windent">${indentLines.map((l) => parseInline(l, ctx)).join('<br/>')}</div>`);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph (until blank or block start)
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    out.push(`<p>${paraLines.map((l) => parseInline(l, ctx)).join('<br/>')}</p>`);
  }

  // Footnotes section
  let footnotesHtml = '';
  if (ctx.footnotes.length > 0) {
    footnotesHtml = '<div class="wfootnotes"><h3 class="wh wh-3">각주</h3><ol>';
    ctx.footnotes.forEach((fn, idx) => {
      footnotesHtml += `<li id="fn-${idx + 1}">${fn} <a href="#fnref-${idx + 1}" class="fn-back">↑</a></li>`;
    });
    footnotesHtml += '</ol></div>';
  }

  // Categories block (always at bottom, like namuwiki)
  const cats = [...new Set(ctx.categories)];
  let catsHtml = '';
  if (cats.length > 0) {
    catsHtml = '<div class="wcategories"><span class="wcat-label">분류:</span> ';
    catsHtml += cats.map((c) => `<a href="/Category/${encodeURIComponent(c)}" class="wcat">${escapeHtml(c)}</a>`).join(' · ');
    catsHtml += '</div>';
  }

  return {
    html: out.join('\n') + footnotesHtml,
    categoriesHtml: catsHtml,
    categories: cats,
    links: [...new Set(ctx.links)],
  };
}

function isBlockStart(line) {
  if (line.startsWith('||')) return true;
  if (line.startsWith('>')) return true;
  if (line.trim().startsWith('{{{')) return true;
  if (/^={1,6}\s*.+?\s*={1,6}\s*$/.test(line)) return true;
  if (/^-{4,10}$/.test(line.trim())) return true;
  if (/^ +(\*|1\.|a\.|A\.|i\.|I\.) /.test(line)) return true;
  return false;
}

function parseTable(lines, ctx) {
  const rows = lines.map((line) => {
    let content = line;
    if (content.startsWith('||')) content = content.slice(2);
    if (content.endsWith('||')) content = content.slice(0, -2);
    return content.split('||').map((cell) => {
      let attrs = { tag: 'td', style: '', colspan: 1 };
      // Strip simple cell prefixes like <:>, <(>, <)>
      cell = cell.replace(/^<\(>/, () => { attrs.style += 'text-align:left;'; return ''; });
      cell = cell.replace(/^<:>/, () => { attrs.style += 'text-align:center;'; return ''; });
      cell = cell.replace(/^<\)>/, () => { attrs.style += 'text-align:right;'; return ''; });
      cell = cell.replace(/^<-(\d+)>/, (_, n) => { attrs.colspan = parseInt(n, 10); return ''; });
      cell = cell.replace(/^<\#([0-9a-fA-F]{3,8})>/, (_, c) => { attrs.style += `background:#${c};`; return ''; });
      return { ...attrs, html: parseInline(cell.trim(), ctx) };
    });
  });
  let html = '<div class="wtable-wrap"><table class="wtable"><tbody>';
  for (const row of rows) {
    html += '<tr>';
    for (const cell of row) {
      const sa = cell.style ? ` style="${cell.style}"` : '';
      const ca = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : '';
      html += `<${cell.tag}${ca}${sa}>${cell.html}</${cell.tag}>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function parseList(lines, ctx) {
  // Determine indent levels (number of leading spaces)
  const items = lines.map((line) => {
    const m = line.match(/^( +)(\*|1\.|a\.|A\.|i\.|I\.) (.*)$/);
    return {
      indent: m[1].length,
      ordered: m[2] !== '*',
      content: parseInline(m[3], ctx),
    };
  });

  // Build nested list using indent
  let html = '';
  const stack = []; // { type: 'ul'|'ol', indent: n }
  for (const it of items) {
    const type = it.ordered ? 'ol' : 'ul';
    while (stack.length && stack[stack.length - 1].indent > it.indent) {
      const popped = stack.pop();
      html += `</li></${popped.type}>`;
    }
    if (stack.length && stack[stack.length - 1].indent === it.indent) {
      html += `</li><li>`;
    } else {
      if (stack.length) html += '<li>';
      html += `<${type} class="wlist"><li>`;
      stack.push({ type, indent: it.indent });
    }
    html += it.content;
  }
  while (stack.length) {
    const popped = stack.pop();
    html += `</li></${popped.type}>`;
  }
  return html;
}

function slugify(s) {
  return String(s).trim().replace(/\s+/g, '_').replace(/[^\w가-힣_-]/g, '').slice(0, 64) || 'h';
}

function parseInline(text, ctx) {
  if (!text) return '';
  let s = text;

  // Save inline code first to protect content
  const codes = [];
  s = s.replace(/\{\{\{([\s\S]+?)\}\}\}/g, (_, c) => {
    codes.push(c);
    return `\x00C${codes.length - 1}\x00`;
  });

  // Categories — capture and remove
  s = s.replace(/\[\[분류:([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_, cat) => {
    ctx.categories.push(cat.trim());
    return '';
  });

  // Footnotes  [* footnote] or [*name footnote]
  s = s.replace(/\[\*([^\s\]]*)\s*([^\]]+)\]/g, (_, name, content) => {
    const idx = ctx.footnotes.length + 1;
    ctx.footnotes.push(parseInline(content.trim(), ctx));
    return `<sup class="fn"><a id="fnref-${idx}" href="#fn-${idx}">[${idx}]</a></sup>`;
  });

  // Save links to placeholders
  const placeholders = [];
  // External link [[http(s)://...|label]] or [[http://...]]
  s = s.replace(/\[\[((?:https?|ftp):\/\/[^\]\s|]+)(?:\|([^\]]+))?\]\]/g, (_, url, label) => {
    placeholders.push(`<a href="${escapeHtml(url)}" class="ext" target="_blank" rel="noopener noreferrer">${escapeHtml(label || url)}</a>`);
    return `\x00P${placeholders.length - 1}\x00`;
  });
  // Bare URL (auto-link)
  s = s.replace(/(^|[\s(])((?:https?):\/\/[^\s<>"']+)/g, (m, pre, url) => {
    placeholders.push(`<a href="${escapeHtml(url)}" class="ext" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
    return `${pre}\x00P${placeholders.length - 1}\x00`;
  });
  // File links — skip for now
  s = s.replace(/\[\[파일:[^\]]+\]\]/g, '');
  // Internal link [[Page|Label]] or [[Page]]
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, page, label) => {
    const p = page.trim();
    ctx.links.push(p);
    let url, cls;
    if (p.startsWith('#')) {
      url = p; cls = 'wlink-anchor';
    } else {
      url = '/w/' + encodeURIComponent(p);
      cls = 'wlink';
    }
    placeholders.push(`<a href="${url}" class="${cls}">${escapeHtml(label || p)}</a>`);
    return `\x00P${placeholders.length - 1}\x00`;
  });

  // Macros
  s = s.replace(/\[(?:목차|TOC|tableofcontents)\]|\[\[(?:목차|TOC)\]\]/gi, '\x00TOC\x00');
  s = s.replace(/\[br\]|\[\[br\]\]/gi, '\x00BR\x00');
  s = s.replace(/\[date\]|\[\[date\]\]/gi, () => new Date().toLocaleDateString('ko-KR'));

  // HTML escape the rest
  s = escapeHtml(s);

  // Inline formatting (post-escape; ' becomes &#39; after escape)
  s = s.replace(/(?:&#39;){3}([^\n]+?)(?:&#39;){3}/g, '<strong>$1</strong>');
  s = s.replace(/(?:&#39;){2}([^\n]+?)(?:&#39;){2}/g, '<em>$1</em>');
  s = s.replace(/__([^\n]+?)__/g, '<u>$1</u>');
  s = s.replace(/~~([^\n]+?)~~/g, '<del>$1</del>');
  s = s.replace(/(?:^|(?<=[^\-]))--([^\n-][^\n]*?[^\n-]|[^\n-])--(?=$|[^\-])/g, '<del>$1</del>');
  s = s.replace(/\^\^([^\n]+?)\^\^/g, '<sup>$1</sup>');
  s = s.replace(/,,([^\n]+?),,/g, '<sub>$1</sub>');

  // Restore link placeholders (raw HTML)
  s = s.replace(/\x00P(\d+)\x00/g, (_, i) => placeholders[parseInt(i, 10)]);
  // Restore inline code (escaped)
  s = s.replace(/\x00C(\d+)\x00/g, (_, i) => `<code class="ic">${escapeHtml(codes[parseInt(i, 10)])}</code>`);
  // Macros
  s = s.replace(/\x00BR\x00/g, '<br/>');
  s = s.replace(/\x00TOC\x00/g, '<span class="toc-marker"></span>');

  return s;
}

module.exports = { parse };
