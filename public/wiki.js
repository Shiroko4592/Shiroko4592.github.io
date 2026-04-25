// ===== Signup: real-time auto-generated password =====
(function () {
  const phoneEl = document.getElementById('signup-phone');
  const pwEl = document.getElementById('signup-password');
  const regenBtn = document.getElementById('pw-regen');
  if (!phoneEl || !pwEl) return;

  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  function generatePassword(len) {
    len = len || 12;
    const arr = new Uint8Array(len);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    let out = '';
    for (let i = 0; i < len; i++) out += ALPHABET[arr[i] % ALPHABET.length];
    return out;
  }

  function isLikelyValidPhone(v) {
    return /^\+[1-9]\d{7,14}$/.test(v.replace(/[\s\-().]/g, ''));
  }

  function refresh() {
    if (isLikelyValidPhone(phoneEl.value)) {
      if (!pwEl.value) pwEl.value = generatePassword(12);
    } else {
      pwEl.value = '';
    }
  }
  phoneEl.addEventListener('input', refresh);
  if (regenBtn) regenBtn.addEventListener('click', () => { pwEl.value = generatePassword(12); pwEl.focus(); pwEl.select(); });
  pwEl.addEventListener('focus', () => pwEl.select());
  refresh();
})();

(function () {
  // Editor: tabs + live preview + toolbar
  const form = document.getElementById('editor-form');
  if (!form) return;

  const tabs = form.querySelectorAll('.editor-tabs .tab');
  const panes = form.querySelectorAll('.editor-pane');
  const textarea = document.getElementById('content');
  const preview = document.getElementById('preview');
  const toolbar = document.getElementById('editor-toolbar');

  let previewTimer = null;
  let lastPreviewed = null;

  async function refreshPreview() {
    if (!preview) return;
    const text = textarea.value;
    if (text === lastPreviewed) return;
    lastPreviewed = text;
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error('preview failed');
      const data = await res.json();
      preview.innerHTML = data.html || '<em class="muted">(미리보기 내용이 없습니다)</em>';
    } catch (err) {
      preview.innerHTML = '<em class="muted">미리보기를 불러올 수 없습니다.</em>';
    }
  }

  function activate(name) {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    panes.forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== name));
    if (name === 'preview') refreshPreview();
  }

  tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.tab)));

  textarea.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const previewTab = form.querySelector('.tab[data-tab="preview"]');
      if (previewTab && previewTab.classList.contains('active')) refreshPreview();
    }, 300);
  });

  // Save with Ctrl+Enter / Cmd+Enter
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.submit();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); insertWrap("'''", "'''", '굵게'); }
      else if (k === 'i') { e.preventDefault(); insertWrap("''", "''", '기울임'); }
      else if (k === 'u') { e.preventDefault(); insertWrap('__', '__', '밑줄'); }
      else if (k === 'k') { e.preventDefault(); insertLink(); }
    }
  });

  // Toolbar actions
  function getSel() {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    return { start, end, text: textarea.value.substring(start, end) };
  }
  function setSel(start, end) {
    textarea.focus();
    textarea.setSelectionRange(start, end == null ? start : end);
  }
  function replaceSel(newText, selectStart, selectEnd) {
    const { start, end } = getSel();
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + newText + after;
    if (selectStart != null) {
      setSel(start + selectStart, start + (selectEnd == null ? selectStart : selectEnd));
    } else {
      setSel(start + newText.length);
    }
    textarea.dispatchEvent(new Event('input'));
  }
  function insertWrap(left, right, placeholder) {
    const sel = getSel();
    const inner = sel.text || placeholder;
    replaceSel(left + inner + right, left.length, left.length + inner.length);
  }
  function insertLink() {
    const sel = getSel();
    const t = sel.text || '문서명';
    replaceSel('[[' + t + ']]', 2, 2 + t.length);
  }
  function insertExtLink() {
    const sel = getSel();
    const url = 'https://example.com';
    const label = sel.text || '링크 텍스트';
    replaceSel('[[' + url + '|' + label + ']]', 2 + url.length + 1, 2 + url.length + 1 + label.length);
  }
  function insertImg() {
    replaceSel('[[파일:https://example.com/image.png|width=400]]', 5, 5 + 28);
  }
  function insertVideo() {
    const sel = getSel();
    const input = (sel.text || '').trim();
    let url = input || prompt(
      '동영상 URL 또는 ID를 입력하세요.\n예: https://www.youtube.com/watch?v=dQw4w9WgXcQ\n     dQw4w9WgXcQ (유튜브 ID)\n     sm9 (니코니코)\n     BV1xx411x7xx (빌리빌리)\n     https://www.tiktok.com/@user/video/7012345678901234567\n     https://vimeo.com/76979871',
      ''
    );
    if (url == null) return;
    url = url.trim();
    if (!url) { replaceSel('[[유튜브:VIDEO_ID]]', 6, 6 + 8); return; }
    let kind = '유튜브';
    if (/nicovideo\.jp/i.test(url) || /^(?:sm|nm|so)\d+$/i.test(url)) kind = '니코니코';
    else if (/bilibili\.com/i.test(url) || /^BV[\w]+$/i.test(url) || /^av\d+$/i.test(url)) kind = '빌리빌리';
    else if (/tiktok\.com/i.test(url)) kind = '틱톡';
    else if (/vimeo\.com/i.test(url) || (/^\d+$/.test(url) && url.length >= 7 && url.length <= 10)) kind = '비메오';
    else if (/youtube\.com|youtu\.be/i.test(url) || /^[\w-]{6,}$/.test(url)) kind = '유튜브';
    replaceSel('[[' + kind + ':' + url + ']]');
  }
  function insertHeading(level) {
    const eq = '='.repeat(level);
    const sel = getSel();
    const t = sel.text || '제목';
    insertAtLineStart(eq + ' ' + t + ' ' + eq, level + 1, level + 1 + t.length);
  }
  function insertAtLineStart(insertion, selStart, selEnd) {
    const start = textarea.selectionStart;
    const v = textarea.value;
    let lineStart = v.lastIndexOf('\n', start - 1) + 1;
    const before = v.substring(0, lineStart);
    const lineRest = v.substring(lineStart);
    const lineEnd = lineRest.indexOf('\n');
    const currentLine = lineEnd === -1 ? lineRest : lineRest.substring(0, lineEnd);
    const after = lineEnd === -1 ? '' : lineRest.substring(lineEnd);
    const needsBlank = before && !before.endsWith('\n\n') && before.endsWith('\n') ? '' : (before ? '\n' : '');
    textarea.value = before + needsBlank + insertion + (currentLine.trim() ? '\n' + currentLine : '') + after;
    const cursorAt = (before + needsBlank).length + (selStart == null ? insertion.length : selStart);
    setSel(cursorAt, (before + needsBlank).length + (selEnd == null ? insertion.length : selEnd));
    textarea.dispatchEvent(new Event('input'));
  }
  function insertList(ordered) {
    const sel = getSel();
    const text = sel.text || '항목';
    const marker = ordered ? '1.' : '*';
    const lines = text.split('\n').map((l) => ' ' + marker + ' ' + (l || '항목')).join('\n');
    replaceSel('\n' + lines + '\n');
  }
  function insertTable() {
    replaceSel('\n||<:>\'\'\'헤더1\'\'\'||<:>\'\'\'헤더2\'\'\'||\n||내용 A||내용 B||\n||내용 C||내용 D||\n');
  }
  function insertQuote() {
    const sel = getSel();
    const text = sel.text || '인용문';
    const lines = text.split('\n').map((l) => '> ' + l).join('\n');
    replaceSel('\n' + lines + '\n');
  }
  function insertCode() {
    const sel = getSel();
    const code = sel.text || 'code';
    replaceSel('\n{{{\n' + code + '\n}}}\n');
  }
  function insertHr() { replaceSel('\n----\n'); }
  function insertToc() { replaceSel('[목차]'); }
  function insertFootnote() {
    const sel = getSel();
    const t = sel.text || '각주 내용';
    replaceSel('[* ' + t + ']', 3, 3 + t.length);
  }
  function insertCategory() {
    replaceSel('[[분류:이름]]', 5, 5 + 2);
  }

  if (toolbar) {
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-insert]');
      if (!btn) return;
      e.preventDefault();
      const k = btn.dataset.insert;
      switch (k) {
        case 'bold': insertWrap("'''", "'''", '굵게'); break;
        case 'italic': insertWrap("''", "''", '기울임'); break;
        case 'underline': insertWrap('__', '__', '밑줄'); break;
        case 'strike': insertWrap('~~', '~~', '취소선'); break;
        case 'h2': insertHeading(2); break;
        case 'link': insertLink(); break;
        case 'extlink': insertExtLink(); break;
        case 'img': insertImg(); break;
        case 'video': insertVideo(); break;
        case 'ul': insertList(false); break;
        case 'ol': insertList(true); break;
        case 'table': insertTable(); break;
        case 'quote': insertQuote(); break;
        case 'code': insertCode(); break;
        case 'hr': insertHr(); break;
        case 'toc': insertToc(); break;
        case 'footnote': insertFootnote(); break;
        case 'cat': insertCategory(); break;
      }
    });
  }

  // Delete button (POST to /delete/:title)
  const deleteBtn = document.getElementById('delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const action = form.action.split('?')[0];
      const title = decodeURIComponent(action.split('/edit/')[1] || '');
      if (!title) return;
      if (!confirm(`정말로 "${title}" 문서를 삭제하시겠습니까?\n모든 역사가 함께 삭제됩니다.`)) return;
      const f = document.createElement('form');
      f.method = 'post';
      f.action = '/delete/' + encodeURIComponent(title);
      document.body.appendChild(f);
      f.submit();
    });
  }
})();
