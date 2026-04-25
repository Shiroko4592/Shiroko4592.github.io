(function () {
  // Editor: tabs + live preview
  const form = document.getElementById('editor-form');
  if (!form) return;

  const tabs = form.querySelectorAll('.editor-tabs .tab');
  const panes = form.querySelectorAll('.editor-pane');
  const textarea = document.getElementById('content');
  const preview = document.getElementById('preview');

  let previewTimer = null;
  let lastPreviewed = null;

  async function refreshPreview() {
    if (!preview) return;
    const text = textarea.value;
    if (text === lastPreviewed) return;
    lastPreviewed = text;
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error('preview failed');
      const data = await res.json();
      preview.innerHTML = data.html || '<em class="muted">(미리보기 내용이 없습니다)</em>';
    } catch (err) {
      preview.innerHTML = '<em class="muted">미리보기를 불러올 수 없습니다.</em>';
    }
  }

  function activate(name) {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    panes.forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== name));
    if (name === 'preview') refreshPreview();
  }

  tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.tab)));

  textarea.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      // Only refresh if preview tab is active
      const previewTab = form.querySelector('.tab[data-tab="preview"]');
      if (previewTab && previewTab.classList.contains('active')) refreshPreview();
    }, 300);
  });

  // Save with Ctrl+Enter / Cmd+Enter
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.submit();
    }
  });

  // Delete button (POST to /delete/:title)
  const deleteBtn = document.getElementById('delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const title = decodeURIComponent(form.action.split('/edit/')[1] || '');
      if (!title) return;
      if (!confirm(`정말로 "${title}" 문서를 삭제하시겠습니까?\n모든 역사가 함께 삭제됩니다.`)) return;
      const f = document.createElement('form');
      f.method = 'post';
      f.action = '/delete/' + encodeURIComponent(title);
      document.body.appendChild(f);
      f.submit();
    });
  }
})();
