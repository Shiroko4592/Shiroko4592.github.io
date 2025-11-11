const searchInput = document.getElementById("search-input");
const resultDiv = document.getElementById("result");
const historyList = document.getElementById("history-list");
const suggestions = document.getElementById("suggestions");

function updateSuggestions() {
    const query = searchInput.value.trim();
    suggestions.innerHTML = "";
    if (query) {
        const filtered = DictDatabase.filter(entry => entry.word.startsWith(query));
        filtered.forEach(entry => {
            const option = document.createElement("option");
            option.value = entry.word;
            suggestions.appendChild(option);
        });
    }
}

function addHistory(word) {
    const li = document.createElement("li");
    li.textContent = word;
    li.addEventListener("click", () => {
        searchInput.value = word;
        doSearch();
    });
    historyList.prepend(li); // 최신 검색 위로
}

function doSearch() {
    const word = searchInput.value.trim();
    if (!word) return;
    const meaning = searchWord(word);
    resultDiv.textContent = meaning;
    addHistory(word);
}

// 이벤트 연결
document.getElementById("search-btn").addEventListener("click", doSearch);
searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") doSearch();
});
searchInput.addEventListener("input", updateSuggestions);
