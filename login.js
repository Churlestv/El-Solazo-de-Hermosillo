/* login.js - Manejo unificado: Local (Admins) + Firebase (Social) */

// === 1. CONFIGURACIÓN DE FIREBASE ===
const firebaseConfig = {
  apiKey: "AIzaSyAiOfmKx6EULdlXuDmstH7-GBkJlq_hG0E",
  authDomain: "elsolazodehermosillo-6d59c.firebaseapp.com",
  projectId: "elsolazodehermosillo-6d59c",
  storageBucket: "elsolazodehermosillo-6d59c.firebasestorage.app",
  messagingSenderId: "1096583416274",
  appId: "1:1096583416274:web:13473844ebb1444511600b",
  measurementId: "G-MTCF0MH6GF"
};

// Inicializar Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// === 2. CONSTANTES Y VARIABLES LOCALES ===
const USERS_KEY = "solazo_users";     // Admins hardcoded
const DB_KEY = "solazo_users_db";     // Usuarios registrados por formulario
const SESSION_KEY = "user";           // Sesión activa

// Referencias DOM
const loginForm = document.getElementById("login-form");
const toggleLink = document.getElementById("toggle-link");
const toggleText = document.getElementById("toggle-text");
const loginTitle = document.getElementById("login-title");
const submitBtn = document.getElementById("submit-btn");
const nameContainer = document.getElementById("field-name-container");
const nameInput = document.getElementById("reg-name");
const phoneBtn = document.getElementById("btn-phone-login");
const togglePassBtn = document.getElementById("toggle-password");
const passwordEl = document.getElementById("password");
const btnGoogle = document.querySelector(".btn-social.google");
const btnFacebook = document.querySelector(".btn-social.facebook");

let isLoginMode = true;

// === 3. INICIALIZAR ADMINS (Solo demo local) ===
(function initAdmins() {
  const saved = JSON.parse(localStorage.getItem(USERS_KEY) || "null");
  if (!saved) {
    const defaults = [
      { username: "adminprueba@elsolazo.com", password: "AlexisMontaño", role: "master" },
      { username: "admin@elsolazo.com", password: "1234", role: "admin" },
      { username: "editor@elsolazo.com", password: "1234", role: "editor" }
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaults));
  }
})();

// === 4. LÓGICA DE INTERFAZ ===

// Alternar Login / Registro
toggleLink?.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    loginTitle.textContent = "Bienvenido";
    submitBtn.textContent = "Entrar";
    toggleText.textContent = "¿No tienes cuenta?";
    toggleLink.textContent = "Regístrate aquí";
    nameContainer.style.display = "none";
    nameInput.required = false;
  } else {
    loginTitle.textContent = "Crear cuenta";
    submitBtn.textContent = "Registrarse";
    toggleText.textContent = "¿Ya tienes cuenta?";
    toggleLink.textContent = "Inicia sesión";
    nameContainer.style.display = "block";
    nameInput.required = true;
  }
});

// Mostrar / Ocultar Password
togglePassBtn?.addEventListener("click", () => {
    if (passwordEl.type === "password") {
        passwordEl.type = "text";
        togglePassBtn.textContent = "🙈";
    } else {
        passwordEl.type = "password";
        togglePassBtn.textContent = "👁️";
    }
});

// === 5. LÓGICA FIREBASE (Social Login) ===

// Función auxiliar para guardar sesión de Firebase en LocalStorage y redirigir
function guardarSesionLocal(userFirebase, provider) {
  const usuarioApp = {
    name: userFirebase.displayName || userFirebase.phoneNumber || "Usuario",
    email: userFirebase.email || userFirebase.phoneNumber,
    photo: userFirebase.photoURL,
    role: "user",
    provider: provider,
    uid: userFirebase.uid
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(usuarioApp));
  alert(`Bienvenido ${usuarioApp.name}`);
  window.location.href = "index.html";
}

// LOGIN GOOGLE
btnGoogle?.addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => guardarSesionLocal(result.user, "google"))
    .catch((error) => alert("Error Google: " + error.message));
});

// LOGIN FACEBOOK
btnFacebook?.addEventListener("click", () => {
  const provider = new firebase.auth.FacebookAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => guardarSesionLocal(result.user, "facebook"))
    .catch((error) => {
       console.error(error);
       if (error.code === 'auth/account-exists-with-different-credential') {
         alert("Ya existe una cuenta con este email usando otro método (Google/Correo).");
       } else {
         alert("Error Facebook: " + error.message + "\n\nRevisa que tu App ID y Dominios estén configurados en Meta Developers.");
       }
    });
});

// LOGIN TELÉFONO
// Configurar Recaptcha invisible al cargar
window.onload = function() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible'
        });
    }
};

phoneBtn?.addEventListener("click", () => {
  const phoneNumber = prompt("Ingresa tu número con código de país (ej: +52662...)");
  if (!phoneNumber) return;

  const appVerifier = window.recaptchaVerifier;

  auth.signInWithPhoneNumber(phoneNumber, appVerifier)
    .then((confirmationResult) => {
      const code = prompt("Te enviamos un SMS. Ingresa el código:");
      if(!code) return;
      return confirmationResult.confirm(code);
    })
    .then((result) => guardarSesionLocal(result.user, "phone"))
    .catch((error) => {
      console.error(error);
      alert("Error SMS: " + error.message);
      // Resetear captcha
      if(window.recaptchaVerifier) {
          try { window.recaptchaVerifier.render().then(id => grecaptcha.reset(id)); } catch(e){}
      }
    });
});


// === 6. LÓGICA FORMULARIO (Local Email/Pass) ===
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const email = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  if (isLoginMode) {
    // --- LOGIN ---
    // 1. Buscar en Admins (Local Hardcoded)
    const admins = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    const adminFound = admins.find(u => u.username === email && u.password === pass);

    if (adminFound) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(adminFound));
      window.location.href = "admin.html";
      return;
    }

    // 2. Buscar en Usuarios Registrados (Local DB)
    const users = JSON.parse(localStorage.getItem(DB_KEY) || "[]");
    const userFound = users.find(u => u.email === email && u.password === pass);

    if (userFound) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(userFound));
      window.location.href = "index.html";
    } else {
      alert("Credenciales incorrectas.");
    }

  } else {
    // --- REGISTRO ---
    const users = JSON.parse(localStorage.getItem(DB_KEY) || "[]");
    
    if (users.find(u => u.email === email)) {
        alert("El correo ya existe.");
        return;
    }

    const newUser = {
        name: nameInput.value.trim(),
        email: email,
        password: pass,
        role: "user",
        provider: "local"
    };
    
    users.push(newUser);
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    
    alert("Cuenta creada. Bienvenido.");
    window.location.href = "index.html";
  }
});