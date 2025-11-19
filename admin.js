const SITE_KEY = "solazo_site";
const SESSION_KEY = "user"; // Clave de la sesión, ahora se usa para verificar roles

const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

let siteData = readSite();

// === Cargar sitio ===
function readSite() {
  try {
    const data = JSON.parse(localStorage.getItem(SITE_KEY));
    // **Mejora:** Asegurar que notes siempre sea un array
    return data && data.notes 
        ? data 
        : {
            mainTitle: "El Solazo de Hermosillo",
            mainDescription: "",
            notes: []
        };
  } catch (e) {
    console.error("Error leyendo sitio:", e);
    return { mainTitle: "El Solazo de Hermosillo", mainDescription: "", notes: [] };
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

  // **Mejora:** Comprobación de roles más estricta para el acceso al panel
  if (!session || !["master","admin","editor"].includes(session.role)) {
    alert("Acceso denegado. Rol no autorizado.");
    window.location.href = "login.html";
    return;
  }
  
  // Asignar datos del sitio
  mainTitleEl.value = siteData.mainTitle;
  mainDescEl.value = siteData.mainDescription;

  // Renderizar campos de imagen iniciales
  imagesContainer.innerHTML = "";
  createImageField();

  renderNotes(session.role); // Pasar el rol para la lógica de permisos
}
initUI();


// ========================
//   Guardar configuración
// ========================
saveSiteBtn.addEventListener("click", () => {
  siteData.mainTitle = mainTitleEl.value.trim();
  siteData.mainDescription = mainDescEl.value.trim();
  writeSite(siteData);
  alert("Configuración del sitio guardada.");
});


// ========================
//   Campos de imagen
// ========================
const DEFAULT_IMAGE_SRC = "new-Logo.png"; // Usar el logo como fallback

function createImageField(value="") {
  const wrap = document.createElement("div");
  wrap.className = "image-field-item";

  const url = document.createElement("input");
  url.type = "url";
  url.value = value;
  url.placeholder = "URL de imagen (o sube un archivo)";

  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";

  const prev = document.createElement("img");
  prev.className = "image-preview";
  // **Mejora:** Usar una imagen por defecto si no hay valor
  prev.src = value || DEFAULT_IMAGE_SRC; 
  prev.style.display = value ? "block":"none";

  const btn = document.createElement("button");
  btn.textContent = "Eliminar";
  btn.type = "button";
  btn.className = "btn-ghost";

  // Manejo de la subida de archivo
  file.addEventListener("change", e=>{
    const f=e.target.files[0];
    if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      url.value=r.result; // Almacena la imagen como DataURL
      prev.src=r.result;
      prev.style.display="block";
      ensureEmptyField();
    };
    r.readAsDataURL(f);
  });

  // Manejo de la URL manual
  url.addEventListener("input", ()=>{
    const val = url.value.trim();
    if(!val){
      prev.style.display="none";
      prev.src=DEFAULT_IMAGE_SRC;
    } else {
      prev.src=val;
      prev.style.display="block";
    }
    ensureEmptyField();
  });

  btn.addEventListener("click", ()=> {
    wrap.remove();
    // Asegurar que si el último campo se eliminó, se cree uno vacío si es necesario
    if (qsa(".image-field-item").length === 0) createImageField();
  });

  wrap.append(prev, url, file, btn); // Se reordena la vista
  imagesContainer.appendChild(wrap);
}

function ensureEmptyField() {
  // Solo se añade un nuevo campo si el último campo URL tiene contenido
  const fields = qsa(".image-field-item input[type='url']");
  if (fields.length === 0 || fields[fields.length-1].value.trim() !== "") {
    createImageField();
  }
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
    // Nota: El fetch de CORS directo puede fallar si el servidor de destino no tiene 
    // headers CORS adecuados. El método original era correcto para una prueba.
    const res = await fetch(url); 
    if (!res.ok) throw new Error("Fetch failed");

    // **NOTA:** La obtención directa de metadata en el cliente es difícil debido a CORS.
    // El código original dependía de que el servidor no aplicara CORS o que 
    // la URL fuera una imagen. Se mantiene la lógica para la demostración.
    // En un entorno de producción, esta lógica debería ir en el backend.
    
    // Aquí el código que simula la obtención, asumiendo que funciona en un contexto sin CORS estricto
    const html = await res.text();

    function getMeta(tag){
      // Regex más segura para extraer contenido
      const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${tag}["'][^>]+content=["']([^"']+)["']`, "i");
      const m = html.match(regex);
      return m ? m[1] : "";
    }

    const t = getMeta("og:title") || getMeta("twitter:title") || getMeta("title");
    const d = getMeta("og:description") || getMeta("twitter:description") || getMeta("description");
    const img = getMeta("og:image") || getMeta("twitter:image");

    if(t) noteTitleEl.value = t;
    if(d) noteExcerptEl.value = d;
    if(img) {
      imagesContainer.innerHTML = ""; // Limpiar antes de añadir la imagen principal
      createImageField(img);
    }

    ensureEmptyField();
    alert("Metadata aplicada (Revisa la imagen).");
  }
  catch(e){
    alert("No se pudo obtener metadata (Error: Puede ser CORS o URL inválida).");
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
  
  // Se vuelve a leer por si hay múltiples administradores
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
  renderNotes(); // Volver a renderizar la lista
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
function renderNotes(role) {
  siteData = readSite();
  notesListEl.innerHTML="";

  if(siteData.notes.length===0){
    notesListEl.innerHTML="<p>No hay noticias.</p>";
    return;
  }

  // **Mejora:** Se obtiene la sesión aquí para ser más seguro
  const session = JSON.parse(localStorage.getItem(SESSION_KEY));
  role = role || session?.role; // Se usa el rol pasado o el de la sesión

  siteData.notes.forEach(n=>{
    const row=document.createElement("div");
    row.className="note-row";
    row.dataset.id = n.id; // ID para facilitar la búsqueda

    const img=document.createElement("img");
    img.className="note-thumb";
    img.src=n.images[0] || DEFAULT_IMAGE_SRC;

    const meta=document.createElement("div");
    meta.className="note-meta";
    // **NOTA:** Se mantiene innerHTML para el contenido ya que es contenido de administración interno
    meta.innerHTML=`
      <h4>${n.title}</h4>
      <p>${n.excerpt}</p>
      <small>${n.date} • <a href="${n.url}" target="_blank" rel="noopener noreferrer">Abrir URL</a></small>
    `;

    const acc=document.createElement("div");
    acc.className="note-actions";

    const edit=document.createElement("button");
    edit.textContent="Editar";
    edit.className="btn-ghost";
    edit.addEventListener("click", ()=> loadNote(n.id));
    acc.appendChild(edit);

    // Solo master y admin pueden eliminar
    if(["master","admin"].includes(role)){
      const del=document.createElement("button");
      del.textContent="Eliminar";
      // **Mejora:** Se usa una clase específica para el botón de eliminar
      del.className="btn-ghost btn-delete"; 
      
      del.addEventListener("click",()=>{
        if(confirm(`¿Estás seguro de eliminar la noticia: ${n.title}?`)){
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
  
  // Asegurar que siempre haya un campo vacío al final para agregar uno nuevo
  ensureEmptyField(); 

  window.scrollTo({top:0,behavior:"smooth"});
}


// ========================
//        Logout
// ========================
logoutBtn.addEventListener("click", ()=>{
  localStorage.removeItem(SESSION_KEY);
  window.location.href="login.html";
});