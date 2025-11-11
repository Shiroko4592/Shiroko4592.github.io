const WikiSetting = {
  loadDocument: function(name) {
    const content = WikiDatabase.getDocument(name);
    document.getElementById("content").innerHTML = WikiTable.parse(content);
  },

  loadCategory: function(name) {
    const docs = WikiDatabase.getCategory(name);
    let html = `<h2>분류: ${name} 분류로 묶인 문서들</h2><ul>`;
    docs.forEach(doc => html += `<li><a href="#" onclick="WikiSetting.loadDocument('${doc}')">${doc}</a></li>`);
    html += "</ul>";
    document.getElementById("content").innerHTML = html;
  },

  // 새로운 문서 생성 페이지 로딩
  loadCreateDocument: function(name) {
    const html = `
      <h2>새 문서 생성: ${name}</h2>
      <textarea id="newDocContent" rows="15" style="width:100%;" placeholder="문서 내용을 입력하세요"></textarea>
      <br><br>
      <button onclick="WikiSetting.createDocument('${name}')">생성</button>
    `;
    document.getElementById("content").innerHTML = html;
  },

  // 문서 생성 후 데이터베이스에 추가
  createDocument: function(name) {
    const content = document.getElementById("newDocContent").value.trim();
    if (!content) {
      alert("내용을 입력해주세요.");
      return;
    }

    WikiDatabase.documents[name] = content;

    // 분류 자동 수집 (예: [[분류:테스트]] 있으면 분류 등록)
    const categoryMatches = content.match(/\[\[분류:(.+?)\]\]/g);
    if (categoryMatches) {
      categoryMatches.forEach(match => {
        const catName = match.replace(/\[\[분류:(.+?)\]\]/, '$1');
        if (!WikiDatabase.categories[catName]) WikiDatabase.categories[catName] = [];
        if (!WikiDatabase.categories[catName].includes(name)) {
          WikiDatabase.categories[catName].push(name);
        }
      });
    }

    alert(`문서 '${name}'이(가) 생성되었습니다!`);
    WikiSetting.loadDocument(name);
  }
};
