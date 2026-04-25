const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'wiki.json');

let db = null;

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    db = { pages: {}, revisions: {}, discussions: {} };
    seedInitial();
    save();
  } else {
    try {
      db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
      console.error('Failed to read wiki.json, starting fresh:', err);
      db = { pages: {}, revisions: {}, discussions: {} };
    }
    if (!db.pages) db.pages = {};
    if (!db.revisions) db.revisions = {};
    if (!db.discussions) db.discussions = {};
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function getPage(title) {
  return db.pages[title] || null;
}

function listPages() {
  return Object.values(db.pages)
    .map((p) => ({ title: p.title, updatedAt: p.updatedAt, currentRev: p.currentRev }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

function getRevisions(title) {
  return db.revisions[title] || [];
}

function getRevision(title, rev) {
  const revs = db.revisions[title] || [];
  return revs.find((r) => r.rev === rev) || null;
}

function getCurrentContent(title) {
  const page = getPage(title);
  if (!page) return null;
  const rev = getRevision(title, page.currentRev);
  return rev ? rev.content : '';
}

function saveRevision(title, content, author, comment, ip) {
  if (!db.revisions[title]) db.revisions[title] = [];
  const revs = db.revisions[title];
  const previous = revs.length ? revs[revs.length - 1] : null;
  if (previous && previous.content === content) {
    return { unchanged: true, page: db.pages[title] };
  }
  const rev = {
    rev: revs.length + 1,
    content,
    author: author || 'Anonymous',
    comment: comment || '',
    createdAt: new Date().toISOString(),
    ip: ip || '',
    size: Buffer.byteLength(content, 'utf8'),
    delta: previous ? Buffer.byteLength(content, 'utf8') - previous.size : Buffer.byteLength(content, 'utf8'),
  };
  revs.push(rev);
  db.pages[title] = {
    title,
    currentRev: rev.rev,
    updatedAt: rev.createdAt,
  };
  save();
  return { rev, page: db.pages[title] };
}

function deletePage(title) {
  delete db.pages[title];
  delete db.revisions[title];
  delete db.discussions[title];
  save();
}

function recentChanges(limit = 100) {
  const all = [];
  for (const [title, revs] of Object.entries(db.revisions)) {
    for (const r of revs) {
      all.push({
        title,
        rev: r.rev,
        author: r.author,
        comment: r.comment,
        createdAt: r.createdAt,
        delta: r.delta,
        size: r.size,
      });
    }
  }
  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return all.slice(0, limit);
}

function searchPages(q) {
  if (!q) return [];
  const needle = q.toLowerCase();
  const results = [];
  for (const title of Object.keys(db.pages)) {
    const content = getCurrentContent(title) || '';
    const titleHit = title.toLowerCase().includes(needle);
    const contentHit = content.toLowerCase().includes(needle);
    if (titleHit || contentHit) {
      let snippet = '';
      if (contentHit) {
        const idx = content.toLowerCase().indexOf(needle);
        const start = Math.max(0, idx - 40);
        const end = Math.min(content.length, idx + needle.length + 60);
        snippet = (start > 0 ? '… ' : '') + content.slice(start, end) + (end < content.length ? ' …' : '');
      }
      results.push({ title, titleHit, snippet });
    }
  }
  results.sort((a, b) => (b.titleHit - a.titleHit) || a.title.localeCompare(b.title, 'ko'));
  return results;
}

function findBacklinks(title) {
  const result = [];
  const linkPatterns = [
    new RegExp('\\[\\[' + escapeRegex(title) + '\\]\\]'),
    new RegExp('\\[\\[' + escapeRegex(title) + '\\|'),
  ];
  for (const t of Object.keys(db.pages)) {
    if (t === title) continue;
    const content = getCurrentContent(t) || '';
    if (linkPatterns.some((re) => re.test(content))) {
      result.push(t);
    }
  }
  return result.sort((a, b) => a.localeCompare(b, 'ko'));
}

function findContributions(author) {
  if (!author) return [];
  const result = [];
  for (const [title, revs] of Object.entries(db.revisions)) {
    for (const r of revs) {
      if (r.author === author) {
        result.push({
          title,
          rev: r.rev,
          createdAt: r.createdAt,
          comment: r.comment,
          delta: r.delta,
          size: r.size,
        });
      }
    }
  }
  result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return result;
}

function listAuthors() {
  const counts = new Map();
  for (const revs of Object.values(db.revisions)) {
    for (const r of revs) {
      const a = r.author || 'Anonymous';
      const cur = counts.get(a) || { author: a, edits: 0, lastEdit: r.createdAt };
      cur.edits += 1;
      if (r.createdAt > cur.lastEdit) cur.lastEdit = r.createdAt;
      counts.set(a, cur);
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.edits - a.edits || a.author.localeCompare(b.author, 'ko'));
}

function findCategoryMembers(category) {
  const result = [];
  const re = new RegExp('\\[\\[분류:\\s*' + escapeRegex(category) + '\\s*(?:\\|[^\\]]+)?\\]\\]');
  for (const t of Object.keys(db.pages)) {
    const content = getCurrentContent(t) || '';
    if (re.test(content)) result.push(t);
  }
  return result.sort((a, b) => a.localeCompare(b, 'ko'));
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDiscussion(title) {
  return db.discussions[title] || [];
}

function addComment(title, author, content, ip) {
  if (!db.discussions[title]) db.discussions[title] = [];
  const c = {
    id: db.discussions[title].length + 1,
    author: author || 'Anonymous',
    content: String(content || '').slice(0, 5000),
    createdAt: new Date().toISOString(),
    ip: ip || '',
  };
  db.discussions[title].push(c);
  save();
  return c;
}

function randomTitle() {
  const titles = Object.keys(db.pages);
  if (titles.length === 0) return null;
  return titles[Math.floor(Math.random() * titles.length)];
}

function seedInitial() {
  const home = `= 리브위키에 오신 것을 환영합니다 =
'''리브위키'''(Liveswiki)는 [[https://github.com/wjdgustn/thetree|the tree]] 스타일의 위키 엔진입니다.
나무위키와 같은 [[나무마크]] 문법을 사용합니다.

== 시작하기 ==
 * 사이드바의 '''[[나무마크|나무마크 문법]]'''을 익혀보세요.
 * '''[[모래상자]]'''에서 자유롭게 편집을 연습할 수 있습니다.
 * 상단 검색창에 문서 이름을 입력해 새 문서를 만들 수 있습니다.

== 주요 기능 ==
 * 나무마크 문법 렌더링 (제목 / 표 / 목록 / 강조 / 링크 / 분류 / 각주 / 코드)
 * 문서 ''역사''와 ''비교'' (diff)
 * 문서 ''역링크''(backlinks) 및 ''분류''(category) 자동 색인
 * ''최근 변경'' / ''랜덤 문서'' / ''모든 문서'' / ''검색''
 * 문서별 ''토론'' 페이지

== 더 알아보기 ==
||<:>'''항목'''||<:>'''설명'''||
||[[나무마크]]||기본 문법 안내||
||[[모래상자]]||편집 연습용 문서||
||[[리브위키:정책]]||(예시) 정책 문서||

[[분류:대문]]
`;

  const help = `= 나무마크 문법 =
나무마크는 [[https://namu.wiki|나무위키]] 계열 위키에서 사용하는 마크업 언어입니다.

== 글자 강조 ==
 * '''굵게''' — {{{'''굵게'''}}}
 * ''기울임'' — {{{''기울임''}}}
 * __밑줄__ — {{{__밑줄__}}}
 * ~~취소선~~ — {{{~~취소선~~}}}
 * ^^위 첨자^^ — {{{^^위 첨자^^}}}
 * ,,아래 첨자,, — {{{,,아래 첨자,,}}}
 * {{{#red 빨간 글자}}} — {{{ {{{#red 빨간 글자}}} }}}
 * {{{#1f6feb 파란 글자}}} — {{{ {{{#1f6feb 파란 글자}}} }}}

== 제목 ==
{{{== 제목 ==}}} 부터 {{{====== 작은 제목 ======}}} 까지 사용할 수 있습니다.

=== 작은 제목 예시 ===
==== 더 작은 제목 ====

== 목록 ==
 * 별표는 글머리 기호 목록입니다.
 * 항목 두 번째.
   * 들여쓰기로 중첩 목록을 만들 수 있습니다.
   * 두 번째 자식 항목.
 1. 숫자는 번호 매김 목록입니다.
 1. 자동으로 번호가 매겨집니다.

== 표 ==
||<:>'''제목 1'''||<:>'''제목 2'''||
||내용 A||내용 B||
||<#eef6ff>색칠된 셀||내용 D||
||<-2><:>'''열 병합된 셀'''||

== 인용 ==
> 인용문은 '>' 로 시작합니다.
> 여러 줄로 이어서 쓸 수 있습니다.

== 가로줄 ==
{{{----}}} 처럼 4개 이상의 하이픈으로 가로줄을 그을 수 있습니다.

----

== 링크 ==
 * 내부 링크 — {{{[[모래상자]]}}} → [[모래상자]]
 * 표시 텍스트 — {{{[[모래상자|연습 문서]]}}} → [[모래상자|연습 문서]]
 * 섹션 링크 — {{{[[나무마크#표|표 섹션]]}}} → [[나무마크#표|표 섹션]]
 * 외부 링크 — {{{[[https://replit.com|Replit]]}}} → [[https://replit.com|Replit]]
 * 분류 — {{{[[분류:이름]]}}} (문서 하단에 분류로 표시됨)

== 이미지 ==
{{{[[파일:URL|width=400]]}}} 형식으로 이미지를 첨부합니다.

== 동영상 ==
유튜브, 니코니코 동화, 빌리빌리, 틱톡, 비메오의 외부 동영상을 본문에 바로 삽입할 수 있습니다.
서비스 이름과 동영상 ID(또는 전체 URL)를 콜론으로 연결합니다.

 * 유튜브 — {{{[[유튜브:dQw4w9WgXcQ]]}}} 또는 {{{[[youtube:https://youtu.be/dQw4w9WgXcQ]]}}}
 * 니코니코 동화 — {{{[[니코니코:sm9]]}}} 또는 {{{[[nicovideo:https://www.nicovideo.jp/watch/sm9]]}}}
 * 빌리빌리 — {{{[[빌리빌리:BV1GJ411x7h7]]}}} 또는 {{{[[bilibili:av170001]]}}}
 * 틱톡 — {{{[[틱톡:7012345678901234567]]}}} 또는 {{{[[tiktok:https://www.tiktok.com/@user/video/7012345678901234567]]}}}
 * 비메오 — {{{[[비메오:76979871]]}}} 또는 {{{[[vimeo:https://vimeo.com/76979871]]}}}
 * 자동 인식 — {{{[[동영상:https://www.youtube.com/watch?v=dQw4w9WgXcQ]]}}} 처럼 URL만 넘겨도 됩니다.

크기와 정렬은 이미지와 같은 옵션 문법을 사용합니다.
{{{[[유튜브:dQw4w9WgXcQ|width=480,align=center]]}}}

== 코드 ==
{{{
여러 줄 코드 블록은
중괄호 세 개로 감쌉니다.
}}}

인라인 코드는 {{{ {{{이렇게}}} }}} 표시합니다.

문법 강조는 {{{#!syntax js ... }}} 처럼 지정합니다.

== 접기 ==
{{{#!folding 펼쳐 보기
이 부분은 처음에 접혀 있다가 클릭하면 펼쳐집니다.

 * 안에 다른 나무마크 문법도 사용할 수 있습니다.
 * 예: '''굵은 글씨'''.
}}}

== 각주 ==
본문에 [* 이렇게] 각주를 달 수 있습니다.[* 이 문장도 각주입니다.]
각주는 위 첨자 번호로 표시되고, 문서 하단에 자동으로 '''각주''' 섹션이 만들어져 모아 보입니다.

== 사용자 문서 ==
{{{[[사용자:이름]]}}} 형태로 사용자 문서를 만들 수 있습니다.
편집 시 입력한 ''작성자'' 이름은 [[최근 변경]], 역사, 기여 목록 등에서 자동으로 자신의 사용자 문서로 연결됩니다.
사용자별 편집 내역은 [[/Contributions/이름]] 또는 사이드바의 '''사용자 목록'''에서 확인할 수 있습니다.

== 목차 ==
{{{[목차]}}} 매크로를 본문 어디에든 넣어 목차를 표시할 수 있습니다.
(목차는 문서에 제목이 2개 이상 있으면 자동으로 상단에도 표시됩니다.)

[[분류:도움말]]
`;

  const sandbox = `= 모래상자 =
이 문서는 자유롭게 편집을 연습할 수 있는 문서입니다.

마음껏 편집해보세요. 문법이 궁금하다면 [[나무마크]] 문서를 참고하세요.

----

== 자유 편집 영역 ==
 * 여기에 무엇이든 적어보세요.
 * '''굵게''' / ''기울임'' / __밑줄__ 등을 시험해보세요.

[[분류:리브위키]]
`;

  const policy = `= 리브위키:정책 =
이 문서는 정책 문서의 ''예시''입니다. 실제 정책 내용은 운영자가 채워주세요.

== 편집 ==
 * 모든 사용자는 익명으로 편집할 수 있습니다.
 * 편집 시 적절한 ''편집 요약''을 남겨주세요.

== 토론 ==
 * 문서 상단의 '''토론''' 탭에서 의견을 남길 수 있습니다.

[[분류:리브위키]]
`;

  saveRevision('대문', home, 'Anonymous', '문서 생성', '');
  saveRevision('나무마크', help, 'Anonymous', '문서 생성', '');
  saveRevision('모래상자', sandbox, 'Anonymous', '문서 생성', '');
  saveRevision('리브위키:정책', policy, 'Anonymous', '문서 생성', '');
}

load();

module.exports = {
  getPage,
  listPages,
  getRevisions,
  getRevision,
  getCurrentContent,
  saveRevision,
  deletePage,
  recentChanges,
  searchPages,
  findBacklinks,
  findCategoryMembers,
  findContributions,
  listAuthors,
  getDiscussion,
  addComment,
  randomTitle,
};
