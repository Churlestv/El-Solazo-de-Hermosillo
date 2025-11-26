// app.js - Versión con Integración Facebook y Hashtags

// ==========================================
// 1. CONFIGURACIÓN FACEBOOK & API
// ==========================================
// Reemplaza estos valores con los de tu App en Facebook Developers
const FB_PAGE_ID = '104291607691243'; 
const FB_ACCESS_TOKEN = 'EAAJ727DpuJMBQPg97xdWLcKNKRdcZBXnYMUqhspcZBUPEQ3qiD3q7iQoVN0PzOfUZBNJCi3rXU80Xd9zbDkyv5olOzAVgEyezD0bBarN4XHzZC2mWO9xfyZA6bVO09Mh82CkwOtYe1GcMdHC9q6gQmwJRjlArU3HUWFlaUNNkyixUJf7rzSfCPI9a3n73ZAFhDxbHRCGRFpN16CITy8tnqPijYmJusbY6vqUz3iv4c2QZDZD'; 
// URL para traer posts con mensaje, imagen, fecha y link
const FB_API_URL = `https://graph.facebook.com/v18.0/${FB_PAGE_ID}/posts?fields=message,full_picture,created_time,permalink_url,attachments&limit=20&access_token=${FB_ACCESS_TOKEN}`;

const API_URL = 'https://api.example.com/news'; 
const VAPID_PUBLIC_KEY = '<REEMPLAZA_CON_TU_VAPID_PUBLICA>';
const PAGE_SIZE = 10;

// Credenciales Admin
const ADMIN_USER = {
  email: "adminprueba@elsolazo.com",
  password: "AlexisMontaño", 
  role: "admin",
};

const state = {
  page: 1,
  pageSize: PAGE_SIZE,
  articles: [],
  filter: 'todos',
  sort: 'new',
  query: '',
  favorites: new Set(JSON.parse(localStorage.getItem('solazo_favs') || '[]')),
};

// ==========================================
// 2. DETECCIÓN DE HASHTAGS (Clasificador)
// ==========================================
function mapHashtagsToCategory(text) {
  if (!text) return 'general';
  const lowerText = text.toLowerCase();

  // Mapeo: Si el texto contiene X, devuelve la categoría Y
  // Estos returns deben coincidir con los data-cat del HTML
  if (lowerText.includes('#mundo') || lowerText.includes('#nacional') || lowerText.includes('#internacional')) return 'mundo';
  if (lowerText.includes('#sonora') || lowerText.includes('#hermosillo')) return 'sonora';
  if (lowerText.includes('#seguridad') || lowerText.includes('#justicia') || lowerText.includes('#policiaca')) return 'seguridad';
  if (lowerText.includes('#sociedad') || lowerText.includes('#viral')) return 'sociedad';
  if (lowerText.includes('#cultura') || lowerText.includes('#cine') || lowerText.includes('#ciencia')) return 'cultura';
  if (lowerText.includes('#politica') || lowerText.includes('#gobierno')) return 'politica'; // Nueva categoría

  return 'todos'; // Si no detecta nada específico
}

// ==========================================
// 3. LOGICA PRINCIPAL (Selectores & Helpers)
// ==========================================
const newsGrid = document.getElementById('news-grid');
const tplArticle = document.getElementById('tpl-article');
const loadMoreBtn = document.getElementById('load-more');
const toggleThemeBtn = document.getElementById('toggle-theme');
const notifyPermBtn = document.getElementById('notify-perm');
const menuToggle = document.getElementById('menu-toggle');
const mainNav = document.getElementById('main-nav');
const searchInput = document.getElementById('search'); 
const searchBtn = document.getElementById('search-btn');
const sortSel = document.getElementById('sort');
const favsViewBtn = document.getElementById('favorites-view');
const yearEl = document.getElementById('year');
const adminLink = document.getElementById('admin-link');

if (yearEl) yearEl.textContent = new Date().getFullYear();

// Theme logic
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0a09' : '#fff');
  if (toggleThemeBtn) toggleThemeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('solazo_theme', theme);
}
const savedTheme = localStorage.getItem('solazo_theme') ||
  ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
applyTheme(savedTheme);
toggleThemeBtn?.addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// Helpers
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
function safeJSONParse(v, fallback = []) {
  try { return JSON.parse(v); } catch (_) { return fallback; }
}

// Carga local (Admin Panel)
function loadLocalNews() {
  const siteData = safeJSONParse(localStorage.getItem('solazo_site'), null);
  if (siteData && Array.isArray(siteData.notes)) return siteData.notes;
  const a = safeJSONParse(localStorage.getItem('solazo_news'), null);
  if (Array.isArray(a) && a.length) return a;
  return [];
}

// ==========================================
// 4. FETCH DE NOTICIAS (Híbrido: FB + Local)
// ==========================================
async function fetchNews({ page = 1, q = '', cat = 'todos', sort = 'new' } = {}) {
  let allNews = [];

  // A) Traer de Facebook (CORRECCIÓN APLICADA AQUÍ)
  try {
    // La conexión se intenta directamente si el Token y ID están presentes
    // La cláusula 'if' anterior se eliminó ya que los valores ahora son reales.
    const response = await fetch(FB_API_URL);
    const fbData = await response.json();

    if (fbData && fbData.data) {
      const fbArticles = fbData.data.map(post => {
        // Aquí ocurre la magia de los hashtags
        const categoryDetected = mapHashtagsToCategory(post.message);
        
        return {
          id: post.id,
          // Usar primera línea como título, o fallback
          title: post.message ? post.message.split('\n')[0] : 'Noticia El Solazo',
          excerpt: post.message || 'Ver en Facebook...',
          image: post.full_picture || 'new-Logo.png',
          date: post.created_time,
          url: post.permalink_url,
          category: categoryDetected, // 'politica', 'sonora', etc.
          source: 'facebook'
        };
      });
      allNews = allNews.concat(fbArticles);
    } else if (fbData.error) {
        console.warn('Error de Facebook API (puede ser token expirado o permisos):', fbData.error.message);
    }
  } catch (err) {
    console.warn('Fallo al conectar con Facebook API:', err);
  }

  // B) Traer Local (Admin)
  const localNews = loadLocalNews();
  // Normalizar locales para asegurar consistencia
  const localNormalized = localNews.map((n, idx) => ({
      id: n.id || `local-${idx}`,
      title: n.title,
      excerpt: n.excerpt || n.description,
      image: n.images?.[0] || n.image || 'new-Logo.png',
      date: n.date || n.published_at,
      url: n.url || '#',
      category: (n.category || 'todos').toLowerCase(),
      source: 'local'
  }));
  
  allNews = allNews.concat(localNormalized);

  // C) Filtrado y Ordenamiento
  let filtered = allNews;

  // 1. Filtro Categoría
  if (cat && cat !== 'todos') {
    filtered = filtered.filter(n => (n.category || 'todos') === cat);
  }

  // 2. Búsqueda
  if (q && q.length) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(n => ((n.title || '') + ' ' + (n.excerpt || '')).toLowerCase().includes(ql));
  }

  // 3. Orden
  filtered.sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return sort === 'old' ? da - db : db - da;
  });

  // 4. Paginación
  const start = (page - 1) * state.pageSize;
  const sliced = filtered.slice(start, start + state.pageSize);
  
  return sliced;
}

// ==========================================
// 5. RENDERIZADO
// ==========================================
function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso; 
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }); 
}

function renderArticles(list = [], append = false) {
  if (!newsGrid) return;
  if (!append) newsGrid.innerHTML = '';
  if (!list.length && !append) {
    newsGrid.innerHTML = '<div class="placeholder">No hay noticias en esta sección.</div>';
    loadMoreBtn.style.display = 'none';
    return;
  }
  
  const frag = document.createDocumentFragment();
  list.forEach(article => {
    const tpl = tplArticle.content.cloneNode(true);
    const img = tpl.querySelector('img');
    const pub = tpl.querySelector('.published');
    const favBtn = tpl.querySelector('.fav-btn');
    const titleEl = tpl.querySelector('.title');
    const excerpt = tpl.querySelector('.excerpt');
    const tagsWrap = tpl.querySelector('.card-tags');
    const readMore = tpl.querySelector('.read-more');
    const shareBtn = tpl.querySelector('.share-btn');
    const cardId = article.id || `art-${Math.random()}`;

    img.src = article.image;
    img.alt = article.title;
    img.onerror = () => { img.src = 'new-Logo.png'; }; // Fallback imagen
    
    pub.textContent = formatDate(article.date);
    titleEl.textContent = article.title;
    // Limitar texto del excerpt
    const cleanExcerpt = (article.excerpt || '').replace(/#/g, ''); // Quitar hashtags visualmente del resumen si quieres
    excerpt.textContent = cleanExcerpt.slice(0, 120) + (cleanExcerpt.length > 120 ? '...' : '');

    // Tags
    const cat = article.category || 'General';
    tagsWrap.innerHTML = `<span class="tag">${cat.toUpperCase()}</span>`;
    tagsWrap.querySelector('.tag').addEventListener('click', (e) => {
        e.preventDefault();
        state.filter = cat;
        state.page = 1;
        fetchAndRender();
    });

    readMore.href = article.url || '#';
    
    // Favoritos logic
    if (state.favorites.has(cardId)) {
        favBtn.textContent = '★';
    } else {
        favBtn.textContent = '☆';
    }
    favBtn.addEventListener('click', () => {
        if (state.favorites.has(cardId)) {
            state.favorites.delete(cardId);
            favBtn.textContent = '☆';
        } else {
            state.favorites.add(cardId);
            favBtn.textContent = '★';
        }
        localStorage.setItem('solazo_favs', JSON.stringify(Array.from(state.favorites)));
    });

    shareBtn.addEventListener('click', () => {
        if (navigator.share) {
            navigator.share({ title: article.title, url: article.url });
        } else {
            navigator.clipboard.writeText(article.url);
            alert('Enlace copiado');
        }
    });

    frag.appendChild(tpl);
  });
  newsGrid.appendChild(frag);
}

// Controller
async function fetchAndRender({ append = false } = {}) {
  const items = await fetchNews({ page: state.page, q: state.query, cat: state.filter, sort: state.sort });
  if (append) state.articles = state.articles.concat(items);
  else state.articles = items;
  renderArticles(items, append);
  
  if (!items.length || items.length < state.pageSize) loadMoreBtn.style.display = 'none';
  else loadMoreBtn.style.display = 'inline-block';
}

// ==========================================
// 6. EVENTOS UI
// ==========================================
loadMoreBtn?.addEventListener('click', async () => { state.page += 1; await fetchAndRender({ append: true }); });

const doSearch = debounce(() => {
  state.query = (searchInput?.value || '').trim();
  state.page = 1;
  fetchAndRender();
}, 300);

searchBtn?.addEventListener('click', doSearch);
searchInput?.addEventListener('input', doSearch);
searchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

sortSel?.addEventListener('change', () => { state.sort = sortSel.value; state.page = 1; fetchAndRender(); });

document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', (e) => {
    if (btn.tagName === 'A') return; 
    // Obtener categoría del data-cat
    const cat = btn.dataset.cat;
    state.filter = cat || 'todos';
    state.page = 1;
    fetchAndRender();
    if (window.innerWidth < 900 && mainNav) mainNav.classList.remove('active');
  });
});

favsViewBtn?.addEventListener('click', () => {
   // Lógica simplificada de favoritos para visualización
   alert("Función de favoritos: filtra tus noticias guardadas.");
});

menuToggle?.addEventListener('click', () => { if (mainNav) mainNav.classList.toggle('active'); });

// Inicializar
fetchAndRender();

// ==========================================
// 7. LOGIN & REGISTRO (Modal)
// ==========================================
let isLoginMode = true;
const loginForm = document.getElementById('login-form');
const loginModal = document.getElementById('login-modal');
const closeLogin = document.getElementById('close-login');

// Abrir modal desde enlace
document.querySelector('a[href="login.html"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    if(loginModal) loginModal.style.display = 'flex';
});
closeLogin?.addEventListener('click', () => { if(loginModal) loginModal.style.display = 'none'; });

// Manejo formulario
loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value.trim();

  // Admin check
  if (email === ADMIN_USER.email && pass === ADMIN_USER.password) {
      localStorage.setItem("user", JSON.stringify(ADMIN_USER));
      alert("Bienvenido Admin.");
      if(adminLink) adminLink.hidden = false;
      if(loginModal) loginModal.style.display = 'none';
      return;
  }
  // User normal check (simulado)
  alert("Login simulado exitoso");
  if(loginModal) loginModal.style.display = 'none';
});