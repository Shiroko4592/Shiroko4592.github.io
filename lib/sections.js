// Helpers for section-level editing.
// A "section" is a heading line plus all lines until the next heading of equal-or-higher level.

function findHeadings(content) {
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');
  const heads = [];
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Track {{{ ... }}} block boundaries to avoid matching headings inside code blocks
    if (!inCode && /^\s*\{\{\{/.test(line) && line.indexOf('}}}') === -1) inCode = true;
    else if (inCode && line.indexOf('}}}') !== -1) { inCode = false; continue; }
    if (inCode) continue;
    const m = line.match(/^(={1,6})\s*(.+?)\s*(={1,6})\s*$/);
    if (m && m[1].length === m[3].length) {
      heads.push({ index: heads.length, level: m[1].length, text: m[2], lineNo: i });
    }
  }
  return { lines, heads };
}

function getSectionRange(content, sectionIndex) {
  const { lines, heads } = findHeadings(content);
  if (sectionIndex < 0 || sectionIndex >= heads.length) return null;
  const h = heads[sectionIndex];
  const start = h.lineNo;
  // Find end: next heading with level <= h.level
  let end = lines.length;
  for (let k = sectionIndex + 1; k < heads.length; k++) {
    if (heads[k].level <= h.level) { end = heads[k].lineNo; break; }
  }
  return { start, end, lines, head: h };
}

function extractSection(content, sectionIndex) {
  const r = getSectionRange(content, sectionIndex);
  if (!r) return null;
  return r.lines.slice(r.start, r.end).join('\n').replace(/\s+$/, '');
}

function replaceSection(content, sectionIndex, newSectionText) {
  const r = getSectionRange(content, sectionIndex);
  if (!r) return content;
  const before = r.lines.slice(0, r.start).join('\n');
  const after = r.lines.slice(r.end).join('\n');
  // Normalize trailing newlines
  const middle = (newSectionText || '').replace(/\s+$/, '');
  let merged = '';
  if (before) merged += before + '\n';
  merged += middle;
  if (after) merged += '\n' + after;
  return merged;
}

module.exports = { findHeadings, extractSection, replaceSection };
