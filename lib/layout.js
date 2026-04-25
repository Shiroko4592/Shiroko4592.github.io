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

// Render an author name as a link to their user page + a small "(기여)" link.
// Anonymous and empty authors are rendered as plain text.
function authorLink(name) {
  const n = String(name || '').trim();
  if (!n || n === 'Anonymous') return escapeHtml(n || 'Anonymous');
  const safe = escapeHtml(n);
  const enc = encodeURIComponent(USER_NS + n);
  const contribEnc = encodeURIComponent(n);
  return `<a class="user-link" href="/w/${enc}">${safe}</a>` +
    ` <a class="user-contrib" href="/Contributions/${contribEnc}" title="${safe}의 기여">(기여)</a>`;
}

function layout({ title, body, currentTitle, headExtra, bodyClass }) {
  const userTool = isUserPage(currentTitle)
    ? html`<li><a href="/Contributions/${encodeURIComponent(currentTitle.slice(USER_NS.length))}">기여 보기</a></li>`
    : '';
  const docTools = currentTitle
    ? html`
        <h3>문서 도구</h3>
        <ul>
          <li><a href="/w/${currentTitle}">읽기</a></li>
          <li><a href="/edit/${currentTitle}">편집</a></li>
          <li><a href="/history/${currentTitle}">역사</a></li>
          <li><a href="/discuss/${currentTitle}">토론</a></li>
          <li><a href="/Backlink/${currentTitle}">역링크</a></li>
          <li><a href="/raw/${currentTitle}">원본</a></li>
          ${raw(userTool)}
        </ul>`
    : '';

  return html`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} - 리브위키</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%231f6feb'/%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' font-family='Arial' font-size='34' font-weight='700' fill='white'%3EL%3C/text%3E%3C/svg%3E" />
<link rel="stylesheet" href="/style.css" />
${raw(headExtra || '')}
</head>
<body class="${bodyClass || ''}">
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="/">
      <span class="brand-logo">L</span>
      <span class="brand-text">리브위키</span>
    </a>
    <form class="search" method="get" action="/Search">
      <input type="text" name="q" placeholder="검색 또는 이동..." autocomplete="off" />
      <button type="submit" aria-label="검색">검색</button>
    </form>
    <nav class="topnav">
      <a href="/RecentChanges">최근 변경</a>
      <a href="/RandomPage">랜덤</a>
    </nav>
  </div>
</header>

<div class="container">
  <aside class="sidebar">
    <h3>둘러보기</h3>
    <ul>
      <li><a href="/w/대문">대문</a></li>
      <li><a href="/RecentChanges">최근 변경</a></li>
      <li><a href="/AllPages">모든 문서</a></li>
      <li><a href="/RandomPage">랜덤 문서</a></li>
      <li><a href="/UserList">사용자 목록</a></li>
      <li><a href="/w/나무마크">나무마크 문법</a></li>
    </ul>
    ${raw(docTools)}
  </aside>

  <main class="main">
    ${raw(body)}
  </main>
</div>

<script src="/wiki.js" defer></script>

<footer class="footer">
  <span>리브위키 · Liveswiki</span>
  <span>·</span>
  <span>나무마크 문법 사용</span>
  <span>·</span>
  <a href="/w/나무마크">문법 도움말</a>
</footer>
</body>
</html>`;
}

module.exports = { layout, html, raw, escapeHtml, pageUrl, authorLink, isUserPage, userPageTitle, USER_NS };
