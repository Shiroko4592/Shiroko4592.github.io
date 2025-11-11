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
  }
};
