/* admin.js
   Panel con:
   - Roles: master, admin, editor
   - Noticias con múltiples imágenes (URL o archivo)
   - Metadata OG
*/

const SITE_KEY = "solazo_site";
const SESSION_KEY = "user";
const USERS_KEY = "solazo_users";

const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

let siteData = readSite();

// === Cargar sitio ===
function readSite() {
  try {
    return JSON.parse(localStorage.getItem(SITE_KEY)) || {
      mainTitle: "El Solazo de Hermosillo",
      mainDescription: "",
      notes: []
    };
  } catch {
    return { mainTitle:"", mainDescription:"", notes:[] };
  }
}
function writeSite(obj){
  localStorage.setItem(SITE_KEY, JSON.stringify(obj));
}


// === Elementos ===
const mainTitleEl = qs("#main-title");
const mainDescEl = qs("#main-desc");
const saveSiteBtn = qs("#save-site");

const noteForm = qs("#note-form");
const editIdEl = qs("#edit-id");
const noteTitleEl = qs("#note-title");
const noteExcerptEl = qs("#note-excerpt");
const noteUrlEl = qs("#note-url");

const addImgBtn = qs("#add-image-field");
const clearImgBtn = qs("#clear-images");
const imagesContainer = qs("#images-container");

const notesListEl = qs("#notes-list");
const fetchMetadataBtn = qs("#fetch-metadata");

const logoutBtn = qs("#logout");


// ========================
//      VERIFICAR LOGIN
// ========================
function initUI() {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");

  if (!session || !["master","admin","editor"].includes(session.role)) {
    alert("Acceso denegado.");
    window.location.href = "login.html";
    return;
  }

  mainTitleEl.value = siteData.mainTitle;
  mainDescEl.value = siteData.mainDescription;

  imagesContainer.innerHTML = "";
  createImageField();

  renderNotes();
}
initUI();


// ========================
//   Guardar configuración
// ========================
saveSiteBtn.addEventListener("click", () => {
  siteData.mainTitle = mainTitleEl.value.trim();
  siteData.mainDescription = mainDescEl.value.trim();
  writeSite(siteData);
  alert("Configuración guardada.");
});


// ========================
//   Campos de imagen
// ========================
function createImageField(value="") {
  const wrap = document.createElement("div");
  wrap.className = "image-field-item";

  const url = document.createElement("input");
  url.type = "url";
  url.value = value;
  url.placeholder = "URL de imagen o archivo";

  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";

  const prev = document.createElement("img");
  prev.className = "image-preview";
  prev.style.display = value ? "block":"none";
  prev.src = value || "";

  const btn = document.createElement("button");
  btn.textContent = "Eliminar";
  btn.type = "button";
  btn.className = "btn-ghost";

  file.addEventListener("change", e=>{
    const f=e.target.files[0];
    if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      url.value=r.result;
      prev.src=r.result;
      prev.style.display="block";
      ensureEmptyField();
    };
    r.readAsDataURL(f);
  });

  url.addEventListener("input", ()=>{
    if(!url.value.trim()){
      prev.style.display="none";
      prev.src="";
    } else {
      prev.src=url.value.trim();
      prev.style.display="block";
    }
    ensureEmptyField();
  });

  btn.addEventListener("click", ()=> wrap.remove());

  wrap.append(url, file, prev, btn);
  imagesContainer.appendChild(wrap);
}

function ensureEmptyField() {
  const fields = qsa(".image-field-item input[type='url']");
  const last = fields[fields.length-1];
  if (last.value.trim() !== "") createImageField();
}

addImgBtn.addEventListener("click", ()=> createImageField());
clearImgBtn.addEventListener("click", ()=>{
  imagesContainer.innerHTML = "";
  createImageField();
});


// ========================
//   Metadata OG
// ========================
fetchMetadataBtn.addEventListener("click", async ()=>{
  const url = noteUrlEl.value.trim();
  if (!url) return alert("Pega primero la URL.");

  try {
    const res = await fetch(url, { mode:"cors" });
    if (!res.ok) throw 0;

    const html = await res.text();

    function getMeta(tag){
      const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${tag}["'][^>]+content=["']([^"']+)["']`, "i");
      const m = html.match(regex);
      return m ? m[1] : "";
    }

    const t = getMeta("og:title") || getMeta("twitter:title");
    const d = getMeta("og:description") || getMeta("twitter:description");
    const img = getMeta("og:image") || getMeta("twitter:image");

    if(t) noteTitleEl.value = t;
    if(d) noteExcerptEl.value = d;
    if(img) createImageField(img);

    ensureEmptyField();
    alert("Metadata aplicada.");
  }
  catch(e){
    alert("No se pudo obtener metadata (CORS).");
  }
});


// ========================
//     Guardar noticia
// ========================
noteForm.addEventListener("submit", e=>{
  e.preventDefault();

  const imgs = qsa(".image-field-item input[type='url']")
    .map(i=>i.value.trim())
    .filter(v=>v);

  let note = {
    id: editIdEl.value || "note-"+Date.now(),
    title: noteTitleEl.value.trim(),
    excerpt: noteExcerptEl.value.trim(),
    url: noteUrlEl.value.trim(),
    images: imgs,
    date: new Date().toISOString().slice(0,10)
  };

  if(!note.title){
    alert("El título es obligatorio.");
    return;
  }

  siteData = readSite();

  if (editIdEl.value) {
    const i = siteData.notes.findIndex(n=>n.id === editIdEl.value);
    if (i>=0) siteData.notes[i] = note;
    alert("Noticia actualizada.");
  } else {
    siteData.notes.unshift(note);
    alert("Noticia agregada.");
  }

  writeSite(siteData);
  resetForm();
  renderNotes();
});

function resetForm(){
  editIdEl.value="";
  noteTitleEl.value="";
  noteExcerptEl.value="";
  noteUrlEl.value="";
  imagesContainer.innerHTML="";
  createImageField();
}


// ========================
//   Mostrar notas
// ========================
function renderNotes(){
  siteData = readSite();
  notesListEl.innerHTML="";

  if(siteData.notes.length===0){
    notesListEl.innerHTML="<p>No hay noticias.</p>";
    return;
  }

  const session = JSON.parse(localStorage.getItem(SESSION_KEY));

  siteData.notes.forEach(n=>{
    const row=document.createElement("div");
    row.className="note-row";

    const img=document.createElement("img");
    img.className="note-thumb";
    img.src=n.images[0] || "default.jpg";

    const meta=document.createElement("div");
    meta.className="note-meta";
    meta.innerHTML=`
      <h4>${n.title}</h4>
      <p>${n.excerpt}</p>
      <small>${n.date} • <a href="${n.url}" target="_blank">Abrir URL</a></small>
    `;

    const acc=document.createElement("div");
    acc.className="note-actions";

    const edit=document.createElement("button");
    edit.textContent="Editar";
    edit.className="btn-ghost";
    edit.addEventListener("click", ()=> loadNote(n.id));
    acc.appendChild(edit);

    // Solo master y admin pueden eliminar
    if(["master","admin"].includes(session.role)){
      const del=document.createElement("button");
      del.textContent="Eliminar";
      del.className="btn-ghost";
      del.style.background="#c0392b"; del.style.color="#fff";
      del.addEventListener("click",()=>{
        if(confirm("¿Eliminar?")){
          siteData.notes = siteData.notes.filter(x=>x.id!==n.id);
          writeSite(siteData);
          renderNotes();
        }
      });
      acc.appendChild(del);
    }

    row.append(img, meta, acc);
    notesListEl.appendChild(row);
  });
}

function loadNote(id){
  const n = siteData.notes.find(x=>x.id===id);
  if(!n) return;

  editIdEl.value = n.id;
  noteTitleEl.value = n.title;
  noteExcerptEl.value = n.excerpt;
  noteUrlEl.value = n.url;

  imagesContainer.innerHTML="";
  n.images.forEach(src=> createImageField(src));
  createImageField();

  window.scrollTo({top:0,behavior:"smooth"});
}


// ========================
//        Logout
// ========================
logoutBtn.addEventListener("click", ()=>{
  localStorage.removeItem(SESSION_KEY);
  window.location.href="login.html";
});
