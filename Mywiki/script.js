document.getElementById("searchBtn").addEventListener("click", function() {
  const keyword = document.getElementById("searchInput").value.trim();
  if (!keyword) return;

  if (WikiDatabase.documents[keyword]) {
    // 이미 있는 문서면 바로 로드
    WikiSetting.loadDocument(keyword);
  } else {
    // 없는 문서면 생성 페이지로 이동
    WikiSetting.loadCreateDocument(keyword);
  }
});

document.getElementById("searchInput").addEventListener("keypress", function(e) {
  if (e.key === "Enter") document.getElementById("searchBtn").click();
});

// 초기 문서 표시
WikiSetting.loadDocument("첫문서");
