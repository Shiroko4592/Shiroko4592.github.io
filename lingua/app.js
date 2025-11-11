const searchInput = document.getElementById("search-input");
const resultDiv = document.getElementById("result");
const historyList = document.getElementById("history-list");
const suggestions = document.getElementById("suggestions");
const copyBtn = document.getElementById("copy-btn");
const addBtn = document.getElementById("add-btn");
const newWordInput = document.getElementById("new-word");
const newMeaningInput = document.getElementById("new-meaning");

// 로컬 저장소 사용
function loadDictFromLocal() {
    const saved = localStorage.getItem("DictDatabase");
    if (saved) {
        const data = JSON.parse(saved);
        data.forEach(entry => DictDatabase.push(entry));
    }
}

function saveDictToLocal() {
    localStorage.setItem("DictDatabase", JSON.stringify(DictDatabase));
}

addBtn.addEventListener("click", () => {
    const word = newWordInput.value.trim();
    const meaning = newMeaningInput.value.trim();
    if (!word || !meaning) {
        alert("단어와 뜻을 모두 입력해주세요.");
        return;
    }
    // 중복 확인
    const exists = DictDatabase.some(entry => entry.word === word);
    if (exists) {
        alert("이미 존재하는 단어입니다.");
        return;
    }
    const entry = { word, meaning };
    DictDatabase.push(entry);
    saveDictToLocal(); // 로컬 저장
    alert(`"${word}" 단어가 추가되었습니다.`);
    newWordInput.value = "";
    newMeaningInput.value = "";
});

// 초기 로컬 데이터 불러오기
loadDictFromLocal();

copyBtn.addEventListener("click", () => {
    const text = resultDiv.textContent;
    if (text) {
        navigator.clipboard.writeText(text)
            .then(() => alert("뜻이 복사되었습니다!"))
            .catch(() => alert("복사 실패!"));
    }
});

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

let draggedItem = null;

function addHistory(word) {
    const li = document.createElement("li");
    li.textContent = word;
    li.draggable = true; // 드래그 가능

    li.addEventListener("click", () => {
        searchInput.value = word;
        doSearch();
    });

    // 카드 등장 애니메이션
    li.style.opacity = 0;
    li.style.transform = "translateY(-10px)";
    historyList.prepend(li);
    setTimeout(() => {
        li.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        li.style.opacity = 1;
        li.style.transform = "translateY(0)";
    }, 10);

    // 드래그 이벤트들
    li.addEventListener("dragstart", (e) => {
        draggedItem = li;
        setTimeout(() => (li.style.opacity = "0.3"), 0);
    });

    li.addEventListener("dragend", (e) => {
        draggedItem.style.opacity = "1";
        draggedItem = null;
    });

    li.addEventListener("dragover", (e) => {
        e.preventDefault();
        const draggingOver = e.target.closest("li");
        if (draggingOver && draggingOver !== draggedItem) {
            const allItems = Array.from(historyList.children);
            const draggingIndex = allItems.indexOf(draggedItem);
            const overIndex = allItems.indexOf(draggingOver);
            if (draggingIndex > overIndex) {
                historyList.insertBefore(draggedItem, draggingOver);
            } else {
                historyList.insertBefore(draggedItem, draggingOver.nextSibling);
            }
        }
    });
}
