const CLIENT_ID = 'a2Xe9EBy8JP9v1hST96N';
const REDIRECT_URI = window.location.origin + '/';
const STATE = 'naver_auth_' + Math.random().toString(36).substring(2);

let wordData = [];

document.addEventListener('DOMContentLoaded', () => {
  setupLoginButtons();
  checkLoginStatus();
  setupDarkMode();
  setupAddWord();
});

/* 로그인 버튼 */
function setupLoginButtons() {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');

  loginBtn.addEventListener('click', () => {
    const loginUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=token&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${STATE}`;
    window.location.href = loginUrl;
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('naver_token');
    window.location.reload();
  });
}

/* 로그인 상태 체크 */
function checkLoginStatus() {
  const hash = window.location.hash;
  if (hash.includes('access_token')) {
    const token = new URLSearchParams(hash.substring(1)).get('access_token');
    localStorage.setItem('naver_token', token);
    window.location.hash = '';
  }

  const token = localStorage.getItem('naver_token');
  if (token) {
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'inline';
    fetchUserProfile(token);
  } else {
    fetchWords();
  }
}

/* 네이버 프로필 */
async function fetchUserProfile(token) {
  try {
    const response = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (data.resultcode === '00') {
      const user = data.response;
      fetchWords(user.id);
    } else {
      throw new Error('프로필 가져오기 실패');
    }
  } catch (error) {
    console.error(error);
    localStorage.removeItem('naver_token');
    window.location.reload();
  }
}

/* 단어 데이터 fetch */
async function fetchWords(userId = null) {
  try {
    const response = await fetch('words.json');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    let data = await response.json();
    if (userId) data = data.filter(item => item.userId === userId);

    // 로컬스토리지에 저장된 즐겨찾기 반영
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    data.forEach(d => (d.favorite = favorites.includes(d.word)));

    wordData = data;
    displayWords(wordData);
    enableSearch();
    setupWordModal();
  } catch (error) {
    console.error(error);
  }
}

/* 단어 리스트 표시 */
function displayWords(data) {
  const wordList = document.getElementById('word-list');
  wordList.innerHTML = '';

  if (data.length === 0) {
    wordList.innerHTML = '<li>등록된 단어가 없습니다.</li>';
    return;
  }

  data.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${item.word}</strong> 
      <span class="favorite-btn">${item.favorite ? '⭐' : '☆'}</span>
      <span class="delete-btn">❌</span>
      <br>
      <em>${item.definition}</em>
      <br>
      <small>태그: ${item.tags || ''}</small>
    `;
    wordList.appendChild(li);

    /* 즐겨찾기 클릭 */
    li.querySelector('.favorite-btn').addEventListener('click', e => {
      item.favorite = !item.favorite;
      updateFavorites(item.word, item.favorite);
      displayWords(wordData);
    });

    /* 삭제 클릭 */
    li.querySelector('.delete-btn').addEventListener('click', e => {
      wordData = wordData.filter(w => w.word !== item.word);
      displayWords(wordData);
    });

    /* 단어 클릭 -> 모달 */
    li.querySelector('strong').addEventListener('click', () => {
      openModal(item);
    });
  });
}

/* 즐겨찾기 업데이트 */
function updateFavorites(word, fav) {
  let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  if (fav) {
    if (!favorites.includes(word)) favorites.push(word);
  } else {
    favorites = favorites.filter(f => f !== word);
  }
  localStorage.setItem('favorites', JSON.stringify(favorites));
}

/* 검색 기능 */
function enableSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', e => {
    const keyword = e.target.value.toLowerCase();
    displayWords(wordData.filter(item => 
      item.word.toLowerCase().includes(keyword) ||
      (item.definition && item.definition.toLowerCase().includes(keyword)) ||
      (item.tags && item.tags.toLowerCase().includes(keyword))
    ));
  });
}

/* 다크모드 */
function setupDarkMode() {
  const btn = document.getElementById('darkmode-btn');
  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
  });
}

/* 단어 추가 */
function setupAddWord() {
  const addBtn = document.getElementById('add-word-btn');
  addBtn.addEventListener('click', () => {
    const word = document.getElementById('new-word').value.trim();
    const def = document.getElementById('new-definition').value.trim();
    const tags = document.getElementById('new-tags').value.trim();

    if (!word || !def) return alert('단어와 뜻은 필수입니다.');

    const newWord = { word, definition: def, tags, favorite: false };
    wordData.push(newWord);
    displayWords(wordData);

    document.getElementById('new-word').value = '';
    document.getElementById('new-definition').value = '';
    document.getElementById('new-tags').value = '';
  });
}

/* 단어 모달 */
function setupWordModal() {
  const modal = document.getElementById('word-modal');
  const closeBtn = document.getElementById('close-modal');

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

function openModal(item) {
  const modal = document.getElementById('word-modal');
  document.getElementById('modal-word').textContent = item.word;
  document.getElementById('modal-definition').textContent = item.definition;
  document.getElementById('modal-tags').textContent = `태그: ${item.tags || ''}`;
  modal.style.display = 'flex';
}
