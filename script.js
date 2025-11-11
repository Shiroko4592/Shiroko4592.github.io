// 간단한 이미지 클릭 확대 기능
document.addEventListener("DOMContentLoaded", function() {
    const images = document.querySelectorAll("img");
    images.forEach(img => {
        img.style.cursor = "zoom-in";
        img.addEventListener("click", function() {
            if (img.style.transform === "scale(2)") {
                img.style.transform = "scale(1)";
                img.style.transition = "transform 0.3s ease";
            } else {
                img.style.transform = "scale(2)";
                img.style.transition = "transform 0.3s ease";
            }
        });
    });

    // 각주 클릭 시 부드럽게 스크롤 이동
    const footnoteLinks = document.querySelectorAll("sup a");
    footnoteLinks.forEach(link => {
        link.addEventListener("click", function(e) {
            e.preventDefault();
            const targetId = link.getAttribute("href").substring(1);
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: "smooth" });
            }
        });
    });
});
