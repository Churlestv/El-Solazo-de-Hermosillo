// app.js - actualizado para Diseño A (incluye registro de service worker y suscripción Push)
const API_URL = 'https://api.example.com/news'; // reemplaza con tu endpoint real
const VAPID_PUBLIC_KEY = '<REEMPLAZA_CON_TU_VAPID_PUBLICA>'; // si usarás Push real
const PAGE_SIZE = 10;

let state = { page:1, pageSize: PAGE_SIZE, articles: [], filter: 'todos', sort:'new', query:'', favorites: new Set(JSON.parse(localStorage.getItem('solazo_favs') || '[]')) };

/* Elementos */
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
const sortSel = document.getElementById('sort');
const favsViewBtn = document.getElementById('favorites-view');

document.getElementById('year').textContent = new Date().getFullYear();

/* THEME */
function applyTheme(theme){ document.documentElement.setAttribute('data-theme', theme); document.getElementById('meta-theme-color').setAttribute('content', theme==='dark'?'#0b0a09':'#fff'); toggleThemeBtn.textContent = theme==='dark'?'☀️':'🌙'; localStorage.setItem('solazo_theme', theme);}
const savedTheme = localStorage.getItem('solazo_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(savedTheme);
toggleThemeBtn.addEventListener('click', ()=> applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'));

/* MENU mobile */
menuToggle?.addEventListener('click', ()=> { const open = mainNav.style.display==='block'; mainNav.style.display = open ? '' : 'block'; });

/* LOGIN UI */
loginBtn.addEventListener('click', ()=> loginModal.setAttribute('aria-hidden','false'));
closeLogin.addEventListener('click', ()=> loginModal.setAttribute('aria-hidden','true'));
loginForm.addEventListener('submit', (e)=>{ e.preventDefault(); const email = document.getElementById('login-email').value; sessionStorage.setItem('solazo_user', JSON.stringify({email, when: Date.now()})); loginModal.setAttribute('aria-hidden','true'); alert(`Bienvenido, ${email}`); });

/* Notifications & Service Worker */
async function registerSW(){ if('serviceWorker' in navigator){ try{ const reg = await navigator.serviceWorker.register('/sw.js'); console.log('SW registrado', reg); return reg; }catch(e){console.warn('Error registrando SW', e);} } }

async function requestNotifications(){ if(!('Notification' in window)){ alert('Tu navegador no soporta notificaciones.'); return; } const perm = await Notification.requestPermission(); if(perm==='granted'){ const reg = await registerSW(); // intentar suscribir a Push si hay clave VAPID
    if(reg && window.PushManager && VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length>10){ try{ const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }); // enviar subscription al servidor
          await fetch('/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(sub) });          alert('Notificaciones activadas.'); }catch(err){ console.warn('No se pudo suscribir a Push', err); } }
  } else { alert('Permiso de notificaciones denegado.'); } }

notifyPermBtn.addEventListener('click', requestNotifications);

function urlBase64ToUint8Array(base64String){ const padding = '='.repeat((4 - base64String.length % 4) % 4); const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/'); const rawData = window.atob(base64); const outputArray = new Uint8Array(rawData.length); for(let i=0;i<rawData.length;++i) outputArray[i]=rawData.charCodeAt(i); return outputArray; }

/* Share helper */
async function tryShare(data){ if(navigator.share){ try{ await navigator.share(data); }catch(e){console.warn('Share canceled', e);} } else { try{ await navigator.clipboard.writeText(data.url||window.location.href); alert('Enlace copiado al portapapeles.'); }catch(e){ prompt('Copia este enlace:', data.url||window.location.href); } } }

/* Favorites */
function persistFavorites(){ localStorage.setItem('solazo_favs', JSON.stringify(Array.from(state.favorites))); }
function toggleFavorite(id, el){ if(state.favorites.has(id)){ state.favorites.delete(id); el.textContent='☆'; el.setAttribute('aria-pressed','false'); } else { state.favorites.add(id); el.textContent='★'; el.setAttribute('aria-pressed','true'); } persistFavorites(); }

/* Render */
function formatDate(iso){ const d = new Date(iso); if(isNaN(d)) return iso; return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }); }

function renderArticles(list, append=false){ if(!append) newsGrid.innerHTML=''; if(!list.length && !append){ newsGrid.innerHTML='<div class="placeholder">No hay noticias que coincidan.</div>'; return; } const frag = document.createDocumentFragment(); list.forEach(article=>{ const tpl = tplArticle.content.cloneNode(true); const img = tpl.querySelector('img'); const pub = tpl.querySelector('.published'); const favBtn = tpl.querySelector('.fav-btn'); const title = tpl.querySelector('.title'); const excerpt = tpl.querySelector('.excerpt'); const tagsWrap = tpl.querySelector('.card-tags'); const readMore = tpl.querySelector('.read-more'); const shareBtn = tpl.querySelector('.share-btn'); img.src = article.image || './assets/placeholder.jpg'; img.alt = article.title || 'Imagen'; pub.textContent = formatDate(article.published_at||article.date||new Date().toISOString()); title.textContent = article.title || 'Título'; excerpt.textContent = article.excerpt || (article.description ? article.description.slice(0,140)+'…' : ''); const categories = (article.categories || [article.category || 'General']).slice(0,3); categories.forEach(t=>{ const span = document.createElement('span'); span.className='tag'; span.textContent = t; span.addEventListener('click', ()=>{ state.filter = (t||'todos').toLowerCase(); state.page = 1; fetchAndRender(); }); tagsWrap.appendChild(span); }); readMore.href = article.url || '#'; favBtn.addEventListener('click', ()=> toggleFavorite(article.id, favBtn)); if(state.favorites.has(article.id)){ favBtn.textContent='★'; favBtn.setAttribute('aria-pressed','true'); } else { favBtn.textContent='☆'; favBtn.setAttribute('aria-pressed','false'); } shareBtn.addEventListener('click', ()=> tryShare({ title: article.title, text: article.excerpt, url: article.url || window.location.href })); frag.appendChild(tpl); }); newsGrid.appendChild(frag); }

/* Fetch - simulación si no hay API */
async function fetchNews({ page=1, q='', cat='todos', sort='new' }={}){ try{ if(API_URL.includes('example.com')) return generateFakeArticles(page, state.pageSize, cat); // ejemplo de fetch real:
    // const params = new URLSearchParams({ page, pageSize: state.pageSize, q, cat, sort });
    // const res = await fetch(`${API_URL}?${params.toString()}`);
    // return await res.json();
  }catch(err){ console.error(err); return []; } }

function generateFakeArticles(page, pageSize, cat){ const total=50; const start=(page-1)*pageSize; const arr=[]; for(let i=0;i<pageSize && (start+i)<total;i++){ const id=`fake-${start+i+1}`; arr.push({ id, title: `Noticia ${start+i+1} — ${cat}`, excerpt: 'Resumen breve de ejemplo.', image: `https://picsum.photos/seed/${id}/900/600`, url:'#', categories:[cat==='todos'?'General':cat.toUpperCase()], published_at: new Date(Date.now() - (start+i)*3600_000).toISOString() }); } return arr; }

/* Controller */
async function fetchAndRender({ append=false }={}){ const items = await fetchNews({ page: state.page, q: state.query, cat: state.filter, sort: state.sort }); if(append) state.articles = state.articles.concat(items); else state.articles = items; renderArticles(items, append); if(items.length && Notification.permission==='granted' && state.page===1){ const first = items[0]; if(first) showNotification(first.title,{ body: first.excerpt.slice(0,80), icon: first.image }); } if(!items.length || items.length < state.pageSize) loadMoreBtn.style.display='none'; else loadMoreBtn.style.display='inline-block'; }

/* UI events */
loadMoreBtn.addEventListener('click', async ()=>{ state.page+=1; await fetchAndRender({ append:true }); });
searchBtn.addEventListener('click', ()=>{ state.query = searchInput.value.trim(); state.page=1; fetchAndRender(); });
searchInput.addEventListener('keydown', (e)=> { if(e.key==='Enter') searchBtn.click(); });
sortSel.addEventListener('change', ()=>{ state.sort = sortSel.value; state.page =1; fetchAndRender(); });
document.querySelectorAll('.nav-link').forEach(btn=>{ btn.addEventListener('click', ()=>{ const cat = btn.dataset.cat || btn.textContent.trim().toLowerCase(); state.filter = cat || 'todos'; state.page =1; fetchAndRender(); if(window.innerWidth<880) mainNav.style.display=''; }); });
favsViewBtn.addEventListener('click', ()=>{ const favIds = Array.from(state.favorites); if(!favIds.length){ alert('No tienes favoritos todavía.'); return; } const favArticles = state.articles.filter(a => state.favorites.has(a.id)); if(!favArticles.length){ renderArticles(favIds.map(id=>({ id, title:`Favorito ${id}`, excerpt:'Guardado en favoritos', image:`https://picsum.photos/seed/${id}/900/600`, url:'#', categories:['Favorito'], published_at:new Date().toISOString()}))); } else { renderArticles(favArticles); } });

/* Notifications helper */
function showNotification(title, opts={}){ if(Notification.permission==='granted'){ if(navigator.serviceWorker?.controller){ navigator.serviceWorker.getRegistration().then(reg=>{ if(reg) reg.showNotification(title, opts); }); } else { new Notification(title, opts); } } }

/* Init */
(async function init(){ await registerSW(); fetchAndRender(); // Polling ligero para demo
  setInterval(async ()=>{ /* opcional: comprobar headlines en backend */ }, 5*60_000);
})();
