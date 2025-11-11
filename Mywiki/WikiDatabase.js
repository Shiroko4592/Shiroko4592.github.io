const WikiDatabase = {
  documents: {
    "첫문서": "#련결 [두번째문서]\n-안녕하세요- 이건 테스트 문서입니다.\n[[분류:테스트]]\n~위키[각주 내용]~",
    "두번째문서": "~~취소선 테스트~~\n~~~루비[글자]~~~"
  },

  categories: {
    "테스트": ["첫문서"]
  },

  getDocument: function(name) {
    return this.documents[name] || "문서를 찾을 수 없습니다.";
  },

  getCategory: function(name) {
    return this.categories[name] || [];
  }
};
