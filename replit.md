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
- `/w/:title` — read view (auto-creates "문서가 없습니다" placeholder)
- `/edit/:title` (GET/POST) — editor with live preview tab
- `/raw/:title` — raw wiki source
- `/history/:title` — revision history with diff/revert
- `/diff/:title?from=&to=` — side-by-side line diff
- `/RecentChanges`, `/RandomPage`, `/AllPages`, `/Search?q=`
- `/Backlink/:title`, `/Category/:name`
- `/discuss/:title` (GET/POST) — discussion threads
- `/delete/:title` (POST) — page deletion (creates a tombstone revision)
- `/api/preview` (POST) — JSON endpoint used by the editor's live preview

## Namu-mark features supported

Headings (`= ~ ======`), bold/italic/underline/strike/sup/sub, inline code `{{{...}}}` and block code `{{{#!syntax lang ... }}}`, links `[[Target|Label]]` and external `[[https://…|label]]`, lists (`*`, `1.`), tables `|| … ||` with cell options, blockquotes `>`, horizontal rules `----`, footnotes `[* …]`, categories `[[분류:Name]]`, indents.

## Development

The "Start application" workflow runs `node server.js` on port 5000 (host `0.0.0.0`) and is shown in the Replit preview.

## Deployment

Configured as a VM deployment running `node server.js`.
