// app.js: DOM 이벤트 연결
document.getElementById("search-btn").addEventListener("click", () => {
    const input = document.getElementById("search-input").value.trim();
    const meaning = searchWord(input);
    document.getElementById("result").textContent = meaning;
});

// 엔터키로 검색
document.getElementById("search-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        document.getElementById("search-btn").click();
    }
});
