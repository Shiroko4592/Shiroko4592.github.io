// dict.js: 사전 검색 함수
function searchWord(word) {
    const result = DictDatabase.find(entry => entry.word === word);
    return result ? result.meaning : "단어를 찾을 수 없습니다.";
}
