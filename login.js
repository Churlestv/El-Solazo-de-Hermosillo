/* login.js - Maneja Admin y Usuarios */

const USERS_KEY = "solazo_users";     // Usuarios Admin predefinidos
const DB_KEY = "solazo_users_db";     // Usuarios registrados en la web
const SESSION_KEY = "user";

// Elementos DOM
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

let isLoginMode = true;

// 1. Inicializar Admins por defecto si no existen
(function initAdmins() {
  const saved = JSON.parse(localStorage.getItem(USERS_KEY) || "null");
  if (!saved) {
    const defaults = [
      { username: "adminprueba@elsolazo.com", password: "AlexisMontaño", role: "master" }, // Admin principal
      { username: "admin@elsolazo.com", password: "1234", role: "admin" },
      { username: "editor@elsolazo.com", password: "1234", role: "editor" }
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaults));
  }
})();

// 2. Alternar entre Login y Registro
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

// 3. Mostrar/Ocultar contraseña
togglePassBtn?.addEventListener("click", () => {
    if (passwordEl.type === "password") {
        passwordEl.type = "text";
        togglePassBtn.textContent = "🙈";
    } else {
        passwordEl.type = "password";
        togglePassBtn.textContent = "👁️";
    }
});

/* login.js - Conexión Real con Firebase */

// 1. PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE
// (La obtienes en la consola de Firebase: Project Settings > General)
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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Referencias al DOM
const btnGoogle = document.querySelector(".btn-social.google");
const btnFacebook = document.querySelector(".btn-social.facebook");
const btnPhone = document.querySelector(".btn-social.phone");

// ==========================================
// 🟢 1. LOGIN CON GOOGLE
// ==========================================
btnGoogle?.addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  
  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      guardarSesionLocal(user, "google");
    })
    .catch((error) => {
      console.error(error);
      alert("Error con Google: " + error.message);
    });
});

// ==========================================
// 🔵 2. LOGIN CON FACEBOOK
// ==========================================
btnFacebook?.addEventListener("click", () => {
  const provider = new firebase.auth.FacebookAuthProvider();

  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      guardarSesionLocal(user, "facebook");
    })
    .catch((error) => {
      // Error común: Facebook requiere que la web tenga HTTPS (candadito)
      alert("Error con Facebook: " + error.message);
    });
});

// ==========================================
// 📱 3. LOGIN CON TELÉFONO
// ==========================================
// Configurar el Captcha invisible (Requisito de seguridad)
window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
  'size': 'invisible'
});

btnPhone?.addEventListener("click", () => {
  const phoneNumber = prompt("Ingresa tu número con código de país (ej: +52662...)");
  if (!phoneNumber) return;

  const appVerifier = window.recaptchaVerifier;

  auth.signInWithPhoneNumber(phoneNumber, appVerifier)
    .then((confirmationResult) => {
      // El SMS se ha enviado
      const code = prompt("Te enviamos un SMS. Ingresa el código:");
      return confirmationResult.confirm(code);
    })
    .then((result) => {
      const user = result.user;
      // Crear un objeto usuario con el teléfono como nombre
      const userData = {
        displayName: user.phoneNumber,
        email: "Telefono",
        photoURL: "new-Logo.png" // Logo por defecto
      };
      guardarSesionLocal(userData, "phone");
    })
    .catch((error) => {
      alert("Error SMS: " + error.message);
      // Resetear captcha si falla
      window.recaptchaVerifier.render().then(function(widgetId) {
        grecaptcha.reset(widgetId);
      });
    });
});

// ==========================================
// 💾 FUNCIÓN COMÚN: GUARDAR Y REDIRIGIR
// ==========================================
function guardarSesionLocal(userFirebase, provider) {
  // Convertimos el usuario de Firebase al formato de tu app
  const usuarioApp = {
    name: userFirebase.displayName || "Usuario",
    email: userFirebase.email || userFirebase.phoneNumber,
    photo: userFirebase.photoURL,
    role: "user", // Por defecto usuario normal
    provider: provider
  };

  localStorage.setItem("user", JSON.stringify(usuarioApp));
  alert(`Bienvenido ${usuarioApp.name}`);
  window.location.href = "index.html";
}

// (Mantener aquí abajo el resto de tu lógica de login con correo/contraseña normal...)

// 5. Proceso de Login / Registro principal
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const email = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  if (isLoginMode) {
    // --- MODO LOGIN ---

    // A) Buscar en Admins
    const admins = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    const adminFound = admins.find(u => u.username === email && u.password === pass);

    if (adminFound) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(adminFound));
      window.location.href = "admin.html"; // Admin va al panel
      return;
    }

    // B) Buscar en Usuarios Registrados
    const users = JSON.parse(localStorage.getItem(DB_KEY) || "[]");
    const userFound = users.find(u => u.email === email && u.password === pass);

    if (userFound) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(userFound));
      window.location.href = "index.html"; // Usuario normal va al inicio
    } else {
      alert("Credenciales incorrectas.");
    }

  } else {
    // --- MODO REGISTRO ---
    const users = JSON.parse(localStorage.getItem(DB_KEY) || "[]");
    
    if (users.find(u => u.email === email)) {
        alert("El correo ya existe.");
        return;
    }

    const newUser = {
        name: nameInput.value.trim(),
        email: email,
        password: pass,
        role: "user"
    };
    
    users.push(newUser);
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    alert("Cuenta creada. Bienvenido.");
    window.location.href = "index.html";
    
  }
});