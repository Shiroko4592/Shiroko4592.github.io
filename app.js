/* app.js: 단어 데이터 로딩 및 표시 로직 */

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => fetchWords());

/**
 * 단어 데이터를 fetch하여 화면에 표시
 */
async function fetchWords() {
  try {
    const response = await fetch('words.json');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    const data = await response.json();
    displayWords(data);
    enableSearch(); // 검색 기능 활성화
  } catch (error) {
    console.error('단어 데이터를 가져오는 중 에러 발생:', error);
    const wordList = document.getElementById('word-list');
    wordList.innerHTML =
      '<li style="color: red;">단어 데이터를 불러올 수 없습니다.</li>';
  }
}

/**
 * 단어 데이터를 받아 HTML 리스트에 표시
 * @param {Array} data - 단어 객체 배열
 */
function displayWords(data) {
  const wordList = document.getElementById('word-list');
  wordList.innerHTML = '';

  data.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${item.word}</strong><br><em>${item.definition}</em>`;
    wordList.appendChild(li);
  });
}

/**
 * 검색 기능 구현
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
