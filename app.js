// app.js - Versión mejorada para "El Solazo" (index.html)
// - Manejo unificado de datos locales (solazo_news / newsData)
// - Mejora en UI events, debounce, SW, Push, Share, favoritos, paginación

const API_URL = 'https://api.example.com/news'; // reemplaza con tu endpoint real
const VAPID_PUBLIC_KEY = '<REEMPLAZA_CON_TU_VAPID_PUBLICA>'; // si usarás Push real
const PAGE_SIZE = 10;

// 🧑‍💼 Credenciales predefinidas del administrador (para el modal en index.html)
const ADMIN_USER = {
  email: "adminprueba@elsolazo.com",
  password: "AlexisMontaño", // **ADVERTENCIA: Dejar en texto plano es inseguro, cambiar en producción**
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
const searchInput = document.getElementById('search'); 
const searchBtn = document.getElementById('search-btn');
// const searchHeaderInput = document.getElementById('search-header-input'); // No existe en index.html
// const searchHeaderBtn = document.getElementById('search-header-btn'); // No existe en index.html
const sortSel = document.getElementById('sort');
const favsViewBtn = document.getElementById('favorites-view');
const yearEl = document.getElementById('year');
const adminLink = document.getElementById('admin-link');
const loginGuestBtn = document.getElementById('login-guest');

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
  // Prioritize admin key 'solazo_site' (notes array), fallback to old keys
  const siteData = safeJSONParse(localStorage.getItem('solazo_site'), null);
  if (siteData && Array.isArray(siteData.notes)) return siteData.notes;

  const a = safeJSONParse(localStorage.getItem('solazo_news'), null);
  if (Array.isArray(a) && a.length) return a;
  const b = safeJSONParse(localStorage.getItem('newsData'), null);
  if (Array.isArray(b)) return b;
  return [];
}

function saveLocalNews(arr) {
  // Función de guardado no usada en app.js, solo en admin.js
  // Se mantiene para coherencia, pero se recomienda centralizar en admin.js
  localStorage.setItem('solazo_news', JSON.stringify(arr));
  localStorage.setItem('newsData', JSON.stringify(arr));
}

// ---- Service Worker & Push ----
async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // Se fuerza el registro a la raíz para la app
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }); 
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
  if (reg && 'PushManager' in window && VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 10) {
    try {
      // Simplificado: se asume que urlBase64ToUint8Array está definida
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
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
    // Uso de prompt es una alternativa de fallback, no siempre recomendada
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
  if (isNaN(d.getTime())) return iso; // Retorna el ISO si no es una fecha válida
  // Usar 'long' para el mes para mejor legibilidad, si no hay espacio, usar 'short'
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }); 
}

function renderArticles(list = [], append = false) {
  if (!newsGrid) return;
  if (!append) newsGrid.innerHTML = '';
  if (!list.length && !append) {
    newsGrid.innerHTML = '<div class="placeholder">No hay noticias que coincidan.</div>';
    loadMoreBtn.style.display = 'none'; // Ocultar si no hay nada
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach(article => {
    // **Mejora:** Asegurar que cada artículo tenga un ID para Favoritos
    const articleId = article.id || `temp-${Math.random().toString(36).substring(2, 9)}`; 

    const tpl = tplArticle.content.cloneNode(true);
    const img = tpl.querySelector('img');
    const pub = tpl.querySelector('.published');
    const favBtn = tpl.querySelector('.fav-btn');
    const title = tpl.querySelector('.title');
    const excerpt = tpl.querySelector('.excerpt');
    const tagsWrap = tpl.querySelector('.card-tags');
    const readMore = tpl.querySelector('.read-more');
    const shareBtn = tpl.querySelector('.share-btn');

    img.src = article.images?.[0] || article.image || 'new-Logo.png'; // Uso del array images del admin
    img.alt = article.title || 'Imagen de la noticia';
    pub.textContent = formatDate(article.published_at || article.date || new Date().toISOString());
    title.textContent = article.title || 'Título sin título';
    // **Mejora:** Uso del excerpt del admin.js
    excerpt.textContent = article.excerpt || (article.description ? article.description.slice(0, 140) + '…' : 'Sin descripción.');

    // **Mejora:** Tags del admin.js (asumo que se implementarán si aún no están)
    const categories = (article.categories || [article.category || 'General']).slice(0, 3);
    tagsWrap.innerHTML = ''; 
    categories.forEach(t => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = t;
      // **Mejora:** Evento para filtrar más robusto
      span.addEventListener('click', (e) => { 
        e.preventDefault();
        state.filter = (t || 'todos').toLowerCase();
        state.page = 1;
        fetchAndRender();
      });
      tagsWrap.appendChild(span);
    });

    readMore.href = article.url || '#';
    favBtn.addEventListener('click', () => toggleFavorite(articleId, favBtn)); // Usa el ID generado/existente
    
    // Configuración inicial del botón de favoritos
    if (state.favorites.has(articleId)) {
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
  // **Mejora:** Centralizar el filtro en base a la nueva estructura de datos (solazo_site.notes)
  try {
    // Cargar todas las noticias del almacenamiento local (siempre que el API no sea real)
    const all = loadLocalNews();
    let filtered = all.slice();
    
    // 1. Filtrado por categoría (no implementado en el original, se mantiene la lógica)
    if (cat && cat !== 'todos') {
      filtered = filtered.filter(n => (n.category || '').toLowerCase() === cat.toLowerCase());
    }

    // 2. Búsqueda simple
    if (q && q.length) {
      const ql = q.toLowerCase();
      filtered = filtered.filter(n => ((n.title || '') + ' ' + (n.excerpt || '')).toLowerCase().includes(ql));
    }

    // 3. Orden
    filtered.sort((a, b) => {
      // Uso de a.date o a.published_at
      const da = new Date(a.date || a.published_at || 0).getTime();
      const db = new Date(b.date || b.published_at || 0).getTime();
      return sort === 'old' ? da - db : db - da;
    });

    // 4. Paginación
    const start = (page - 1) * state.pageSize;
    const pageSlice = filtered.slice(start, start + state.pageSize);
    
    // 5. Normalización: asegurar que el id sea único
    const normalized = pageSlice.map((n, idx) => ({ 
      id: n.id || `local-${n.title.slice(0, 10)}-${start + idx}`, // ID más robusto
      image: n.images?.[0] || n.image || 'new-Logo.png',
      ...n 
    }));
    return normalized;

  } catch (err) {
    console.error('fetchNews error', err);
    return [];
  }
}

// ---- Controller ----
async function fetchAndRender({ append = false } = {}) {
  try {
    const items = await fetchNews({ page: state.page, q: state.query, cat: state.filter, sort: state.sort });
    
    // **Mejora:** Solo se actualiza el array de artículos si no hay paginación activa
    if (append) state.articles = state.articles.concat(items);
    else state.articles = items;
    
    renderArticles(items, append);

    // Notificación ligera (deshabilitada por ser intrusiva, se puede reactivar)
    /*
    if (items.length && Notification.permission === 'granted' && state.page === 1) {
      const first = items[0];
      if (first) showNotification(first.title, { body: (first.excerpt || '').slice(0, 80), icon: first.image });
    }
    */
    
    // Mostrar/ocultar "Cargar más"
    if (!items.length || items.length < state.pageSize) loadMoreBtn.style.display = 'none';
    else loadMoreBtn.style.display = 'inline-block';
  } catch (err) {
    console.error('fetchAndRender error', err);
  }
}

// ---- UI events ----
loadMoreBtn?.addEventListener('click', async () => { state.page += 1; await fetchAndRender({ append: true }); });

// search controls: section (debounced)
const doSearch = debounce(() => {
  const qSection = (searchInput?.value || '').trim();
  state.query = qSection;
  state.page = 1;
  fetchAndRender();
}, 300);

searchBtn?.addEventListener('click', doSearch);
searchInput?.addEventListener('input', doSearch);
searchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

// sort
sortSel?.addEventListener('change', () => { state.sort = sortSel.value; state.page = 1; fetchAndRender(); });

// nav category buttons
document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', (e) => {
    // Ignorar si es un enlace de navegación real (ej. En vivo, Clima)
    if (btn.tagName === 'A') return; 

    const cat = btn.dataset.cat || btn.textContent.trim().split(' ')[0].toLowerCase(); // Lógica de filtro mejorada
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
  if (!favIds.length) { 
    alert('No tienes favoritos todavía.'); 
    return; 
  }
  
  // Filtrar artículos ya cargados
  const favArticles = state.articles.filter(a => state.favorites.has(a.id));

  if (favArticles.length) {
    // Si hay favoritos, solo mostrar esos
    renderArticles(favArticles);
  } else {
    // Fallback: recargar todos los artículos locales y filtrar para mostrar
    const allLocal = loadLocalNews();
    const allFavs = allLocal.filter(a => state.favorites.has(a.id));
    if (allFavs.length) {
        renderArticles(allFavs);
    } else {
        // Fallback duro (cuando el local storage tiene el ID pero el artículo ya no existe)
         renderArticles(favIds.map(id => ({ 
            id, 
            title: `Favorito: ${id.slice(0,10)}`, 
            excerpt: 'Guardado en favoritos, artículo original no encontrado.', 
            image: `new-Logo.png`, 
            url: '#', 
            categories: ['Favorito'], 
            date: new Date().toISOString() 
        })));
    }
  }
  // Desactivar el botón "Cargar más"
  loadMoreBtn.style.display = 'none';
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

// ------------------------------------
//          LÓGICA DE LOGIN & REGISTRO
// ------------------------------------

let isLoginMode = true; // Estado actual: true = Login, false = Registro

const toggleLink = document.getElementById('toggle-link');
const toggleText = document.getElementById('toggle-text');
const submitBtn = document.getElementById('submit-btn');
const loginTitle = document.getElementById('login-title');
const fieldNameContainer = document.getElementById('field-name-container');
const phoneBtn = document.getElementById('btn-phone-login');

// 🔄 Alternar entre Login y Registro
toggleLink?.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  
  if (isLoginMode) {
    // Modo Login
    loginTitle.textContent = "Bienvenido de nuevo";
    submitBtn.textContent = "Iniciar Sesión";
    toggleText.textContent = "¿No tienes cuenta?";
    toggleLink.textContent = "Regístrate aquí";
    fieldNameContainer.style.display = "none";
    document.getElementById('reg-name').required = false;
  } else {
    // Modo Registro
    loginTitle.textContent = "Crear cuenta nueva";
    submitBtn.textContent = "Registrarse";
    toggleText.textContent = "¿Ya tienes cuenta?";
    toggleLink.textContent = "Inicia sesión";
    fieldNameContainer.style.display = "block";
    document.getElementById('reg-name').required = true;
  }
});

// 📱 Simulación Login con Teléfono
phoneBtn?.addEventListener('click', () => {
  const phone = prompt("Ingresa tu número de celular (10 dígitos):");
  if (phone && phone.length >= 10) {
    alert(`Código de verificación enviado a ${phone}. (Simulación)`);
    const code = prompt("Ingresa el código de 4 dígitos:");
    if (code === "1234") { // Código dummy
       const user = { name: "Usuario Teléfono", phone: phone, role: "user" };
       localStorage.setItem("user", JSON.stringify(user));
       alert("Sesión iniciada con teléfono.");
       location.reload();
    } else {
       alert("Código incorrecto.");
    }
  }
});

// 🚀 Manejo del Formulario (Login Y Registro)
loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value.trim();
  const name = document.getElementById("reg-name").value.trim();

  // Base de datos local simulada
  const localUsers = JSON.parse(localStorage.getItem("solazo_users_db") || "[]");

  if (isLoginMode) {
    // --- LÓGICA DE LOGIN ---
    
    // 1. Verificar si es Admin Hardcoded (app.js)
    if (typeof ADMIN_USER !== 'undefined' && email === ADMIN_USER.email && pass === ADMIN_USER.password) {
        localStorage.setItem("user", JSON.stringify(ADMIN_USER));
        alert("Bienvenido Admin.");
        window.location.reload();
        return;
    }

    // 2. Verificar usuarios registrados en localStorage
    const foundUser = localUsers.find(u => u.email === email && u.password === pass);
    if (foundUser) {
        localStorage.setItem("user", JSON.stringify(foundUser));
        alert(`Bienvenido de nuevo, ${foundUser.name}.`);
        window.location.reload();
    } else {
        alert("Correo o contraseña incorrectos.");
    }

  } else {
    // --- LÓGICA DE REGISTRO ---
    
    // Verificar si ya existe
    const exists = localUsers.find(u => u.email === email);
    if (exists) {
        alert("Este correo ya está registrado. Intenta iniciar sesión.");
        return;
    }

    // Crear nuevo usuario
    const newUser = {
        name: name,
        email: email,
        password: pass, // En app real, NUNCA guardar pass en texto plano
        role: "user",
        date: new Date().toISOString()
    };

    localUsers.push(newUser);
    localStorage.setItem("solazo_users_db", JSON.stringify(localUsers));
    
    // Auto-login tras registro
    localStorage.setItem("user", JSON.stringify(newUser));
    alert("¡Cuenta creada con éxito! Bienvenido.");
    window.location.reload();
  }
});