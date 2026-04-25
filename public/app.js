const els = {
  list: document.getElementById('pageList'),
  empty: document.getElementById('empty'),
  viewer: document.getElementById('viewer'),
  editor: document.getElementById('editor'),
  viewTitle: document.getElementById('viewTitle'),
  viewContent: document.getElementById('viewContent'),
  viewMeta: document.getElementById('viewMeta'),
  editTitle: document.getElementById('editTitle'),
  editContent: document.getElementById('editContent'),
  newBtn: document.getElementById('newPageBtn'),
  editBtn: document.getElementById('editBtn'),
  deleteBtn: document.getElementById('deleteBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
};

let currentTitle = null;
let originalTitle = null;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

function show(view) {
  els.empty.classList.toggle('hidden', view !== 'empty');
  els.viewer.classList.toggle('hidden', view !== 'viewer');
  els.editor.classList.toggle('hidden', view !== 'editor');
}

async function loadList(selectTitle) {
  const pages = await api('/api/pages');
  els.list.innerHTML = '';
  pages.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = p.title;
    if (p.title === selectTitle) li.classList.add('active');
    li.addEventListener('click', () => openPage(p.title));
    els.list.appendChild(li);
  });
  if (pages.length === 0) show('empty');
}

async function openPage(title) {
  const page = await api('/api/pages/' + encodeURIComponent(title));
  currentTitle = page.title;
  els.viewTitle.textContent = page.title;
  els.viewContent.textContent = page.content;
  els.viewMeta.textContent = 'Last updated: ' + new Date(page.updatedAt).toLocaleString();
  show('viewer');
  await loadList(title);
}

function startEdit(isNew) {
  if (isNew) {
    originalTitle = null;
    els.editTitle.value = '';
    els.editContent.value = '';
  } else {
    originalTitle = currentTitle;
    els.editTitle.value = currentTitle;
    els.editContent.value = els.viewContent.textContent;
  }
  show('editor');
  els.editTitle.focus();
}

els.newBtn.addEventListener('click', () => startEdit(true));
els.editBtn.addEventListener('click', () => startEdit(false));
els.cancelBtn.addEventListener('click', async () => {
  if (currentTitle) await openPage(currentTitle);
  else { show('empty'); await loadList(); }
});

els.deleteBtn.addEventListener('click', async () => {
  if (!currentTitle) return;
  if (!confirm(`Delete page "${currentTitle}"?`)) return;
  await api('/api/pages/' + encodeURIComponent(currentTitle), { method: 'DELETE' });
  currentTitle = null;
  show('empty');
  await loadList();
});

els.editor.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newTitle = els.editTitle.value.trim();
  const content = els.editContent.value;
  if (!newTitle) return;
  await api('/api/pages/' + encodeURIComponent(newTitle), {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
  if (originalTitle && originalTitle !== newTitle) {
    await api('/api/pages/' + encodeURIComponent(originalTitle), { method: 'DELETE' });
  }
  currentTitle = newTitle;
  await openPage(newTitle);
});

(async function init() {
  await loadList();
  const pages = await api('/api/pages');
  if (pages.length > 0) await openPage(pages[0].title);
})();
