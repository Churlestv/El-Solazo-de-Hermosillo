/* login.js
   Manejo de 3 usuarios:
   - master (acceso total)
   - admin (administrador)
   - editor (agrega noticias pero no puede borrar)
*/

const USERS_KEY = "solazo_users";
const SESSION_KEY = "user";

// Crear usuarios por defecto si no existen
(function initUsers() {
  const saved = JSON.parse(localStorage.getItem(USERS_KEY) || "null");
  if (!saved) {
    const defaults = [
      { username: "master", password: "1234", role: "master" },
      { username: "admin", password: "1234", role: "admin" },
      { username: "editor", password: "1234", role: "editor" }
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaults));
  }
})();

document.querySelector("#login-btn").addEventListener("click", () => {
  const user = document.querySelector("#username").value.trim();
  const pass = document.querySelector("#password").value.trim();

  const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  const found = users.find(u => u.username === user && u.password === pass);

  if (!found) {
    alert("Usuario o contraseña incorrectos.");
    return;
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(found));
  window.location.href = "admin.html";
});
