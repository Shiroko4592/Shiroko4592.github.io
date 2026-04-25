# Liveswiki (리브위키)

A theseed/namuwiki-style Korean wiki engine. Server-side-rendered Express + namu-mark parser, file-based JSON storage, served on port 5000.

## Stack

- **Runtime:** Node.js 20
- **Server:** Express 4 (server-side rendered)
- **Markup:** Custom namu-mark (나무마크) parser in `lib/namumark.js`
- **Storage:** JSON file at `data/wiki.json` (auto-seeded on first run; gitignored)
- **Frontend assets:** `public/style.css` (light/blue theme), `public/wiki.js` (editor tabs + live preview)

## Project Layout

```
server.js          # All Express routes (SSR)
lib/
  namumark.js      # Namu-mark parser (headings, lists, tables, links, emphasis, code, footnotes, categories…)
  storage.js       # JSON storage + page/revision/discussion APIs + initial seed
  layout.js        # `html` template tag, escapeHtml/raw helpers, page shell
  diff.js          # LCS-based line diff for the diff viewer
public/
  style.css        # Theme
  wiki.js          # Editor tab switching + live preview fetch
data/
  wiki.json        # { pages, revisions, discussions } (gitignored, seeded on first start)
package.json       # `npm start` -> node server.js
```

## Routes

- `/` → redirects to `/w/대문`
- `/w/:title` — read view (auto-creates "문서가 없습니다" placeholder; ?rev=N for old revisions)
- `/edit/:title` (GET/POST) — editor with live preview tab; supports `?section=N` for section-only editing
- `/raw/:title` — raw wiki source
- `/history/:title` — revision history with one-click revert
- `/revert/:title` (POST) — copy a previous revision's content as a new revision
- `/diff/:title?from=&to=` — side-by-side line diff
- `/RecentChanges`, `/RandomPage`, `/AllPages`, `/Search?q=`
- `/Backlink/:title`, `/Category/:name`
- `/discuss/:title` (GET/POST) — discussion threads
- `/delete/:title` (POST) — page deletion
- `/api/preview` (POST) — JSON endpoint used by the editor's live preview

## Namu-mark features supported

- Headings `= ~ ======` with auto-generated TOC (and `[목차]` macro)
- Per-heading "[편집]" links for section-level editing
- Bold/italic/underline/strike (`'''`, `''`, `__`, `~~`, `--`), sup `^^`, sub `,,`
- Inline code `{{{ ... }}}` and inline color `{{{#red 글자}}}` / `{{{#1f6feb 글자}}}`
- Block code `{{{#!syntax lang ... }}}` and `{{{ ... }}}`
- Folding blocks `{{{#!folding 제목 ... }}}` → `<details>`
- Links: `[[Page]]`, `[[Page|Label]]`, `[[Page#anchor]]`, `[[#anchor]]`, `[[https://…|label]]`, bare URL auto-link
- Images `[[파일:URL|width=400,align=center,alt=...]]`
- Video embeds: `[[유튜브:VIDEO_ID]]`, `[[니코니코:sm9]]`, `[[빌리빌리:BV...]]` / `[[빌리빌리:av170001]]`, `[[틱톡:VIDEO_ID]]`, `[[비메오:VIDEO_ID]]`. English aliases (`youtube`, `nicovideo`, `bilibili`, `tiktok`, `vimeo`) and a generic auto-detect (`[[동영상:URL]]` / `[[video:URL]]`) are also accepted. Accepts both bare IDs and full URLs. Same `width=`, `height=`, `align=` options as images.
- Lists (nested `*`, `1.`), tables `|| … ||` with `<:>`, `<(>`, `<)>`, `<-N>` (colspan), `<|N>` (rowspan), `<#color>` (bg)
- Blockquotes `>`, horizontal rules `----` (4+ dashes)
- Footnotes `[* …]`, categories `[[분류:Name]]`, indented lines

## Editor features

- Toolbar with quick-insert buttons (bold/italic/underline/strike, heading, internal/external link, image, lists, table, quote, code block, hr, TOC, footnote, category)
- Tab-based live preview (uses `/api/preview`)
- Keyboard shortcuts: Ctrl/Cmd+B/I/U/K, Ctrl/Cmd+Enter to save
- Section-only editing pre-fills the comment with `/* 섹션 제목 */`
- One-click revert from history saves a new revision with auto-comment

## Development

The "Start application" workflow runs `node server.js` on port 5000 (host `0.0.0.0`) and is shown in the Replit preview.

## Deployment

Configured as a VM deployment running `node server.js`.
