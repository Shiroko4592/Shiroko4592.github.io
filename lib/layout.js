const store = require('./storage');

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function raw(value) {
  return { __raw: true, value: String(value == null ? '' : value) };
}

function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) {
      const v = values[i];
      if (v == null || v === false) {
        out += '';
      } else if (Array.isArray(v)) {
        out += v.map((x) => (x && x.__raw) ? x.value : escapeHtml(x)).join('');
      } else if (v && v.__raw) {
        out += v.value;
      } else {
        out += escapeHtml(v);
      }
    }
  });
  return out;
}

function pageUrl(title) {
  return '/w/' + encodeURIComponent(title);
}

const USER_NS = '사용자:';

function isUserPage(title) {
  return typeof title === 'string' && title.startsWith(USER_NS);
}

function userPageTitle(name) {
  return USER_NS + name;
}

function authorLink(name) {
  const n = String(name || '').trim();
  if (!n || n === 'Anonymous') return escapeHtml(n || 'Anonymous');
  const safe = escapeHtml(n);
  const enc = encodeURIComponent(USER_NS + n);
  const contribEnc = encodeURIComponent(n);
  return `<a class="user-link" href="/w/${enc}">${safe}</a>` +
    ` <a class="user-contrib" href="/Contributions/${contribEnc}" title="${safe}의 기여">(기여)</a>`;
}

function formatRecentTime(iso) {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  } catch (e) {
    return '';
  }
}

function renderRecentSidebar() {
  let items = [];
  try {
    items = store.recentChanges(10) || [];
  } catch (e) {
    items = [];
  }
  const lis = items.map((it) => {
    const t = it.title || '';
    const time = formatRecentTime(it.time || it.updatedAt);
    return html`<li><span class="recent-time">[${time}]</span> <a href="/w/${t}">${t}</a></li>`;
  }).join('');
  return html`
    <div class="liberty-sidebar">
      <div class="live-recent">
        <div class="live-recent-header">
          <ul class="nav-tabs">
            <li class="active">최근 변경</li>
          </ul>
        </div>
        <div class="live-recent-content">
          <ul class="live-recent-list">
            ${raw(lis || '<li class="recent-empty">최근 변경된 문서가 없습니다.</li>')}
          </ul>
        </div>
        <div class="live-recent-footer">
          <a href="/RecentChanges"><span class="label-info">더 보기</span></a>
        </div>
      </div>
    </div>`;
}

function layout({ title, body, currentTitle, headExtra, bodyClass, currentUser }) {
  const userTool = isUserPage(currentTitle)
    ? html`<a class="dd-item" href="/Contributions/${encodeURIComponent(currentTitle.slice(USER_NS.length))}">기여 보기</a>`
    : '';

  const docTools = currentTitle
    ? html`
        <div class="dd-section-title">문서 도구</div>
        <a class="dd-item" href="/w/${currentTitle}">읽기</a>
        <a class="dd-item" href="/edit/${currentTitle}">편집</a>
        <a class="dd-item" href="/move/${currentTitle}">이동</a>
        <a class="dd-item" href="/history/${currentTitle}">역사</a>
        <a class="dd-item" href="/discuss/${currentTitle}">토론</a>
        <a class="dd-item" href="/Backlink/${currentTitle}">역링크</a>
        <a class="dd-item" href="/raw/${currentTitle}">원본</a>
        ${raw(userTool)}
        <div class="dd-divider"></div>`
    : '';

  const userMenu = currentUser
    ? html`
        <div class="dd-section-title">${currentUser.displayName || currentUser.phone}</div>
        <a class="dd-item" href="/w/${USER_NS + (currentUser.displayName || currentUser.phone)}">내 사용자 문서</a>
        <a class="dd-item" href="/Contributions/${encodeURIComponent(currentUser.displayName || currentUser.phone)}">내 기여</a>
        <div class="dd-divider"></div>
        <form method="post" action="/logout" class="dd-form">
          <button type="submit" class="dd-item dd-btn">로그아웃</button>
        </form>`
    : html`
        <a class="dd-item" href="/login">로그인</a>
        <a class="dd-item" href="/signup">회원가입</a>`;

  const recentSidebar = renderRecentSidebar();

  return html`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} - 리브위키</title>
<meta name="theme-color" content="#4188f1" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%234188f1'/%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' font-family='Arial' font-size='34' font-weight='700' fill='white'%3EL%3C/text%3E%3C/svg%3E" />
<link rel="stylesheet" href="/style.css" />
${raw(headExtra || '')}
</head>
<body class="${bodyClass || ''}">
<div id="app" class="Liberty">
  <div id="top"></div>
  <div class="nav-wrapper">
    <nav class="navbar">
      <div class="navbar-inner">
        <a class="navbar-brand" href="/">리브위키</a>
        <ul class="nav navbar-nav">
          <li class="nav-item">
            <a class="nav-link" href="/RecentChanges">
              <span class="nav-icon" aria-hidden="true">↻</span><span class="nav-text">최근 변경</span>
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/discuss/대문" title="토론">
              <span class="nav-icon" aria-hidden="true">💬</span><span class="nav-text">토론</span>
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/RandomPage">
              <span class="nav-icon" aria-hidden="true">⤬</span><span class="nav-text">임의 문서</span>
            </a>
          </li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" tabindex="0">
              <span class="nav-icon" aria-hidden="true">⚙</span><span class="nav-text">도구</span>
            </a>
            <div class="dropdown-menu">
              ${raw(docTools)}
              <div class="dd-section-title">둘러보기</div>
              <a class="dd-item" href="/w/대문">대문</a>
              <a class="dd-item" href="/AllPages">모든 문서</a>
              <a class="dd-item" href="/RandomPage">랜덤 문서</a>
              <a class="dd-item" href="/Upload">파일 올리기</a>
              <a class="dd-item" href="/UserList">사용자 목록</a>
              <a class="dd-item" href="/w/나무마크">나무마크 문법</a>
            </div>
          </li>
        </ul>
        <div class="navbar-right">
          <div class="navbar-login">
            <div class="dropdown login-menu">
              <a class="dropdown-toggle login-toggle" href="#" tabindex="0" aria-label="사용자 메뉴">
                <span class="nav-icon" aria-hidden="true">👤</span>
              </a>
              <div class="dropdown-menu dropdown-menu-right">
                ${raw(userMenu)}
              </div>
            </div>
          </div>
          <form id="searchform" class="form-inline" method="get" action="/Search">
            <div class="input-group">
              <input type="search" name="q" placeholder="검색" autocomplete="off" class="form-control" id="searchInput" />
              <span class="input-group-btn">
                <button type="submit" class="btn btn-secondary" aria-label="검색">
                  <span class="nav-icon" aria-hidden="true">🔍</span>
                </button>
              </span>
            </div>
          </form>
        </div>
      </div>
    </nav>
  </div>

  <div class="content-wrapper">
    ${raw(recentSidebar)}
    <div class="container-fluid liberty-content">
      ${raw(body)}
    </div>
    <div class="clearfix"></div>
  </div>

  <div id="bottom" class="liberty-footer">
    <ul class="footer-info">
      <li class="footer-info-copyright">모든 문서는 <a class="external" rel="nofollow" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank">크리에이티브 커먼즈 저작자표시-동일조건변경허락 4.0</a>에 따라 사용할 수 있습니다.</li>
    </ul>
    <ul class="footer-icons">
      <li class="footer-poweredbyico">리브위키 | 나무마크 문법</li>
    </ul>
  </div>

  <div class="scroll-buttons">
    <a class="scroll-toc" href="#toc" title="목차로">≡</a>
    <a id="left" class="scroll-button" href="#top" title="맨 위로">↑</a>
    <a id="right" class="scroll-bottom" href="#bottom" title="맨 아래로">↓</a>
  </div>
</div>

<script src="/wiki.js" defer></script>
</body>
</html>`;
}

module.exports = { layout, html, raw, escapeHtml, pageUrl, authorLink, isUserPage, userPageTitle, USER_NS };
