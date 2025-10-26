/* app.js: 로그인 + 단어 표시 로직 */

// 네이버 애플리케이션 설정
const CLIENT_ID = 'a2Xe9EBy8JP9v1hST96N';
const REDIRECT_URI = window.location.origin + '/';
const STATE = 'naver_auth_' + Math.random().toString(36).substring(2);

document.addEventListener('DOMContentLoaded', () => {
  setupLoginButtons();
  checkLoginStatus();
});

/**
 * 로그인 버튼/로그아웃 버튼 이벤트 설정
 */
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

/**
 * 로그인 상태 확인 및 토큰 처리
 */
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
    fetchWords(); // 로그인 안 했을 때도 예시 단어는 보여줌
  }
}

/**
 * 네이버 프로필 불러오기
 */
async function fetchUserProfile(token) {
  try {
    const response = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    if (data.resultcode === '00') {
      const user = data.response;
      console.log('로그인한 사용자:', user.nickname || user.name);
      fetchWords(user.id); // 사용자 ID로 단어 불러오기
    } else {
      throw new Error('프로필 가져오기 실패');
    }
  } catch (error) {
    console.error('프로필 불러오기 에러:', error);
    localStorage.removeItem('naver_token');
    window.location.reload();
  }
}

/**
 * 단어 데이터 fetch
 * (실제 구현 시, 서버에서 사용자 ID별 데이터 필터링)
 */
async function fetchWords(userId = null) {
  try {
    const response = await fetch('words.json');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    let data = await response.json();

    // 로그인한 사용자라면 userId에 맞는 단어만 필터링
    if (userId) {
      data = data.filter(item => item.userId === userId);
    }

    displayWords(data);
    enableSearch();
  } catch (error) {
    console.error('단어 데이터를 가져오는 중 에러 발생:', error);
    const wordList = document.getElementById('word-list');
    wordList.innerHTML =
      '<li style="color: red;">단어 데이터를 불러올 수 없습니다.</li>';
  }
}

/**
 * 단어 리스트 표시
 */
function displayWords(data) {
  const wordList = document.getElementById('word-list');
  wordList.innerHTML = '';

  if (data.length === 0) {
    wordList.innerHTML = '<li>등록된 단어가 없습니다.</li>';
    return;
  }

  data.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${item.word}</strong><br><em>${item.definition}</em>`;
    wordList.appendChild(li);
  });
}

/**
 * 검색 기능
 */
function enableSearch() {
  const searchInput = document.getElementById('search-input');
  const wordList = document.getElementById('word-list');

  searchInput.addEventListener('input', e => {
    const keyword = e.target.value.toLowerCase();
    const items = wordList.querySelectorAll('li');

    items.forEach(li => {
      const text = li.textContent.toLowerCase();
      li.style.display = text.includes(keyword) ? '' : 'none';
    });
  });
}
