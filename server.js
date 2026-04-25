const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;
const HOST = '0.0.0.0';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'pages.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  const seed = {
    Home: {
      title: 'Home',
      content:
        '# Welcome to Liveswiki\n\nThis is a tiny starter wiki.\n\n- Click **New page** to create one.\n- Click any title in the sidebar to view or edit.\n- Pages are stored on the server in `data/pages.json`.',
      updatedAt: new Date().toISOString(),
    },
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
}

function readPages() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read pages:', err);
    return {};
  }
}

function writePages(pages) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(pages, null, 2));
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/pages', (req, res) => {
  const pages = readPages();
  const list = Object.values(pages)
    .map((p) => ({ title: p.title, updatedAt: p.updatedAt }))
    .sort((a, b) => a.title.localeCompare(b.title));
  res.json(list);
});

app.get('/api/pages/:title', (req, res) => {
  const pages = readPages();
  const page = pages[req.params.title];
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json(page);
});

app.put('/api/pages/:title', (req, res) => {
  const title = (req.params.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title required' });
  const content = typeof req.body?.content === 'string' ? req.body.content : '';
  const pages = readPages();
  pages[title] = { title, content, updatedAt: new Date().toISOString() };
  writePages(pages);
  res.json(pages[title]);
});

app.delete('/api/pages/:title', (req, res) => {
  const pages = readPages();
  if (!pages[req.params.title]) {
    return res.status(404).json({ error: 'Page not found' });
  }
  delete pages[req.params.title];
  writePages(pages);
  res.json({ ok: true });
});

app.listen(PORT, HOST, () => {
  console.log(`Liveswiki running at http://${HOST}:${PORT}`);
});
