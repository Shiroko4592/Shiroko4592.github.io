/* app.js: JavaScript 로직 */
// 문서가 완전히 로드되면 fetchWords 함수 호출
document.addEventListener('DOMContentLoaded', fetchWords);

/**
 * 단어 데이터를 가져오는 함수
 * 실제 API가 없으므로, 여기서는 로컬의 JSON 파일(words.json)을 fetch하거나
 * 데모 데이터를 사용하도록 구성할 수 있습니다.
 */
async function fetchWords() {
  try {
    // 실제 API나 로컬 JSON 파일의 URL을 지정합니다.
    // 예: const response = await fetch('words.json');
    // 데모를 위해 static 데이터를 사용
    const data = await getStaticWords();
    displayWords(data);
  } catch (error) {
    console.error('단어 데이터를 가져오는 중 에러 발생:', error);
    // 필요 시, 사용자에게 에러 메시지를 UI에 표시합니다.
  }
}

/**
 * 데모용 static 데이터 반환 함수
 * 실제 환경에서는 API fetch 또는 로컬 JSON 파일 fetch를 사용하면 됩니다.
 */
async function getStaticWords() {
  // 간단한 데모용 데이터: 네이버 인도네시아어 오픈사전에 사용자가 등재한 단어들
  return [
    { word: 'selamat', definition: '안녕, 축하합니다.' },
    { word: 'terima kasih', definition: '감사합니다.' },
    { word: 'maaf', definition: '죄송합니다.' },
    { word: 'halo', definition: '안녕하세요.' }
  ];
}

/**
 * 단어 데이터를 받아와 HTML 리스트에 표시하는 함수
 * @param {Array} data - 단어 객체 배열
 */
function displayWords(data) {
  const wordList = document.getElementById('word-list');
  // 기존 리스트 초기화
  wordList.innerHTML = '';

  // 단어 데이터 배열을 순회하면서 리스트 항목 생성
  data.forEach(item => {
    // li 요소 생성 후 단어와 정의 추가
    const li = document.createElement('li');
    li.innerHTML = `<strong>${item.word}</strong><br><em>${item.definition}</em>`;
    // 리스트에 항목을 추가
    wordList.appendChild(li);
  });
}
