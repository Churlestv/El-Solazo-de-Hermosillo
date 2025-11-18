// app.js - Versión mejorada para "Sol del Desierto" (El Solazo)
// - Manejo unificado de datos locales (solazo_news / newsData)
// - Mejora en UI events, debounce, SW, Push, Share, favoritos, paginación

const API_URL = 'https://api.example.com/news'; // reemplaza con tu endpoint real
const VAPID_PUBLIC_KEY = '<REEMPLAZA_CON_TU_VAPID_PUBLICA>'; // si usarás Push real
const PAGE_SIZE = 10;

const state = {
  page: 1,
  pageSize: PAGE_SIZE,
  articles: [],
  filter: 'todos',
  sort: 'new',
  query: '',
  favorites: new Set(JSON.parse(localStorage.getItem('solazo_favs') || '[]')),
};

// ---- Selectores ----
const newsGrid = document.getElementById('news-grid');
const tplArticle = document.getElementById('tpl-article');
const loadMoreBtn = document.getElementById('load-more');
const toggleThemeBtn = document.getElementById('toggle-theme');
const loginBtn = document.getElementById('login-btn');
const loginModal = document.getElementById('login-modal');
const closeLogin = document.getElementById('close-login');
const loginForm = document.getElementById('login-form');
const notifyPermBtn = document.getElementById('notify-perm');
const menuToggle = document.getElementById('menu-toggle');
const mainNav = document.getElementById('main-nav');
const searchInput = document.getElementById('search'); // control section search
const searchBtn = document.getElementById('search-btn');
const searchHeaderInput = document.getElementById('search-header-input'); // header search
const searchHeaderBtn = document.getElementById('search-header-btn');
const sortSel = document.getElementById('sort');
const favsViewBtn = document.getElementById('favorites-view');
const yearEl = document.getElementById('year');

if (yearEl) yearEl.textContent = new Date().getFullYear();

// ---- THEME ----
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

// ---- HELPERS ----
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

// Normalize news stored under different keys and return array
function loadLocalNews() {
  // Prioritize admin key 'solazo_news', fallback to 'newsData'
  const a = safeJSONParse(localStorage.getItem('solazo_news'), null);
  if (Array.isArray(a) && a.length) return a;
  const b = safeJSONParse(localStorage.getItem('newsData'), null);
  if (Array.isArray(b)) return b;
  return [];
}

function saveLocalNews(arr) {
  // persist to both keys for compatibility
  localStorage.setItem('solazo_news', JSON.stringify(arr));
  localStorage.setItem('newsData', JSON.stringify(arr));
}

// ---- Service Worker & Push ----
async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registrado', reg);
    return reg;
  } catch (err) {
    console.warn('Error registrando SW', err);
    return null;
  }
}

async function requestNotifications() {
  if (!('Notification' in window)) { alert('Tu navegador no soporta notificaciones.'); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { alert('Permiso de notificaciones denegado.'); return; }
  const reg = await registerSW();
  if (!reg) { alert('Service Worker no disponible.'); return; }
  if (reg && window.PushManager && VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 10) {
    try {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      // Enviar sub al servidor (implementar endpoint)
      await fetch('/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      alert('Notificaciones activadas.');
    } catch (err) {
      console.warn('No se pudo suscribir a Push', err);
    }
  } else {
    alert('Notificaciones web activadas localmente (sin Push).');
  }
}

notifyPermBtn?.addEventListener('click', requestNotifications);

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ---- Share helper ----
async function tryShare(data) {
  if (navigator.share) {
    try { await navigator.share(data); } catch (e) { console.warn('Share canceled', e); }
    return;
  }
  try {
    await navigator.clipboard.writeText(data.url || window.location.href);
    alert('Enlace copiado al portapapeles.');
  } catch (e) {
    prompt('Copia este enlace:', data.url || window.location.href);
  }
}

// ---- Favorites ----
function persistFavorites() {
  localStorage.setItem('solazo_favs', JSON.stringify(Array.from(state.favorites)));
}
function toggleFavorite(id, el) {
  if (!id) return;
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    if (el) { el.textContent = '☆'; el.setAttribute('aria-pressed', 'false'); }
  } else {
    state.favorites.add(id);
    if (el) { el.textContent = '★'; el.setAttribute('aria-pressed', 'true'); }
  }
  persistFavorites();
}

// ---- Render ----
function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderArticles(list = [], append = false) {
  if (!newsGrid) return;
  if (!append) newsGrid.innerHTML = '';
  if (!list.length && !append) {
    newsGrid.innerHTML = '<div class="placeholder">No hay noticias que coincidan.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach(article => {
    const tpl = tplArticle.content.cloneNode(true);
    const img = tpl.querySelector('img');
    const pub = tpl.querySelector('.published');
    const favBtn = tpl.querySelector('.fav-btn');
    const title = tpl.querySelector('.title');
    const excerpt = tpl.querySelector('.excerpt');
    const tagsWrap = tpl.querySelector('.card-tags');
    const readMore = tpl.querySelector('.read-more');
    const shareBtn = tpl.querySelector('.share-btn');

    img.src = article.image || './assets/placeholder.jpg';
    img.alt = article.title || 'Imagen';
    pub.textContent = formatDate(article.published_at || article.date || new Date().toISOString());
    title.textContent = article.title || 'Título';
    excerpt.textContent = article.excerpt || (article.description ? article.description.slice(0, 140) + '…' : '');

    const categories = (article.categories || [article.category || 'General']).slice(0, 3);
    tagsWrap.innerHTML = ''; // limpiar
    categories.forEach(t => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = t;
      span.addEventListener('click', () => {
        state.filter = (t || 'todos').toLowerCase();
        state.page = 1;
        fetchAndRender();
      });
      tagsWrap.appendChild(span);
    });

    readMore.href = article.url || '#';
    favBtn.addEventListener('click', () => toggleFavorite(article.id, favBtn));
    if (state.favorites.has(article.id)) {
      favBtn.textContent = '★';
      favBtn.setAttribute('aria-pressed', 'true');
    } else {
      favBtn.textContent = '☆';
      favBtn.setAttribute('aria-pressed', 'false');
    }
    shareBtn.addEventListener('click', () => tryShare({ title: article.title, text: article.excerpt, url: article.url || window.location.href }));

    frag.appendChild(tpl);
  });
  newsGrid.appendChild(frag);
}

// ---- Fetch (usa localStorage si no hay API real) ----
async function fetchNews({ page = 1, q = '', cat = 'todos', sort = 'new' } = {}) {
  try {
    // Si no se configuró API real -> usar noticias locales
    if (API_URL.includes('example.com')) {
      const all = loadLocalNews();
      // filtrado por categoría
      let filtered = all.slice();
      if (cat && cat !== 'todos') filtered = filtered.filter(n => (n.category || '').toLowerCase() === cat.toLowerCase());
      // búsqueda simple (título + excerpt)
      if (q && q.length) {
        const ql = q.toLowerCase();
        filtered = filtered.filter(n => ((n.title || '') + ' ' + (n.excerpt || '')).toLowerCase().includes(ql));
      }
      // orden (por fecha desc por defecto)
      filtered.sort((a, b) => {
        const da = new Date(a.published_at || a.date || 0).getTime();
        const db = new Date(b.published_at || b.date || 0).getTime();
        return sort === 'old' ? da - db : db - da;
      });
      // paginación
      const start = (page - 1) * state.pageSize;
      const pageSlice = filtered.slice(start, start + state.pageSize);
      // map to normalized shape: ensure id exists
      const normalized = pageSlice.map((n, idx) => ({ id: n.id || `local-${start + idx}`, ...n }));
      return normalized;
    }

    // Ejemplo de fetch real (descomentarlo cuando tengas API)
    // const params = new URLSearchParams({ page, pageSize: state.pageSize, q, cat, sort });
    // const res = await fetch(`${API_URL}?${params.toString()}`);
    // if(!res.ok) throw new Error('Error al obtener noticias');
    // return await res.json();

    return [];
  } catch (err) {
    console.error('fetchNews error', err);
    return [];
  }
}

// ---- Controller ----
async function fetchAndRender({ append = false } = {}) {
  try {
    const items = await fetchNews({ page: state.page, q: state.query, cat: state.filter, sort: state.sort });
    if (append) state.articles = state.articles.concat(items);
    else state.articles = items;
    renderArticles(items, append);

    // Notificación ligera con la primera noticia
    if (items.length && Notification.permission === 'granted' && state.page === 1) {
      const first = items[0];
      if (first) showNotification(first.title, { body: (first.excerpt || '').slice(0, 80), icon: first.image });
    }
    // Mostrar/ocultar "Cargar más"
    if (!items.length || items.length < state.pageSize) loadMoreBtn.style.display = 'none';
    else loadMoreBtn.style.display = 'inline-block';
  } catch (err) {
    console.error('fetchAndRender error', err);
  }
}

// ---- UI events ----
loadMoreBtn?.addEventListener('click', async () => { state.page += 1; await fetchAndRender({ append: true }); });

// search controls: section and header (debounced)
const doSearch = debounce(() => {
  // prefer header search if filled
  const qHeader = (searchHeaderInput?.value || '').trim();
  const qSection = (searchInput?.value || '').trim();
  state.query = qHeader.length ? qHeader : qSection;
  state.page = 1;
  fetchAndRender();
}, 300);

searchBtn?.addEventListener('click', doSearch);
searchInput?.addEventListener('input', doSearch);
searchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

searchHeaderBtn?.addEventListener('click', doSearch);
searchHeaderInput?.addEventListener('input', doSearch);
searchHeaderInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

// sort
sortSel?.addEventListener('change', () => { state.sort = sortSel.value; state.page = 1; fetchAndRender(); });

// nav category buttons
document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.dataset.cat || btn.textContent.trim().toLowerCase();
    state.filter = cat || 'todos';
    state.page = 1;
    fetchAndRender();
    // mobile: close menu by removing .active if present
    if (window.innerWidth < 900 && mainNav) mainNav.classList.remove('active');
  });
});

// favorites view
favsViewBtn?.addEventListener('click', () => {
  const favIds = Array.from(state.favorites);
  if (!favIds.length) { alert('No tienes favoritos todavía.'); return; }
  // Mostrar favoritos desde el state.articles si están cargadas, si no, reconstruir con placeholders
  const favArticles = state.articles.filter(a => state.favorites.has(a.id));
  if (!favArticles.length) {
    renderArticles(favIds.map(id => ({ id, title: `Favorito ${id}`, excerpt: 'Guardado en favoritos', image: `https://picsum.photos/seed/${id}/900/600`, url: '#', categories: ['Favorito'], published_at: new Date().toISOString() })));
  } else {
    renderArticles(favArticles);
  }
});

// menu toggle (mobile) - use class .active
menuToggle?.addEventListener('click', () => {
  if (!mainNav) return;
  mainNav.classList.toggle('active');
});

// ---- Notifications helper ----
function showNotification(title, opts = {}) {
  if (Notification.permission !== 'granted') return;
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.showNotification(title, opts); });
  } else {
    new Notification(title, opts);
  }
}

// ---- INIT ----
(async function init() {
  // register SW (non-blocking)
  registerSW().catch(() => { /* noop */ });

  // If there are local articles (admin), pre-populate state.articles for immediate favorites handling
  const localArticles = loadLocalNews();
  if (localArticles.length) {
    // normalize ids
    state.articles = localArticles.map((a, i) => ({ id: a.id || `local-${i}`, ...a }));
    renderArticles(state.articles);
  }

  // fetch remote / local paginated view
  await fetchAndRender();

  // small polling example (optional)
  // setInterval(fetchAndRender, 5 * 60_000);
})();
