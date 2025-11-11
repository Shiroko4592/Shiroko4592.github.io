document.getElementById("searchBtn").addEventListener("click", function() {
  const keyword = document.getElementById("searchInput").value;
  if (WikiDatabase.documents[keyword]) {
    WikiSetting.loadDocument(keyword);
  } else {
    alert("문서를 찾을 수 없습니다.");
  }
});

// 초기 문서 표시
WikiSetting.loadDocument("첫문서");
