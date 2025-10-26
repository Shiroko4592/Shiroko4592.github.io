const CLIENT_ID = 'a2Xe9EBy8JP9v1hST96N';
const REDIRECT_URI = window.location.origin + '/';
const STATE = 'naver_auth_' + Math.random().toString(36).substring(2);

let wordData = [];

document.addEventListener('DOMContentLoaded', () => {
  setupLoginButtons();
  checkLoginStatus();
  setupDarkMode();
  setupAddWord();
  setupCSVUpload();
  loadWords();
});

/* 로그인 버튼/로그아웃 버튼 */
function setupLoginButtons() {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');

  loginBtn.addEventListener('click', () => {
    const loginUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=token&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${STATE}`;
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
  }
}

/* 네이버 프로필 가져오기 */
async function fetchUserProfile(token) {
  try {
    const res = await fetch('/api/naver/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    
    if (data.resultcode === '00') {
      const user = data.response;
      document.getElementById('user-nickname').textContent = `안녕하세요, ${user.nickname || user.name}님`;
    } else if (data.auth_failed) {
      console.error('인증 실패:', data.error);
      localStorage.removeItem('naver_token');
      document.getElementById('login-btn').style.display = 'inline';
      document.getElementById('logout-btn').style.display = 'none';
      document.getElementById('user-nickname').textContent = '';
    } else if (data.error) {
      console.warn('일시적 오류:', data.error);
    }
  } catch (err) {
    console.error('네트워크 오류:', err);
  }
}

/* localStorage에서 단어 불러오기 */
function loadWords() {
  const stored = JSON.parse(localStorage.getItem('words') || '[]');
  wordData = stored;
  displayWords(wordData);
  enableSearch();
  setupWordModal();
}

/* 단어 표시 */
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

    li.querySelector('.favorite-btn').addEventListener('click', () => {
      item.favorite = !item.favorite;
      saveWords();
      displayWords(wordData);
    });

    li.querySelector('.delete-btn').addEventListener('click', () => {
      wordData = wordData.filter(w => w.word !== item.word);
      saveWords();
      displayWords(wordData);
    });

    li.querySelector('strong').addEventListener('click', () => {
      openModal(item);
    });
  });
}

/* localStorage 저장 */
function saveWords() {
  localStorage.setItem('words', JSON.stringify(wordData));
}

/* 검색 */
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
    saveWords();
    displayWords(wordData);

    document.getElementById('new-word').value = '';
    document.getElementById('new-definition').value = '';
    document.getElementById('new-tags').value = '';
  });
}

/* CSV 업로드 */
function setupCSVUpload() {
  const fileInput = document.getElementById('csv-file');
  const fileNameDisplay = document.getElementById('csv-file-name');
  const clearAllBtn = document.getElementById('clear-all-btn');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent = `파일: ${file.name}`;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const newWords = parseCSV(text);
        
        if (newWords.length === 0) {
          alert('CSV 파일에서 단어를 찾을 수 없습니다.');
          return;
        }

        const duplicates = [];
        const added = [];
        
        newWords.forEach(newWord => {
          const exists = wordData.some(w => w.word.toLowerCase() === newWord.word.toLowerCase());
          if (exists) {
            duplicates.push(newWord.word);
          } else {
            wordData.push(newWord);
            added.push(newWord.word);
          }
        });

        saveWords();
        displayWords(wordData);
        
        let message = `${added.length}개의 단어를 추가했습니다.`;
        if (duplicates.length > 0) {
          message += `\n\n중복된 ${duplicates.length}개의 단어는 건너뛰었습니다.`;
        }
        alert(message);
        
        fileInput.value = '';
        fileNameDisplay.textContent = '';
      } catch (err) {
        console.error('CSV 파싱 오류:', err);
        alert('CSV 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    
    reader.readAsText(file, 'UTF-8');
  });

  clearAllBtn.addEventListener('click', () => {
    if (confirm(`정말로 모든 단어(${wordData.length}개)를 삭제하시겠습니까?`)) {
      wordData = [];
      saveWords();
      displayWords(wordData);
      alert('모든 단어가 삭제되었습니다.');
    }
  });
}

/* CSV 파싱 함수 */
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  
  const lines = text.split('\n').filter(line => line.trim());
  const words = [];
  
  lines.forEach((line, index) => {
    if (index === 0 && (line.includes('단어') || line.includes('word') || line.includes('Entry'))) {
      return;
    }
    
    const parts = parseCSVLine(line);
    
    if (parts.length >= 2 && parts[0] && parts[1]) {
      words.push({
        word: parts[0],
        definition: parts[1],
        tags: parts[2] || '',
        favorite: false
      });
    }
  });
  
  return words;
}

/* CSV 라인 파싱 (RFC 4180: 큰따옴표만 처리) */
function parseCSVLine(line) {
  const delimiter = detectDelimiter(line);
  const result = [];
  let current = '';
  let inQuotes = false;
  let fieldStart = true;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (fieldStart && !inQuotes && char === '"') {
      inQuotes = true;
      fieldStart = false;
    } else if (inQuotes && char === '"') {
      if (nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      fieldStart = true;
    } else {
      if (char !== ' ' && char !== '\t') {
        fieldStart = false;
      }
      current += char;
    }
  }
  
  result.push(current.trim());
  
  return result;
}

/* 구분자 감지 (큰따옴표 밖에서만 확인) */
function detectDelimiter(line) {
  let inQuotes = false;
  let commas = 0;
  let tabs = 0;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (!inQuotes && char === '"') {
      inQuotes = true;
    } else if (inQuotes && char === '"') {
      const nextChar = line[i + 1];
      if (nextChar !== '"') {
        inQuotes = false;
      } else {
        i++;
      }
    } else if (!inQuotes) {
      if (char === ',') commas++;
      if (char === '\t') tabs++;
    }
  }
  
  return tabs > commas ? '\t' : ',';
}

/* 모달 */
function setupWordModal() {
  const modal = document.getElementById('word-modal');
  const closeBtn = document.getElementById('close-modal');
  closeBtn.addEventListener('click', () => modal.style.display = 'none');
  window.addEventListener('click', e => { if(e.target === modal) modal.style.display = 'none'; });
}

function openModal(item) {
  const modal = document.getElementById('word-modal');
  document.getElementById('modal-word').textContent = item.word;
  document.getElementById('modal-definition').textContent = item.definition;
  document.getElementById('modal-tags').textContent = `태그: ${item.tags || ''}`;
  modal.style.display = 'flex';
}
