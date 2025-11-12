document.addEventListener("DOMContentLoaded", function() {
    const images = document.querySelectorAll("img");
    images.forEach(img => {
        img.addEventListener("click", function() {
            const scale = window.innerWidth < 768 ? 1.5 : 2; // 모바일 대응
            if (img.style.transform === `scale(${scale})`) {
                img.style.transform = "scale(1)";
            } else {
                img.style.transform = `scale(${scale})`;
            }
        });
    });

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
