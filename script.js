// 이미지 로딩 최적화 (Lazy Loading)
if ('IntersectionObserver' in window) {
  const images = document.querySelectorAll('img');
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.loading = 'lazy';
        observer.unobserve(img);
      }
    });
  });
  images.forEach(img => imageObserver.observe(img));
}

// 다크모드 토글
function initThemeToggle() {
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'theme-toggle';
  toggleBtn.innerHTML = '🌙';
  toggleBtn.title = '다크모드 토글';
  document.body.appendChild(toggleBtn);

  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    toggleBtn.innerHTML = '☀️';
  }

  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    toggleBtn.innerHTML = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
}

// 검색 기능
function initSearch() {
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';
  searchContainer.innerHTML = '<input type="text" class="search-input" placeholder="🔍 사진, 장소, 음식 검색...">';
  document.body.insertBefore(searchContainer, document.body.firstChild);

  const searchInput = searchContainer.querySelector('.search-input');
  const allText = document.body.innerText.toLowerCase();

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const figures = document.querySelectorAll('figure');
    const galleries = document.querySelectorAll('.gallery');
    const sections = document.querySelectorAll('h2, h3');

    if (query === '') {
      figures.forEach(fig => fig.style.display = '');
      galleries.forEach(gal => gal.style.display = '');
      sections.forEach(sec => sec.style.display = '');
      return;
    }

    sections.forEach(sec => {
      const text = sec.innerText.toLowerCase();
      sec.style.display = text.includes(query) ? '' : 'none';
    });

    figures.forEach(fig => {
      const caption = fig.innerText.toLowerCase();
      fig.style.display = caption.includes(query) ? '' : 'none';
    });

    galleries.forEach(gal => {
      let hasMatch = false;
      const children = gal.querySelectorAll('figure, img');
      children.forEach(child => {
        const text = child.getAttribute('alt') || child.innerText || '';
        if (text.toLowerCase().includes(query)) {
          child.style.display = '';
          hasMatch = true;
        } else {
          child.style.display = 'none';
        }
      });
      gal.style.display = hasMatch ? '' : 'none';
    });
  });
}

// 이미지 필터
function initImageFilters() {
  const filterContainer = document.createElement('div');
  filterContainer.className = 'image-filter-controls';
  filterContainer.innerHTML = `
    <button class="filter-btn active" data-filter="none">원본</button>
    <button class="filter-btn" data-filter="sepia">세피아</button>
    <button class="filter-btn" data-filter="grayscale">흑백</button>
    <button class="filter-btn" data-filter="bright">밝기</button>
    <button class="filter-btn" data-filter="saturate">채도</button>
  `;
  document.body.insertBefore(filterContainer, document.body.firstChild.nextSibling);

  const buttons = filterContainer.querySelectorAll('.filter-btn');
  const images = document.querySelectorAll('img');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');

      images.forEach(img => {
        let filterStyle = '';
        if (filter === 'sepia') filterStyle = 'sepia(100%)';
        else if (filter === 'grayscale') filterStyle = 'grayscale(100%)';
        else if (filter === 'bright') filterStyle = 'brightness(1.3)';
        else if (filter === 'saturate') filterStyle = 'saturate(1.8)';

        img.style.filter = filterStyle;
      });

      localStorage.setItem('imageFilter', filter);
    });
  });

  // 저장된 필터 복원
  const savedFilter = localStorage.getItem('imageFilter') || 'none';
  const savedBtn = filterContainer.querySelector(`[data-filter="${savedFilter}"]`);
  if (savedBtn) {
    savedBtn.click();
  }
}

// 타임라인 변환
function initTimeline() {
  const headers = document.querySelectorAll('h3');
  headers.forEach(header => {
    if (header.innerText.match(/\d+\s*(?:일|일차|일째)/)) {
      const parent = header.parentElement;
      const timelineContainer = document.createElement('div');
      timelineContainer.className = 'timeline-container';
      parent.insertBefore(timelineContainer, header);

      let content = header;
      while (content && !content.nextElementSibling?.querySelector('h3')) {
        if (content === header) {
          content = content.nextElementSibling;
        } else if (content) {
          const timelineItem = document.createElement('div');
          timelineItem.className = 'timeline-item';
          const clone = content.cloneNode(true);
          timelineItem.appendChild(clone);
          timelineContainer.appendChild(timelineItem);
          content.remove();
          content = timelineContainer.nextElementSibling;
        } else {
          break;
        }
      }
    }
  });
}

// 좋아요 기능
function initLikes() {
  const figures = document.querySelectorAll('figure');
  figures.forEach((fig, index) => {
    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-button';
    likeBtn.innerHTML = '❤️';
    likeBtn.title = '좋아요';

    const likeCount = document.createElement('div');
    likeCount.className = 'like-count';
    likeCount.innerText = '0';

    fig.appendChild(likeBtn);
    fig.appendChild(likeCount);

    const storedLikes = JSON.parse(localStorage.getItem('likes') || '{}');
    const likes = storedLikes[index] || 0;
    likeCount.innerText = likes;
    if (likes > 0) {
      likeBtn.classList.add('liked');
    }

    likeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      likeBtn.classList.toggle('liked');
      const newLikes = likeBtn.classList.contains('liked') ? likes + 1 : Math.max(likes - 1, 0);
      likeCount.innerText = newLikes;

      const allLikes = JSON.parse(localStorage.getItem('likes') || '{}');
      allLikes[index] = newLikes;
      localStorage.setItem('likes', JSON.stringify(allLikes));
    });
  });
}

// 지도 통합 (Leaflet.js)
function initMap() {
  const mapContainer = document.createElement('div');
  mapContainer.className = 'map-container';
  mapContainer.innerHTML = '<div id="map"></div>';

  const footerNote = document.querySelector('h2:contains("각주")');
  if (footerNote) {
    footerNote.parentElement.insertBefore(mapContainer, footerNote);
  } else {
    document.body.appendChild(mapContainer);
  }

  // Leaflet 라이브러리 동적 로드
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  document.head.appendChild(script);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  script.onload = () => {
    if (window.L) {
      const map = window.L.map('map').setView([25.0330, 121.5654], 13);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // 대만 주요 관광지
      const locations = [
        { name: '국립고궁박물관', lat: 25.0330, lng: 121.5654, icon: '🏛️' },
        { name: '청핀서점', lat: 25.0281, lng: 121.5447, icon: '📚' },
        { name: '왓데이키친', lat: 25.0326, lng: 121.5398, icon: '🍽️' },
        { name: '해열루(海悅樓)', lat: 25.0356, lng: 121.5500, icon: '☕' }
      ];

      locations.forEach(loc => {
        const marker = window.L.marker([loc.lat, loc.lng]).addTo(map);
        marker.bindPopup(`<strong>${loc.name}</strong>`);
        marker.setIcon(window.L.divIcon({
          html: `<div style="font-size: 28px;">${loc.icon}</div>`,
          iconSize: [28, 28],
          className: 'custom-marker'
        }));
      });
    }
  };
}

// 모바일 스와이프 슬라이더
function initSwipeSlider() {
  const galleries = document.querySelectorAll('.gallery');
  galleries.forEach(gallery => {
    let startX = 0;
    let currentIndex = 0;
    const items = gallery.querySelectorAll('img, figure');

    if (items.length <= 1) return;

    gallery.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    });

    gallery.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const diff = startX - endX;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          currentIndex = (currentIndex + 1) % items.length;
        } else {
          currentIndex = (currentIndex - 1 + items.length) % items.length;
        }

        // 슬라이더 효과
        const scrollLeft = gallery.scrollLeft;
        const itemWidth = gallery.querySelector('img')?.width || gallery.offsetWidth;
        gallery.scrollLeft = scrollLeft + (diff > 0 ? itemWidth : -itemWidth);
      }
    });
  });
}

// 각주 스무스 스크롤 (기존 기능)
function initFootnotes() {
  const footnoteLinks = document.querySelectorAll('sup a');
  footnoteLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        target.style.backgroundColor = 'rgba(42, 93, 132, 0.1)';
        setTimeout(() => {
          target.style.backgroundColor = '';
        }, 2000);
      }
    });
  });
}

// 이미지 줌 (기존 기능)
function initImageZoom() {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('click', function() {
      const scale = window.innerWidth < 768 ? 1.5 : 2;
      const currentScale = img.style.transform.match(/scale\(([^)]+)\)/);
      const isScaled = currentScale && currentScale[1] !== '1';

      if (isScaled) {
        img.style.transform = 'scale(1)';
        img.style.cursor = 'zoom-in';
      } else {
        img.style.transform = `scale(${scale})`;
        img.style.cursor = 'zoom-out';
        img.style.position = 'relative';
        img.style.zIndex = '999';
      }
    });
  });
}

// 모든 기능 초기화
document.addEventListener('DOMContentLoaded', function() {
  initThemeToggle();
  initSearch();
  initImageFilters();
  initTimeline();
  initLikes();
  initMap();
  initSwipeSlider();
  initFootnotes();
  initImageZoom();
});
