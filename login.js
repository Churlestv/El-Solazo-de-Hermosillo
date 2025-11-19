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
      { username: "adminprueba@elsolazo.com", password: "AlexisMontaño", role: "admin" }, // Admin principal
      { username: "master", password: "1234", role: "master" },
      { username: "editor", password: "1234", role: "editor" }
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

// 4. Simulación Login Teléfono
phoneBtn?.addEventListener('click', () => {
    const phone = prompt("Ingresa tu número (10 dígitos):");
    if(phone && phone.length === 10) {
        alert("Código enviado (Simulación: 1234)");
        if(prompt("Código:") === "1234") {
            localStorage.setItem(SESSION_KEY, JSON.stringify({ name: "Usuario Móvil", role: "user" }));
            window.location.href = "index.html";
        }
    }
});

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