const WikiTable = {
  parse: function(text) {
    if (!text) return "";

    // #련결 [문서이름] → 링크
    text = text.replace(/#련결 \[(.+?)\]/g, (_, doc) => `<a href="#" onclick="WikiSetting.loadDocument('${doc}')">${doc}</a>`);

    // [[분류:분류]] → 링크
    text = text.replace(/\[\[분류:(.+?)\]\]/g, (_, cat) => `<a href="#" onclick="WikiSetting.loadCategory('${cat}')">분류:${cat}</a>`);

    // -기울임 글씨-
    text = text.replace(/-(.+?)-/g, '<i>$1</i>');

    // ~~취소선 글씨~~
    text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');

    // ~~~루비글자[글씨]~~~
    text = text.replace(/~~~(.+?)\[(.+?)\]~~~/g, '<ruby>$2<rt>$1</rt></ruby>');

    // ~글씨[각주글씨]~
    text = text.replace(/~(.+?)\[(.+?)\]~/g, '$1<sup class="footnote">$2</sup>');

    return text;
  }
};
