const express = require('express');
const path = require('path');

const namumark = require('./lib/namumark');
const store = require('./lib/storage');
const users = require('./lib/users');
const { sendSms } = require('./lib/sms');
const { layout, html, raw, escapeHtml, pageUrl, authorLink, isUserPage, USER_NS } = require('./lib/layout');
const { diffLines } = require('./lib/diff');
const sections = require('./lib/sections');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;
const HOST = '0.0.0.0';

app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Tiny cookie parser + session middleware ---
function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  h.split(';').forEach((p) => {
    const idx = p.indexOf('=');
    if (idx < 0) return;
    out[p.slice(0, idx).trim()] = decodeURIComponent(p.slice(idx + 1).trim());
  });
  return out;
}
app.use((req, res, next) => {
  const cookies = parseCookies(req);
  req.sid = cookies.sid || null;
  const sess = users.getSession(req.sid);
  req.currentUser = sess ? users.findUser(sess.phone) : null;
  next();
});

function send(res, body) { res.set('Content-Type', 'text/html; charset=utf-8'); res.send(body); }

// --- Block guard: 403 for any title-bearing route on a blocked page ---
const TITLE_ROUTE_RE = /^\/(?:w|edit|history|raw|discuss|Backlink|Contributions|move|diff)\/([^/?#]+)/;
app.use((req, res, next) => {
  const m = req.path.match(TITLE_ROUTE_RE);
  if (!m) return next();
  let title;
  try { title = decodeURIComponent(m[1]); } catch { return next(); }
  if (!store.isBlocked(title)) return next();
  res.status(403);
  const info = store.getBlockInfo(title) || {};
  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">접근이 차단된 문서</h1>
      </header>
      <div class="wiki-content">
        <p><strong>${title}</strong> 문서는 접근이 금지되어 있습니다.</p>
        ${info.reason ? raw(`<p class="muted">사유: ${escapeHtml(info.reason)}</p>`) : ''}
        ${info.at ? raw(`<p class="muted">차단 시각: ${new Date(info.at).toLocaleString('ko-KR')}</p>`) : ''}
        <p><a href="/">대문으로 돌아가기</a></p>
      </div>
    </article>`;
  send(res, layout({ title: '접근 차단', body, currentUser: req.currentUser }));
});

function getRequestOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// Replace section-edit placeholders with real URLs
function fillSectionLinks(html, title) {
  return html.replace(/\x00SECTIONEDIT(\d+)\x00/g, (_, i) =>
    `/edit/${encodeURIComponent(title)}?section=${i}`
  );
}

function notFoundPage(title, currentUser) {
  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">${title}</h1>
        <nav class="page-actions">
          <a href="/edit/${title}" class="btn btn-primary">이 문서 만들기</a>
        </nav>
      </header>
      <div class="page-meta">존재하지 않는 문서</div>
      <div class="wiki-content empty-content">
        <p><strong>${title}</strong> 문서는 아직 작성되지 않았습니다.</p>
        <p>위의 <a href="/edit/${title}">이 문서 만들기</a> 버튼을 눌러 새 문서를 작성할 수 있습니다.</p>
      </div>
    </article>`;
  return layout({ title, body, currentTitle: title, currentUser });
}

// Root → frontpage
app.get('/', (req, res) => res.redirect('/w/' + encodeURIComponent('대문')));

// View page
app.get('/w/:title', (req, res) => {
  const title = req.params.title;
  const requestedRev = req.query.rev ? parseInt(req.query.rev, 10) : null;

  const page = store.getPage(title);
  if (!page) return send(res, notFoundPage(title, req.currentUser));

  let rev;
  if (requestedRev) {
    rev = store.getRevision(title, requestedRev);
    if (!rev) return res.status(404).send('Revision not found');
  } else {
    rev = store.getRevision(title, page.currentRev);
  }

  const parsed = namumark.parse(rev.content, { autoToc: true });
  const renderedHtml = fillSectionLinks(parsed.html, title);
  const isOldRev = requestedRev && requestedRev !== page.currentRev;

  // Banner shown above 사용자: pages — links to the owner's contributions
  let userBanner = '';
  if (isUserPage(title)) {
    const userName = title.slice(USER_NS.length);
    const contribs = store.findContributions(userName);
    userBanner = html`
      <div class="user-banner">
        <strong>${userName}</strong> 님의 사용자 문서입니다.
        편집 ${contribs.length}회 ·
        <a href="/Contributions/${encodeURIComponent(userName)}">기여 목록 보기</a>
      </div>`;
  }

  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">${title}</h1>
        <nav class="page-actions">
          <a href="/edit/${title}">편집</a>
          <a href="/move/${title}">이동</a>
          <a href="/history/${title}">역사</a>
          <a href="/discuss/${title}">토론</a>
        </nav>
      </header>
      ${raw(userBanner)}
      <div class="page-meta">
        최근 수정: <a href="/history/${title}">${new Date(page.updatedAt).toLocaleString('ko-KR')}</a>
        · r${page.currentRev}
        · 작성자 ${raw(authorLink(rev.author))}
        ${isOldRev ? raw(html` · <span class="old-rev-badge">이 문서는 이전 판(r${requestedRev})입니다. <a href="/w/${title}">최신 판 보기</a></span>`) : ''}
      </div>
      <div class="wiki-content">${raw(renderedHtml)}</div>
      ${raw(parsed.categoriesHtml || '')}
    </article>`;

  send(res, layout({ title, body, currentTitle: title, currentUser: req.currentUser }));
});

// Raw text
app.get('/raw/:title', (req, res) => {
  const title = req.params.title;
  const page = store.getPage(title);
  if (!page) return res.status(404).type('text/plain').send('');
  const rev = req.query.rev ? store.getRevision(title, parseInt(req.query.rev, 10)) : store.getRevision(title, page.currentRev);
  if (!rev) return res.status(404).type('text/plain').send('');
  res.type('text/plain; charset=utf-8').send(rev.content);
});

// Edit form (whole page or single section)
app.get('/edit/:title', (req, res) => {
  const title = req.params.title;
  const page = store.getPage(title);
  const fullContent = page ? store.getCurrentContent(title) : '';
  const sectionIdx = req.query.section != null ? parseInt(req.query.section, 10) : null;
  const isSection = sectionIdx != null && !Number.isNaN(sectionIdx) && page;

  let content = fullContent;
  let sectionHead = null;
  if (isSection) {
    const heads = sections.findHeadings(fullContent).heads;
    if (sectionIdx >= 0 && sectionIdx < heads.length) {
      content = sections.extractSection(fullContent, sectionIdx) || '';
      sectionHead = heads[sectionIdx];
    } else {
      // fall back to whole page
    }
  }
  // Pre-fill from query (used by revert "되돌리기" in history page)
  if (req.query.rev) {
    const rev = store.getRevision(title, parseInt(req.query.rev, 10));
    if (rev) content = rev.content;
  }
  const isNew = !page;

  const titleLabel = isNew ? '새 문서: ' + title
    : sectionHead ? `${title} (섹션 편집: ${sectionHead.text})`
    : title + ' (편집)';

  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">${titleLabel}</h1>
        <nav class="page-actions">
          ${page ? raw(html`<a href="/move/${title}">이동</a>`) : ''}
          <a href="/w/${title}">취소</a>
        </nav>
      </header>

      <form id="editor-form" class="editor-form" method="post" action="/edit/${title}${isSection && sectionHead ? raw('?section=' + sectionIdx) : ''}">
        <div class="editor-tabs">
          <button type="button" class="tab active" data-tab="write">편집</button>
          <button type="button" class="tab" data-tab="preview">미리보기</button>
        </div>

        <div class="editor-toolbar" id="editor-toolbar">
          <button type="button" data-insert="bold" title="굵게 (Ctrl+B)"><b>B</b></button>
          <button type="button" data-insert="italic" title="기울임 (Ctrl+I)"><i>I</i></button>
          <button type="button" data-insert="underline" title="밑줄 (Ctrl+U)"><u>U</u></button>
          <button type="button" data-insert="strike" title="취소선">S</button>
          <span class="tb-sep"></span>
          <button type="button" data-insert="h2" title="제목">H</button>
          <button type="button" data-insert="link" title="내부 링크 (Ctrl+K)">🔗</button>
          <button type="button" data-insert="extlink" title="외부 링크">↗</button>
          <button type="button" data-insert="img" title="이미지">🖼</button>
          <button type="button" data-insert="video" title="동영상 (유튜브 / 니코니코 / 빌리빌리 / 틱톡 / 비메오)">🎬</button>
          <span class="tb-sep"></span>
          <button type="button" data-insert="ul" title="목록">•</button>
          <button type="button" data-insert="ol" title="번호 목록">1.</button>
          <button type="button" data-insert="table" title="표">⊞</button>
          <button type="button" data-insert="quote" title="인용">❝</button>
          <button type="button" data-insert="code" title="코드 블록">{}</button>
          <button type="button" data-insert="hr" title="가로줄">—</button>
          <span class="tb-sep"></span>
          <button type="button" data-insert="toc" title="목차">[목차]</button>
          <button type="button" data-insert="footnote" title="각주">[*]</button>
          <button type="button" data-insert="cat" title="분류">📂</button>
        </div>

        <div class="editor-pane" data-pane="write">
          <textarea id="content" name="content" rows="22" placeholder="나무마크 문법으로 작성하세요...">${content}</textarea>
        </div>
        <div class="editor-pane hidden" data-pane="preview">
          <div id="preview" class="wiki-content preview-content"><em>미리보기를 불러옵니다...</em></div>
        </div>

        <div class="editor-meta">
          <label>편집 요약
            <input type="text" name="comment" maxlength="200" placeholder="이 편집의 요약을 한 줄로..." value="${req.query.rev ? '판 r' + req.query.rev + '으로 되돌림' : (sectionHead ? '/* ' + sectionHead.text + ' */ ' : '')}" />
          </label>
          <label>작성자
            <input type="text" name="author" maxlength="40" placeholder="Anonymous" />
          </label>
        </div>

        <div class="editor-actions">
          <button type="submit" class="btn btn-primary">저장</button>
          <a href="/w/${title}" class="btn">취소</a>
          ${page && !isSection ? raw(html`<button type="button" id="delete-btn" class="btn btn-danger">삭제</button>`) : ''}
        </div>
      </form>

      <details class="syntax-help">
        <summary>나무마크 빠른 도움말</summary>
        <ul>
          <li><code>== 제목 ==</code> · <code>'''굵게'''</code> · <code>''기울임''</code> · <code>__밑줄__</code> · <code>~~취소선~~</code></li>
          <li><code>[[문서명]]</code> · <code>[[문서명#섹션|표시]]</code> · <code>[[https://...|외부]]</code> · <code>[[파일:URL|width=300]]</code></li>
          <li><code>[[유튜브:dQw4w9WgXcQ]]</code> · <code>[[니코니코:sm9]]</code> · <code>[[빌리빌리:BV1xx411x7xx]]</code> · <code>[[틱톡:7012345678901234567]]</code> · <code>[[비메오:76979871]]</code></li>
          <li><code>&nbsp;* 항목</code> · <code>&nbsp;1. 항목</code> · <code>||셀||셀||</code></li>
          <li><code>&gt; 인용</code> · <code>----</code> 가로줄 · <code>{{{ ... }}}</code> 코드 블록 · <code>{{{#!folding 제목 ... }}}</code> 접기</li>
          <li><code>{{{#red 색깔}}}</code> · <code>[목차]</code> · <code>[* 각주]</code> · <code>[[분류:이름]]</code></li>
        </ul>
      </details>
    </article>`;

  send(res, layout({ title: isNew ? `${title} 만들기` : `${title} 편집`, body, currentTitle: title, bodyClass: 'mode-edit', currentUser: req.currentUser }));
});

// Save edit (whole page or single section)
app.post('/edit/:title', (req, res) => {
  const title = req.params.title;
  const submitted = String(req.body.content || '');
  const author = String(req.body.author || '').trim() || 'Anonymous';
  const comment = String(req.body.comment || '').trim();
  const sectionIdx = req.query.section != null ? parseInt(req.query.section, 10) : null;

  let finalContent = submitted;
  if (sectionIdx != null && !Number.isNaN(sectionIdx)) {
    const page = store.getPage(title);
    if (page) {
      const fullContent = store.getCurrentContent(title) || '';
      finalContent = sections.replaceSection(fullContent, sectionIdx, submitted);
    }
  }
  store.saveRevision(title, finalContent, author, comment, req.ip);
  res.redirect('/w/' + encodeURIComponent(title));
});

// One-click revert: copies a previous revision's content as a new revision
app.post('/revert/:title', (req, res) => {
  const title = req.params.title;
  const targetRev = parseInt(req.body.rev, 10);
  if (!targetRev) return res.redirect('/history/' + encodeURIComponent(title));
  const rev = store.getRevision(title, targetRev);
  if (!rev) return res.redirect('/history/' + encodeURIComponent(title));
  const author = String(req.body.author || '').trim() || 'Anonymous';
  store.saveRevision(title, rev.content, author, `판 r${targetRev}으로 되돌림`, req.ip);
  res.redirect('/w/' + encodeURIComponent(title));
});

// Delete page
app.post('/delete/:title', (req, res) => {
  store.deletePage(req.params.title);
  res.redirect('/');
});

// History
app.get('/history/:title', (req, res) => {
  const title = req.params.title;
  const page = store.getPage(title);
  if (!page) return send(res, notFoundPage(title, req.currentUser));
  const revs = store.getRevisions(title).slice().reverse();

  const rows = revs.map((r) => html`
    <tr>
      <td><label><input type="radio" name="from" value="${r.rev}" /></label></td>
      <td><label><input type="radio" name="to" value="${r.rev}" /></label></td>
      <td><a href="/w/${title}?rev=${r.rev}">r${r.rev}</a></td>
      <td>${new Date(r.createdAt).toLocaleString('ko-KR')}</td>
      <td>${raw(authorLink(r.author))}</td>
      <td class="delta ${raw(r.delta >= 0 ? 'pos' : 'neg')}">${(r.delta >= 0 ? '+' : '') + r.delta}</td>
      <td>${r.comment}</td>
      <td class="row-actions">
        <a href="/raw/${title}?rev=${r.rev}">원본</a>
        ${r.rev !== page.currentRev ? raw(html`
          <form method="post" action="/revert/${title}" class="inline-form" onsubmit="return confirm('판 r${r.rev}의 내용으로 되돌립니다. 새 판으로 기록됩니다. 계속할까요?');">
            <input type="hidden" name="rev" value="${r.rev}" />
            <button type="submit" class="link-btn">되돌리기</button>
          </form>`) : ''}
      </td>
    </tr>`);

  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">${title} (역사)</h1>
        <nav class="page-actions">
          <a href="/w/${title}">읽기</a>
          <a href="/edit/${title}">편집</a>
        </nav>
      </header>
      <form method="get" action="/diff/${title}" class="history-form">
        <table class="history-table">
          <thead>
            <tr><th>From</th><th>To</th><th>판</th><th>시각</th><th>작성자</th><th>변화량</th><th>요약</th><th></th></tr>
          </thead>
          <tbody>${raw(rows.map((r) => r.value || r).join(''))}</tbody>
        </table>
        <div class="history-actions">
          <button type="submit" class="btn btn-primary">선택한 두 판 비교</button>
        </div>
      </form>
    </article>`;

  send(res, layout({ title: title + ' 역사', body, currentTitle: title, currentUser: req.currentUser }));
});

// Diff
app.get('/diff/:title', (req, res) => {
  const title = req.params.title;
  const from = parseInt(req.query.from, 10);
  const to = parseInt(req.query.to, 10);
  if (!from || !to) return res.redirect('/history/' + encodeURIComponent(title));

  const a = store.getRevision(title, Math.min(from, to));
  const b = store.getRevision(title, Math.max(from, to));
  if (!a || !b) return res.status(404).send('Revision not found');

  const ops = diffLines(a.content, b.content);
  const rows = ops.map((op) => {
    const cls = op.op === '+' ? 'd-add' : op.op === '-' ? 'd-del' : 'd-eq';
    const sign = op.op === '+' ? '+' : op.op === '-' ? '-' : ' ';
    return `<tr class="${cls}"><td class="ln">${op.a || ''}</td><td class="ln">${op.b || ''}</td><td class="sg">${sign}</td><td class="ln-text">${escapeHtml(op.line)}</td></tr>`;
  }).join('');

  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">${title} 비교 (r${a.rev} → r${b.rev})</h1>
        <nav class="page-actions">
          <a href="/history/${title}">역사로 돌아가기</a>
          <a href="/w/${title}">읽기</a>
        </nav>
      </header>
      <div class="diff-meta">
        <div><strong>r${a.rev}</strong> · ${new Date(a.createdAt).toLocaleString('ko-KR')} · ${a.author} · ${a.comment}</div>
        <div><strong>r${b.rev}</strong> · ${new Date(b.createdAt).toLocaleString('ko-KR')} · ${b.author} · ${b.comment}</div>
      </div>
      <table class="diff-table"><tbody>${raw(rows)}</tbody></table>
    </article>`;

  send(res, layout({ title: title + ' 비교', body, currentTitle: title, currentUser: req.currentUser }));
});

// Recent changes
app.get('/RecentChanges', (req, res) => {
  const changes = store.recentChanges(200);
  const rows = changes.map((c) => `
    <tr>
      <td>${new Date(c.createdAt).toLocaleString('ko-KR')}</td>
      <td><a href="/w/${encodeURIComponent(c.title)}">${escapeHtml(c.title)}</a> <a class="rev-link" href="/w/${encodeURIComponent(c.title)}?rev=${c.rev}">(r${c.rev})</a></td>
      <td>${authorLink(c.author)}</td>
      <td class="delta ${c.delta >= 0 ? 'pos' : 'neg'}">${(c.delta >= 0 ? '+' : '') + c.delta}</td>
      <td>${escapeHtml(c.comment || '')}</td>
    </tr>`).join('');

  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">최근 변경</h1>
      </header>
      <table class="changes-table">
        <thead><tr><th>시각</th><th>문서</th><th>작성자</th><th>변화량</th><th>요약</th></tr></thead>
        <tbody>${raw(rows)}</tbody>
      </table>
    </article>`;

  send(res, layout({ title: '최근 변경', body, currentUser: req.currentUser }));
});

// Random
app.get('/RandomPage', (req, res) => {
  const t = store.randomTitle();
  if (!t) return res.redirect('/');
  res.redirect('/w/' + encodeURIComponent(t));
});

// All pages
app.get('/AllPages', (req, res) => {
  const pages = store.listPages();
  const items = pages.map((p) => `<li><a href="/w/${encodeURIComponent(p.title)}">${escapeHtml(p.title)}</a> <span class="meta">· r${p.currentRev} · ${new Date(p.updatedAt).toLocaleDateString('ko-KR')}</span></li>`).join('');
  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">모든 문서 (${pages.length})</h1>
      </header>
      <ul class="page-list">${raw(items)}</ul>
    </article>`;
  send(res, layout({ title: '모든 문서', body, currentUser: req.currentUser }));
});

// Search
app.get('/Search', (req, res) => {
  const q = String(req.query.q || '').trim();
  // Exact title match → go to that page
  if (q && store.getPage(q)) return res.redirect('/w/' + encodeURIComponent(q));
  const results = q ? store.searchPages(q) : [];
  const items = results.map((r) => `
    <li>
      <a class="result-title" href="/w/${encodeURIComponent(r.title)}">${escapeHtml(r.title)}</a>
      ${r.snippet ? `<div class="result-snippet">${escapeHtml(r.snippet)}</div>` : ''}
    </li>`).join('');
  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">검색: ${q || '(질의 없음)'}</h1>
      </header>
      ${q && results.length === 0 ? raw(`<p>일치하는 문서가 없습니다. <a href="/edit/${encodeURIComponent(q)}">"${escapeHtml(q)}" 문서를 만들기</a>.</p>`) : raw('')}
      ${results.length > 0 ? raw(`<p>${results.length}개의 결과</p><ul class="search-results">${items}</ul>`) : raw('')}
    </article>`;
  send(res, layout({ title: '검색', body, currentUser: req.currentUser }));
});

// Backlinks
app.get('/Backlink/:title', (req, res) => {
  const title = req.params.title;
  const links = store.findBacklinks(title);
  const items = links.length === 0
    ? '<li class="muted">이 문서를 가리키는 다른 문서가 없습니다.</li>'
    : links.map((t) => `<li><a href="/w/${encodeURIComponent(t)}">${escapeHtml(t)}</a></li>`).join('');
  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">${title} (역링크)</h1>
        <nav class="page-actions"><a href="/w/${title}">읽기</a></nav>
      </header>
      <ul class="page-list">${raw(items)}</ul>
    </article>`;
  send(res, layout({ title: title + ' 역링크', body, currentTitle: title, currentUser: req.currentUser }));
});

// Category
app.get('/Category/:name', (req, res) => {
  const cat = req.params.name;
  const members = store.findCategoryMembers(cat);
  const items = members.length === 0
    ? '<li class="muted">이 분류에 속한 문서가 없습니다.</li>'
    : members.map((t) => `<li><a href="/w/${encodeURIComponent(t)}">${escapeHtml(t)}</a></li>`).join('');
  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">분류: ${cat}</h1>
      </header>
      <p>이 분류에 속한 문서: ${members.length}개</p>
      <ul class="page-list">${raw(items)}</ul>
    </article>`;
  send(res, layout({ title: '분류:' + cat, body, currentUser: req.currentUser }));
});

// ===== Move (rename) page =====

app.get('/move/:title', (req, res) => {
  if (!req.currentUser) {
    return res.redirect('/login?err=' + encodeURIComponent('문서 이동은 로그인이 필요합니다.'));
  }
  const title = req.params.title;
  const page = store.getPage(title);
  if (!page) return send(res, notFoundPage(title, req.currentUser));

  const err = req.query.err ? escapeHtml(String(req.query.err)) : '';
  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">${title} 이동</h1>
        <nav class="page-actions">
          <a href="/w/${title}">취소</a>
        </nav>
      </header>
      ${err ? raw(`<div class="auth-error">${err}</div>`) : ''}
      <div class="wiki-content">
        <p>현재 제목: <strong>${title}</strong></p>
        <p class="muted">문서를 새 제목으로 이동(이름 변경)합니다. 모든 편집 역사와 토론이 새 제목으로 함께 옮겨집니다.</p>
        <form method="post" action="/move/${title}" class="auth-form" autocomplete="off" style="max-width:560px;">
          <label class="auth-label">새 제목</label>
          <input name="newTitle" type="text" required maxlength="200" placeholder="새 문서 제목" value="${req.query.to ? escapeHtml(String(req.query.to)) : ''}" />
          <div class="auth-hint">이미 존재하는 제목으로는 이동할 수 없습니다.</div>

          <label class="auth-label" style="margin-top:14px;">
            <input type="checkbox" name="block" value="1" />
            원래 제목(<code>${title}</code>)에 대한 접근을 차단합니다
          </label>
          <div class="auth-hint">체크하면 이전 제목으로 접근할 수 없게 됩니다.</div>

          <button type="submit" class="auth-submit" style="margin-top:14px;">이동하기</button>
        </form>
      </div>
    </article>`;
  send(res, layout({ title: title + ' 이동', body, currentTitle: title, currentUser: req.currentUser }));
});

app.post('/move/:title', (req, res) => {
  if (!req.currentUser) {
    return res.redirect('/login?err=' + encodeURIComponent('문서 이동은 로그인이 필요합니다.'));
  }
  const oldTitle = req.params.title;
  const newTitle = String(req.body.newTitle || '').trim();
  const block = req.body.block === '1' || req.body.block === 'on';
  try {
    store.movePage(oldTitle, newTitle, req.currentUser.phone, req.ip || '');
    if (block) {
      store.blockPage(oldTitle, {
        reason: '문서 이동에 따라 차단됨',
        movedTo: newTitle,
        by: req.currentUser.phone,
      });
    }
    res.redirect('/w/' + encodeURIComponent(newTitle));
  } catch (e) {
    const url = '/move/' + encodeURIComponent(oldTitle) +
      '?err=' + encodeURIComponent(e.message) +
      '&to=' + encodeURIComponent(newTitle);
    res.redirect(url);
  }
});

// ===== Signup / Login =====

function authPage(opts) {
  // Shared layout for signup/login pages
  return layout({
    title: opts.title,
    body: opts.body,
    currentTitle: null,
    bodyClass: 'auth-page',
    currentUser: opts.currentUser,
  });
}

// Signup form
app.get('/signup', (req, res) => {
  if (req.currentUser) return res.redirect('/w/' + encodeURIComponent(USER_NS + req.currentUser.phone));
  const err = req.query.err ? escapeHtml(String(req.query.err)) : '';
  const body = html`
    <article class="auth-card">
      <h1>회원가입</h1>
      <p class="muted">전화번호를 <strong>국가번호 포함</strong>으로 입력하세요. (예: <code>+821012345678</code>)<br/>
        비밀번호는 자동으로 생성되며 <strong>가입 완료 후에는 다시 볼 수 없으니 꼭 저장</strong>하세요.</p>
      ${err ? raw(`<div class="auth-error">${err}</div>`) : ''}
      <form method="post" action="/signup" class="auth-form" autocomplete="off">
        <label class="auth-label">전화번호 (국가번호 포함)</label>
        <input id="signup-phone" name="phone" type="tel" inputmode="tel"
          placeholder="+821012345678" required pattern="^\\+[1-9][0-9]{7,14}$" />
        <div class="auth-hint" id="phone-hint">예: +821012345678 (한국), +14155552671 (미국)</div>

        <label class="auth-label">자동 생성된 비밀번호</label>
        <div class="pw-row">
          <input id="signup-password" name="password" type="text" readonly required />
          <button type="button" id="pw-regen" title="비밀번호 다시 생성">🔄</button>
        </div>
        <div class="auth-hint">필드를 클릭해 복사해두세요. 가입 후에는 표시되지 않습니다.</div>

        <button type="submit" class="auth-submit">인증 문자 받기</button>
      </form>
      <p class="auth-foot">이미 계정이 있나요? <a href="/login">로그인</a></p>
    </article>`;
  send(res, authPage({ title: '회원가입', body, currentUser: req.currentUser }));
});

// Receive signup → create pending → "send" SMS
app.post('/signup', (req, res) => {
  const phone = users.normalizePhone(req.body.phone);
  const password = String(req.body.password || '');

  if (!users.isValidPhone(phone)) {
    return res.redirect('/signup?err=' + encodeURIComponent('전화번호 형식이 올바르지 않습니다. 국가번호(+)를 포함한 8~15자리 숫자여야 합니다.'));
  }
  if (password.length < 8) {
    return res.redirect('/signup?err=' + encodeURIComponent('비밀번호가 비어 있거나 너무 짧습니다.'));
  }
  if (users.findUser(phone)) {
    return res.redirect('/signup?err=' + encodeURIComponent('이미 가입된 전화번호입니다.'));
  }

  const token = users.createPendingSignup(phone, password);
  const verifyUrl = `${getRequestOrigin(req)}/verify?token=${token}`;
  // Per spec, the SMS body must be exactly the question. The link follows on a second line
  // so the recipient can actually act on it.
  const smsBody = `회원가입하시겠습니까?\n${verifyUrl}`;
  sendSms(phone, smsBody);

  const body = html`
    <article class="auth-card">
      <h1>인증 문자를 보냈습니다</h1>
      <p><strong>${phone}</strong> 번호로 인증 문자를 발송했습니다.<br/>
         문자 내용: <em>"회원가입하시겠습니까?"</em></p>
      <p class="muted">문자에 포함된 링크를 눌러 가입을 완료하세요. 인증 링크는 10분 동안 유효합니다.</p>
      <div class="dev-note">
        <strong>개발 모드 안내</strong><br/>
        실제 SMS 발송에는 외부 서비스 연동이 필요합니다. 현재는 서버 콘솔에 문자 내용이 출력되며,
        아래 링크로 직접 인증을 진행할 수 있습니다.
        <p><a class="auth-submit" href="/verify?token=${token}">인증 페이지로 이동</a></p>
      </div>
      <p class="auth-foot"><a href="/signup">다른 번호로 다시 시도</a></p>
    </article>`;
  send(res, authPage({ title: '인증 대기', body, currentUser: req.currentUser }));
});

// Verification page — shows the question, awaits confirm click
app.get('/verify', (req, res) => {
  const token = String(req.query.token || '');
  const pending = users.getPendingSignup(token);
  if (!pending) {
    const body = html`
      <article class="auth-card">
        <h1>유효하지 않은 인증 링크</h1>
        <p class="muted">인증 링크가 만료되었거나 잘못되었습니다. 다시 가입을 시도해주세요.</p>
        <p><a class="auth-submit" href="/signup">회원가입으로 돌아가기</a></p>
      </article>`;
    return send(res, authPage({ title: '인증 실패', body, currentUser: req.currentUser }));
  }
  const body = html`
    <article class="auth-card">
      <h1>회원가입하시겠습니까?</h1>
      <p>전화번호 <strong>${pending.phone}</strong> 로 가입을 완료합니다.</p>
      <form method="post" action="/verify">
        <input type="hidden" name="token" value="${token}" />
        <button type="submit" class="auth-submit">예, 가입할게요</button>
      </form>
      <p class="auth-foot"><a href="/signup">아니요, 취소</a></p>
    </article>`;
  send(res, authPage({ title: '인증 확인', body, currentUser: req.currentUser }));
});

// Confirm verification → create user + user document + session
app.post('/verify', (req, res) => {
  const token = String(req.body.token || '');
  const pending = users.consumePendingSignup(token);
  if (!pending) {
    return res.redirect('/signup?err=' + encodeURIComponent('인증 링크가 만료되었습니다. 다시 시도해주세요.'));
  }
  if (users.findUser(pending.phone)) {
    return res.redirect('/login?err=' + encodeURIComponent('이미 가입된 전화번호입니다. 로그인해주세요.'));
  }

  // 1) Create the account
  users.createUser(pending.phone, pending.passwordHash);

  // 2) Auto-create the 사용자: document
  const userTitle = USER_NS + pending.phone;
  if (!store.getPage(userTitle)) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
    const content =
`= ${userTitle} =
이 문서는 '''${pending.phone}''' 사용자의 사용자 문서입니다.

== 정보 ==
 * 가입일: ${dateStr}
 * 전화번호: ${pending.phone}

== 소개 ==
이 사용자가 자신을 소개하기 위한 공간입니다. [[${userTitle}|편집]]하여 자유롭게 작성해보세요.

[[분류:사용자]]
`;
    store.saveRevision(userTitle, content, pending.phone, '사용자 문서 자동 생성', req.ip || '');
  }

  // 3) Issue a session cookie so they're logged in immediately
  const sid = users.createSession(pending.phone);
  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
  res.redirect('/w/' + encodeURIComponent(userTitle));
});

// Login
app.get('/login', (req, res) => {
  if (req.currentUser) return res.redirect('/w/' + encodeURIComponent(USER_NS + req.currentUser.phone));
  const err = req.query.err ? escapeHtml(String(req.query.err)) : '';
  const body = html`
    <article class="auth-card">
      <h1>로그인</h1>
      ${err ? raw(`<div class="auth-error">${err}</div>`) : ''}
      <form method="post" action="/login" class="auth-form" autocomplete="off">
        <label class="auth-label">전화번호 (국가번호 포함)</label>
        <input name="phone" type="tel" placeholder="+821012345678" required />

        <label class="auth-label">비밀번호</label>
        <input name="password" type="password" required />

        <button type="submit" class="auth-submit">로그인</button>
      </form>
      <p class="auth-foot">계정이 없나요? <a href="/signup">회원가입</a></p>
    </article>`;
  send(res, authPage({ title: '로그인', body, currentUser: req.currentUser }));
});

app.post('/login', (req, res) => {
  const phone = users.normalizePhone(req.body.phone);
  const password = String(req.body.password || '');
  const user = users.findUser(phone);
  if (!user || !users.verifyPassword(password, user.passwordHash)) {
    return res.redirect('/login?err=' + encodeURIComponent('전화번호 또는 비밀번호가 올바르지 않습니다.'));
  }
  const sid = users.createSession(user.phone);
  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
  res.redirect('/w/' + encodeURIComponent(USER_NS + user.phone));
});

app.post('/logout', (req, res) => {
  if (req.sid) users.deleteSession(req.sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.redirect('/');
});

// User contributions — list every revision a given author made
app.get('/Contributions/:user', (req, res) => {
  const user = req.params.user;
  const contribs = store.findContributions(user);
  const userPage = USER_NS + user;
  const rows = contribs.map((c) => `
    <tr>
      <td>${new Date(c.createdAt).toLocaleString('ko-KR')}</td>
      <td><a href="/w/${encodeURIComponent(c.title)}">${escapeHtml(c.title)}</a> <a class="rev-link" href="/w/${encodeURIComponent(c.title)}?rev=${c.rev}">(r${c.rev})</a></td>
      <td class="delta ${c.delta >= 0 ? 'pos' : 'neg'}">${(c.delta >= 0 ? '+' : '') + c.delta}</td>
      <td>${escapeHtml(c.comment || '')}</td>
    </tr>`).join('');

  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">${user} 님의 기여</h1>
        <nav class="page-actions">
          <a href="/w/${userPage}">사용자 문서</a>
          <a href="/UserList">사용자 목록</a>
        </nav>
      </header>
      <p class="muted">${user === 'Anonymous'
        ? '익명 사용자가 남긴 모든 편집입니다.'
        : raw(`<strong>${escapeHtml(user)}</strong> 님이 지금까지 남긴 모든 편집입니다.`)} 총 ${contribs.length}회.</p>
      ${contribs.length === 0
        ? raw('<p class="muted">아직 이 사용자가 남긴 편집이 없습니다.</p>')
        : raw(`<table class="changes-table">
            <thead><tr><th>시각</th><th>문서</th><th>변화량</th><th>요약</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`)}
    </article>`;

  send(res, layout({ title: user + ' 기여', body, currentTitle: userPage, currentUser: req.currentUser }));
});

// User list — every author with edit count, sorted by edits desc
app.get('/UserList', (req, res) => {
  const users = store.listAuthors();
  const items = users.length === 0
    ? '<li class="muted">아직 편집한 사용자가 없습니다.</li>'
    : users.map((u) => {
        const isAnon = u.author === 'Anonymous';
        const userLink = isAnon
          ? `<span>${escapeHtml(u.author)}</span>`
          : `<a href="/w/${encodeURIComponent(USER_NS + u.author)}">${escapeHtml(u.author)}</a>`;
        return `<li>
          ${userLink}
          <span class="meta">· ${u.edits}회 편집 · 최근 ${new Date(u.lastEdit).toLocaleDateString('ko-KR')}</span>
          · <a href="/Contributions/${encodeURIComponent(u.author)}">기여</a>
        </li>`;
      }).join('');

  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">사용자 목록 (${users.length})</h1>
      </header>
      <p class="muted">이 위키에 한 번이라도 편집한 모든 사용자입니다. 편집 횟수가 많은 순서로 정렬됩니다.</p>
      <ul class="page-list">${raw(items)}</ul>
    </article>`;
  send(res, layout({ title: '사용자 목록', body, currentUser: req.currentUser }));
});

// Discuss (basic threaded comments)
app.get('/discuss/:title', (req, res) => {
  const title = req.params.title;
  const messages = store.getDiscussion(title);
  const items = messages.length === 0
    ? '<li class="muted">아직 작성된 토론이 없습니다. 첫 의견을 남겨보세요.</li>'
    : messages.map((m) => `
      <li class="comment">
        <div class="comment-meta"><strong>${authorLink(m.author)}</strong> · ${new Date(m.createdAt).toLocaleString('ko-KR')}</div>
        <div class="comment-body">${escapeHtml(m.content).replace(/\n/g, '<br/>')}</div>
      </li>`).join('');

  const body = html`
    <article class="page">
      <header class="page-header">
        <h1 class="page-title">${title} (토론)</h1>
        <nav class="page-actions"><a href="/w/${title}">읽기</a></nav>
      </header>
      <ul class="comments">${raw(items)}</ul>
      <form method="post" action="/discuss/${title}" class="comment-form">
        <input type="text" name="author" placeholder="이름 (Anonymous)" maxlength="40" />
        <textarea name="content" placeholder="의견을 남겨주세요..." rows="4" required></textarea>
        <button type="submit" class="btn btn-primary">의견 작성</button>
      </form>
    </article>`;
  send(res, layout({ title: title + ' 토론', body, currentTitle: title, currentUser: req.currentUser }));
});

app.post('/discuss/:title', (req, res) => {
  const title = req.params.title;
  const author = String(req.body.author || '').trim() || 'Anonymous';
  const content = String(req.body.content || '').trim();
  if (content) store.addComment(title, author, content, req.ip);
  res.redirect('/discuss/' + encodeURIComponent(title));
});

// Live preview API for editor
app.post('/api/preview', (req, res) => {
  const text = String(req.body.content || '');
  const parsed = namumark.parse(text, { autoToc: false });
  // Section-edit links inside preview don't navigate anywhere useful — strip them
  const cleaned = parsed.html.replace(/\x00SECTIONEDIT\d+\x00/g, '#');
  res.json({ html: cleaned + (parsed.categoriesHtml || '') });
});

// Generic 404
app.use((req, res) => {
  res.status(404).type('text/html; charset=utf-8').send(layout({
    title: '404',
    body: '<article class="page"><h1 class="page-title">404 — 페이지를 찾을 수 없습니다</h1><p><a href="/">대문으로 돌아가기</a></p></article>',
    currentUser: req.currentUser,
  }));
});

app.listen(PORT, HOST, () => {
  console.log(`Liveswiki running at http://${HOST}:${PORT}`);
});
