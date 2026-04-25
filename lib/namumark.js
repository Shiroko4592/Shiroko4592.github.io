const { escapeHtml } = require('./layout');

// Color name map for {{{#name text}}}
const COLOR_NAMES = new Set([
  'red','blue','green','yellow','orange','purple','pink','brown','gray','grey',
  'black','white','cyan','magenta','lime','navy','teal','maroon','olive','silver',
  'gold','indigo','violet','crimson','tomato','salmon','coral','khaki','plum',
]);

function isHexColor(s) { return /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(s); }
function isColor(s) { return COLOR_NAMES.has(String(s).toLowerCase()) || isHexColor(s); }

function parse(text, opts = {}) {
  if (!text) return { html: '', categories: [], links: [], headings: [], categoriesHtml: '' };
  const ctx = { categories: [], links: [], footnotes: [], headings: [], showToc: !!opts.autoToc };
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Multi-line code/folding block: {{{ ... }}}
    const codeStart = line.match(/^(\s*)\{\{\{(.*)$/);
    if (codeStart && codeStart[2].indexOf('}}}') === -1) {
      // Determine block type from first-line directive
      const directiveLine = codeStart[2];
      let blockType = 'code';
      let lang = '';
      let foldTitle = '';
      let firstContent = '';

      const fold = directiveLine.match(/^#!folding\s*(.*)$/);
      const syntax = directiveLine.match(/^#!(?:syntax\s+)?(\w+)\s*(.*)$/);
      const html2 = directiveLine.match(/^#!html\s*(.*)$/);

      if (fold) {
        blockType = 'folding';
        foldTitle = fold[1].trim() || '접기/펼치기';
      } else if (html2) {
        blockType = 'html';
        firstContent = html2[1];
      } else if (syntax) {
        blockType = 'code';
        lang = syntax[1];
        firstContent = syntax[2];
      } else {
        firstContent = directiveLine;
      }

      const block = [];
      if (firstContent) block.push(firstContent);
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

      if (blockType === 'folding') {
        const innerHtml = parse(block.join('\n'), { autoToc: false }).html;
        out.push(`<details class="wfold"><summary>${escapeHtml(foldTitle)}</summary><div class="wfold-body">${innerHtml}</div></details>`);
      } else if (blockType === 'html') {
        // Trusted HTML block — for completeness; sanitized minimally by stripping <script>
        const safe = block.join('\n').replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
        out.push(`<div class="whtml">${safe}</div>`);
      } else {
        const cls = lang ? `code lang-${escapeHtml(lang)}` : 'code';
        out.push(`<pre class="${cls}"><code>${escapeHtml(block.join('\n'))}</code></pre>`);
      }
      continue;
    }

    // Heading: == text ==  (must have matching = count on both sides)
    const h = line.match(/^(={1,6})\s*(.+?)\s*(={1,6})\s*$/);
    if (h && h[1].length === h[3].length) {
      const level = h[1].length;
      const inner = parseInline(h[2], ctx);
      const baseSlug = slugify(h[2]);
      // Ensure unique slug
      let slug = baseSlug;
      let n = 1;
      while (ctx.headings.some((x) => x.slug === slug)) { slug = baseSlug + '-' + (++n); }
      const idx = ctx.headings.length;
      ctx.headings.push({ level, text: h[2], slug, sectionIndex: idx });
      out.push(
        `<h${level} class="wh wh-${level}" id="${slug}">` +
        `<a class="anchor" href="#${slug}">§</a> ${inner}` +
        `<span class="wh-edit"> <a href="\x00SECTIONEDIT${idx}\x00" class="section-edit">[편집]</a></span>` +
        `</h${level}>`
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^-{4,}$/.test(line.trim())) {
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
        quoteLines.push(lines[i].replace(/^>+\s?/, ''));
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
      while (i < lines.length && /^ +\S/.test(lines[i]) && !/^ +(\*|1\.|a\.|A\.|i\.|I\.) /.test(lines[i])) {
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

    // Paragraph (always consume at least the current line to guarantee progress)
    const paraLines = [lines[i]];
    i++;
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

  let html = out.join('\n') + footnotesHtml;

  // Build TOC if requested or if a TOC marker exists in the html
  const tocHtml = buildToc(ctx.headings);
  const hasMarker = html.indexOf('\x00TOC\x00') !== -1;
  if (hasMarker) {
    html = html.split('\x00TOC\x00').join(tocHtml);
  } else if (opts.autoToc && ctx.headings.length >= 2) {
    html = tocHtml + html;
  }

  return {
    html,
    categoriesHtml: catsHtml,
    categories: cats,
    links: [...new Set(ctx.links)],
    headings: ctx.headings,
  };
}

function buildToc(headings) {
  if (!headings || headings.length === 0) return '';
  let html = '<div class="wtoc"><div class="wtoc-title">목차</div><ul>';
  let prev = 0;
  for (const h of headings) {
    const level = Math.max(1, Math.min(6, h.level));
    if (prev === 0) {
      html += `<li class="lvl-${level}"><a href="#${h.slug}">${escapeHtml(h.text)}</a>`;
    } else if (level > prev) {
      html += `<ul><li class="lvl-${level}"><a href="#${h.slug}">${escapeHtml(h.text)}</a>`;
    } else if (level === prev) {
      html += `</li><li class="lvl-${level}"><a href="#${h.slug}">${escapeHtml(h.text)}</a>`;
    } else {
      html += '</li>';
      while (prev > level) { html += '</ul></li>'; prev--; }
      html += `<li class="lvl-${level}"><a href="#${h.slug}">${escapeHtml(h.text)}</a>`;
    }
    prev = level;
  }
  while (prev > 0) { html += '</li>'; if (prev > 1) html += '</ul>'; prev--; }
  html += '</ul></div>';
  return html;
}

function isBlockStart(line) {
  if (line.startsWith('||')) return true;
  if (line.startsWith('>')) return true;
  if (line.trim().startsWith('{{{')) return true;
  const h = line.match(/^(={1,6})\s*.+?\s*(={1,6})\s*$/);
  if (h && h[1].length === h[2].length) return true;
  if (/^-{4,}$/.test(line.trim())) return true;
  if (/^ +(\*|1\.|a\.|A\.|i\.|I\.) /.test(line)) return true;
  return false;
}

function parseTable(lines, ctx) {
  const rows = lines.map((line) => {
    let content = line;
    if (content.startsWith('||')) content = content.slice(2);
    if (content.endsWith('||')) content = content.slice(0, -2);
    return content.split('||').map((cell) => {
      let attrs = { tag: 'td', style: '', colspan: 1, rowspan: 1 };
      // Strip cell prefixes like <:>, <(>, <)>, <-N>, <|N>, <#color>
      let changed = true;
      while (changed) {
        changed = false;
        const before = cell;
        cell = cell.replace(/^<\(>/, () => { attrs.style += 'text-align:left;'; changed = true; return ''; });
        cell = cell.replace(/^<:>/, () => { attrs.style += 'text-align:center;'; changed = true; return ''; });
        cell = cell.replace(/^<\)>/, () => { attrs.style += 'text-align:right;'; changed = true; return ''; });
        cell = cell.replace(/^<-(\d+)>/, (_, n) => { attrs.colspan = parseInt(n, 10); changed = true; return ''; });
        cell = cell.replace(/^<\|(\d+)>/, (_, n) => { attrs.rowspan = parseInt(n, 10); changed = true; return ''; });
        cell = cell.replace(/^<#([0-9a-fA-F]{3,8}|[a-zA-Z]+)>/, (_, c) => { attrs.style += `background:${isHexColor(c) ? '#'+c : c};`; changed = true; return ''; });
        if (cell === before) changed = false;
      }
      return { ...attrs, html: parseInline(cell.trim(), ctx) };
    });
  });
  let html = '<div class="wtable-wrap"><table class="wtable"><tbody>';
  for (const row of rows) {
    html += '<tr>';
    for (const cell of row) {
      const sa = cell.style ? ` style="${cell.style}"` : '';
      const ca = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : '';
      const ra = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : '';
      html += `<${cell.tag}${ca}${ra}${sa}>${cell.html}</${cell.tag}>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function parseList(lines, ctx) {
  const items = lines.map((line) => {
    const m = line.match(/^( +)(\*|1\.|a\.|A\.|i\.|I\.) (.*)$/);
    return {
      indent: m[1].length,
      ordered: m[2] !== '*',
      content: parseInline(m[3], ctx),
    };
  });

  let html = '';
  const stack = []; // each: { type, indent }

  for (const it of items) {
    const type = it.ordered ? 'ol' : 'ul';

    // Close deeper levels
    while (stack.length && stack[stack.length - 1].indent > it.indent) {
      const popped = stack.pop();
      html += `</li></${popped.type}>`;
    }

    if (stack.length === 0 || stack[stack.length - 1].indent < it.indent) {
      // Open new nested list (do NOT close parent <li> — keep nested inside)
      html += `<${type} class="wlist"><li>`;
      stack.push({ type, indent: it.indent });
    } else {
      // Same level: sibling
      const top = stack[stack.length - 1];
      if (top.type !== type) {
        // Type change at same indent: close & reopen
        html += `</li></${top.type}>`;
        stack.pop();
        html += `<${type} class="wlist"><li>`;
        stack.push({ type, indent: it.indent });
      } else {
        html += `</li><li>`;
      }
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

  // Save inline `{{{ ... }}}` content first to protect (handles colors and code)
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

  // Image / file: [[파일:URL]] or [[파일:URL|width=200,height=100,align=center]]
  s = s.replace(/\[\[(?:파일|file|File|FILE):([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, src, opts) => {
    const url = src.trim();
    let style = '';
    let alt = '';
    if (opts) {
      const parts = opts.split(/[,&]/);
      for (const p of parts) {
        const kv = p.split('=');
        if (kv.length === 2) {
          const k = kv[0].trim().toLowerCase();
          const v = kv[1].trim();
          if (k === 'width') style += `max-width:${/^\d+$/.test(v) ? v + 'px' : v};`;
          else if (k === 'height') style += `height:${/^\d+$/.test(v) ? v + 'px' : v};`;
          else if (k === 'align') style += `display:block;margin-${v === 'center' ? 'left:auto;margin-right:auto' : v === 'right' ? 'left:auto' : 'right:auto'};`;
          else if (k === 'alt') alt = v;
        } else {
          alt = p.trim();
        }
      }
    }
    const safeUrl = /^https?:\/\//i.test(url) ? url : url; // accept any
    placeholders.push(`<img class="wimg" src="${escapeHtml(safeUrl)}" alt="${escapeHtml(alt)}"${style ? ` style="${style}"` : ''} />`);
    return `\x00P${placeholders.length - 1}\x00`;
  });

  // External link [[http(s)://...|label]] or [[http://...]]
  s = s.replace(/\[\[((?:https?|ftp):\/\/[^\]\s|]+)(?:\|([^\]]+))?\]\]/g, (_, url, label) => {
    placeholders.push(`<a href="${escapeHtml(url)}" class="ext" target="_blank" rel="noopener noreferrer">${escapeHtml(label || url)}</a>`);
    return `\x00P${placeholders.length - 1}\x00`;
  });
  // Bare URL (auto-link)
  s = s.replace(/(^|[\s(])((?:https?):\/\/[^\s<>"'()]+)/g, (m, pre, url) => {
    placeholders.push(`<a href="${escapeHtml(url)}" class="ext" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
    return `${pre}\x00P${placeholders.length - 1}\x00`;
  });

  // Internal link [[Page|Label]] or [[Page#anchor]] or [[Page]]
  s = s.replace(/\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_, page, anchor, label) => {
    const p = page.trim();
    ctx.links.push(p);
    let url, cls;
    if (p === '') {
      url = anchor || '#';
      cls = 'wlink-anchor';
    } else {
      url = '/w/' + encodeURIComponent(p) + (anchor ? anchor : '');
      cls = 'wlink';
    }
    placeholders.push(`<a href="${url}" class="${cls}">${escapeHtml(label || (p + (anchor || '')))}</a>`);
    return `\x00P${placeholders.length - 1}\x00`;
  });
  // Pure-anchor link  [[#anchor|label]] or [[#anchor]]
  s = s.replace(/\[\[(#[^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, anchor, label) => {
    placeholders.push(`<a href="${escapeHtml(anchor)}" class="wlink-anchor">${escapeHtml(label || anchor)}</a>`);
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
  // Restore inline `{{{...}}}` — could be color or code
  s = s.replace(/\x00C(\d+)\x00/g, (_, i) => {
    const raw = codes[parseInt(i, 10)];
    // Color form: #color text   (e.g. {{{#red 글자}}}, {{{#1f6feb 글자}}})
    const colorMatch = raw.match(/^#([0-9a-fA-F]{3,8}|[a-zA-Z]+)\s+([\s\S]+)$/);
    if (colorMatch && isColor(colorMatch[1])) {
      const c = isHexColor(colorMatch[1]) ? '#' + colorMatch[1] : colorMatch[1].toLowerCase();
      const inner = parseInline(colorMatch[2], ctx);
      return `<span style="color:${c}">${inner}</span>`;
    }
    return `<code class="ic">${escapeHtml(raw)}</code>`;
  });
  // Macros
  s = s.replace(/\x00BR\x00/g, '<br/>');

  return s;
}

module.exports = { parse };
