# Liveswiki (리브위키)

A tiny starter wiki — Express backend + vanilla JS frontend, both served on port 5000.

## Stack

- **Runtime:** Node.js 20
- **Server:** Express 4
- **Frontend:** Static HTML/CSS/JS in `public/`
- **Storage:** JSON file at `data/pages.json` (auto-seeded on first run)

## Project Layout

```
server.js         # Express server: serves /public and /api/pages CRUD
public/
  index.html      # Single-page UI shell
  styles.css      # Dark theme styling
  app.js          # Frontend logic (list / view / edit / delete)
data/
  pages.json      # Wiki content (gitignored, seeded on first start)
package.json      # `npm start` -> node server.js
```

## API

- `GET /api/pages` — list all pages (title + updatedAt)
- `GET /api/pages/:title` — fetch one page
- `PUT /api/pages/:title` — create/update (body `{ content }`)
- `DELETE /api/pages/:title` — delete

## Development

The "Start application" workflow runs `node server.js` on port 5000 (host `0.0.0.0`)
and is shown in the Replit preview.

## Deployment

Configured as an autoscale deployment running `node server.js`.
