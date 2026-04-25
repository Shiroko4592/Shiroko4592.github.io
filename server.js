const express = require('express');
const path = require('path');

const namumark = require('./lib/namumark');
const store = require('./lib/storage');
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

function send(res, body) { res.set('Content-Type', 'text/html; charset=utf-8'); res.send(body); }

// Replace section-edit placeholders with real URLs
function fillSectionLinks(html, title) {
  return html.replace(/\x00SECTIONEDIT(\d+)\x00/g, (_, i) =>
    `/edit/${encodeURIComponent(title)}?section=${i}`
  );
}

function notFoundPage(title) {
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
  return layout({ title, body, currentTitle: title });
}

// Root → frontpage
app.get('/', (req, res) => res.redirect('/w/' + encodeURIComponent('대문')));

// View page
app.get('/w/:title', (req, res) => {
  const title = req.params.title;
  const requestedRev = req.query.rev ? parseInt(req.query.rev, 10) : null;

  const page = store.getPage(title);
  if (!page) return send(res, notFoundPage(title));

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

  send(res, layout({ title, body, currentTitle: title }));
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

  send(res, layout({ title: isNew ? `${title} 만들기` : `${title} 편집`, body, currentTitle: title, bodyClass: 'mode-edit' }));
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
  if (!page) return send(res, notFoundPage(title));
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

  send(res, layout({ title: title + ' 역사', body, currentTitle: title }));
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

  send(res, layout({ title: title + ' 비교', body, currentTitle: title }));
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

  send(res, layout({ title: '최근 변경', body }));
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
  send(res, layout({ title: '모든 문서', body }));
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
  send(res, layout({ title: '검색', body }));
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
  send(res, layout({ title: title + ' 역링크', body, currentTitle: title }));
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
  send(res, layout({ title: '분류:' + cat, body }));
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

  send(res, layout({ title: user + ' 기여', body, currentTitle: userPage }));
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
  send(res, layout({ title: '사용자 목록', body }));
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
  send(res, layout({ title: title + ' 토론', body, currentTitle: title }));
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
  }));
});

app.listen(PORT, HOST, () => {
  console.log(`Liveswiki running at http://${HOST}:${PORT}`);
});
