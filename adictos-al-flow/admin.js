(function () {
  if (!window.STORE) return;

  const ADMIN_SALT = "c81a3558c283ea38211bf7c33c8b39ad";
  const ADMIN_EMAIL_SHA = "7698cc4954f6fbf021e837c103e6ce54759f6c5feabf8d6527606b9f5c3cb6b6";
  const ADMIN_PASS_SHA = "bdd24908a786ce0edd05ad2cfc464a4b0a04f6278cc484c628c5784bcf1dd108";
  const ADMIN_EMAIL_FNV = "165fef7504a59995";
  const ADMIN_PASS_FNV = "920b8b2590d7d025";
  const ADMIN_SESSION_KEY = "aaf-admin-session";
  const ADMIN_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

  const server = { checked: false, active: false };
  let csrf = "";

  const html = `
    <div class="admin" id="adminPanel" hidden>
      <div class="admin-box" role="dialog" aria-modal="true" aria-labelledby="adminTitle">
        <div class="admin-head">
          <div>
            <div class="admin-eyebrow">ADICTOS AL FLOW · ADMIN</div>
            <h2 id="adminTitle">Configuración de la tienda</h2>
          </div>
          <button class="admin-close" id="adminClose" type="button" aria-label="Cerrar">✕</button>
        </div>

        <div class="admin-login" id="adminLogin" hidden>
          <p class="admin-login-sub" id="adminLoginSub">Ingresa con tu cuenta de administrador. La sesión se guarda en este navegador.</p>
          <form class="admin-login-form" id="adminLoginForm" novalidate>
            <label class="admin-label" for="admEmail">Email</label>
            <input class="admin-input" id="admEmail" type="email" autocomplete="username" maxlength="80" placeholder="Tu correo">
            <label class="admin-label" for="admPass">Contraseña</label>
            <input class="admin-input" id="admPass" type="password" autocomplete="current-password" maxlength="200" placeholder="Tu contraseña">
            <div class="admin-status" id="adminLoginMsg" role="alert"></div>
            <button class="admin-btn primary admin-login-btn" type="submit">Entrar al panel</button>
          </form>
          <p class="admin-login-note" id="adminLoginNote">La sesión permanece abierta durante 30 días en este dispositivo.</p>
        </div>

        <div class="admin-body" id="adminBody" hidden>
          <section class="admin-sec">
            <h3>WhatsApp</h3>
            <label class="admin-label" for="admWa">Número con código de país</label>
            <input class="admin-input" id="admWa" type="tel" inputmode="numeric" placeholder="18091234567" autocomplete="off">
            <p class="admin-hint">Sin +, espacios ni guiones. Si lo dejas vacío, el botón de pedido mostrará un aviso.</p>
          </section>

          <section class="admin-sec">
            <h3>Monedas</h3>
            <div class="admin-grid2">
              <div>
                <label class="admin-label" for="admUsd">1 USD = ? DOP</label>
                <input class="admin-input" id="admUsd" type="number" min="1" step="0.01">
              </div>
              <div>
                <label class="admin-label" for="admEur">1 EUR = ? DOP</label>
                <input class="admin-input" id="admEur" type="number" min="1" step="0.01">
              </div>
            </div>
          </section>

          <section class="admin-sec">
            <h3>Franja superior</h3>
            <label class="admin-check"><input id="admStripOn" type="checkbox"> Mostrar franja</label>
            <label class="admin-label" for="admStripText">Texto</label>
            <input class="admin-input" id="admStripText" type="text" maxlength="80">
          </section>

          <section class="admin-sec">
            <h3>Catálogo</h3>
            <p class="admin-meta" id="admCatalog"></p>
          </section>

          <div class="admin-status" id="admStatus" role="status"></div>

          <div class="admin-actions">
            <button class="admin-btn primary" id="admSave" type="button">Guardar cambios</button>
            <button class="admin-btn" id="admDownload" type="button">Descargar config.js</button>
          </div>

          <p class="admin-note" id="adminNote">Los cambios se aplican al instante en este navegador. Para que los vean tus clientes, descarga <strong>config.js</strong> y reemplaza el archivo en la carpeta del sitio.</p>
          <button class="admin-reset" id="admReset" type="button">Descartar cambios locales</button>
          <button class="admin-logout" id="admLogout" type="button">Cerrar sesión de administrador</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", html);

  const panel = document.getElementById("adminPanel");
  const closeBtn = document.getElementById("adminClose");
  const adminLogin = document.getElementById("adminLogin");
  const adminBody = document.getElementById("adminBody");
  const adminTitle = document.getElementById("adminTitle");
  const adminLoginSub = document.getElementById("adminLoginSub");
  const adminLoginNote = document.getElementById("adminLoginNote");
  const adminNote = document.getElementById("adminNote");
  const loginForm = document.getElementById("adminLoginForm");
  const loginMsg = document.getElementById("adminLoginMsg");
  const emailInput = document.getElementById("admEmail");
  const passInput = document.getElementById("admPass");
  const waInput = document.getElementById("admWa");
  const usdInput = document.getElementById("admUsd");
  const eurInput = document.getElementById("admEur");
  const stripOn = document.getElementById("admStripOn");
  const stripText = document.getElementById("admStripText");
  const catalogMeta = document.getElementById("admCatalog");
  const statusBox = document.getElementById("admStatus");
  const saveBtn = document.getElementById("admSave");
  const downloadBtn = document.getElementById("admDownload");
  const resetBtn = document.getElementById("admReset");
  const logoutBtn = document.getElementById("admLogout");

  function counts() {
    const c = { ropa: 0, zapatillas: 0, accesorios: 0 };
    PRODUCTS.forEach((p) => c[p.cat]++);
    const photos = new Set(PRODUCTS.flatMap((p) => p.img)).size;
    return c.ropa + " ropa · " + c.zapatillas + " zapatillas · " + c.accesorios + " accesorios · " + photos + " fotos";
  }

  function setStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = "admin-status show " + (type || "");
  }

  function setLoginStatus(message, type) {
    loginMsg.textContent = message;
    loginMsg.className = "admin-status" + (message ? " show " + (type || "") : "");
  }

  function fillForm() {
    waInput.value = STORE.config.whatsappNumber || "";
    usdInput.value = STORE.config.usdRate;
    eurInput.value = STORE.config.eurRate;
    stripOn.checked = STORE.config.stripEnabled !== false;
    stripText.value = STORE.config.stripText || "";
  }

  function subtleReady() {
    return !!(window.crypto && window.crypto.subtle && window.TextEncoder);
  }

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function fnvHex(text) {
    let h1 = 0x811c9dc5;
    let h2 = 5381;
    for (let round = 0; round < 2000; round++) {
      for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
        h2 = (Math.imul(h2, 33) + c) >>> 0;
      }
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  }

  async function digest(kind, value) {
    const input = ADMIN_SALT + ":" + kind + ":" + value + ":aaf-admin";
    if (subtleReady()) return { algo: "sha256", hash: await sha256Hex(input) };
    return { algo: "fnv", hash: fnvHex(input) };
  }

  async function initMode() {
    if (server.checked) return server.active;
    server.checked = true;
    try {
      const res = await fetch("/api/health", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const type = res.headers.get("content-type") || "";
      if (res.ok && type.includes("application/json")) {
        const data = await res.json();
        server.active = !!(data && data.mode === "server");
      }
    } catch (e) {
      server.active = false;
    }
    return server.active;
  }

  async function api(path, options) {
    const opts = options || {};
    const headers = { Accept: "application/json" };
    const request = {
      method: opts.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers,
    };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      request.body = JSON.stringify(opts.body);
    }
    if (opts.csrf) headers["X-CSRF-Token"] = opts.csrf;

    try {
      const res = await fetch(path, request);
      let data = null;
      try {
        data = await res.json();
      } catch (e) {}
      return { status: res.status, ok: res.ok, data };
    } catch (e) {
      return { status: 0, ok: false, data: null };
    }
  }

  function applyModeUi() {
    downloadBtn.hidden = server.active;
    resetBtn.hidden = server.active;
    adminLoginSub.textContent = server.active
      ? "Entra con tu cuenta de administrador. La sesión se valida en el servidor."
      : "Ingresa con tu cuenta de administrador. La sesión se guarda en este navegador.";
    adminLoginNote.textContent = server.active
      ? "Sesión protegida durante 30 días. Usa “Cerrar sesión” al terminar en un equipo compartido."
      : "La sesión permanece abierta durante 30 días en este dispositivo.";
    adminNote.innerHTML = server.active
      ? "Los cambios se guardan en el servidor y los ven todos tus clientes al instante."
      : "Los cambios se aplican al instante en este navegador. Para que los vean tus clientes, descarga <strong>config.js</strong> y reemplaza el archivo en la carpeta del sitio.";
  }

  function hasAdminSession() {
    try {
      const session = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null");
      return !!(session && Number(session.until) > Date.now());
    } catch (e) {
      return false;
    }
  }

  function saveAdminSession() {
    try {
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ until: Date.now() + ADMIN_SESSION_MS }));
    } catch (e) {}
  }

  function clearAdminSession() {
    try {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    } catch (e) {}
  }

  function showAdminLogin() {
    adminTitle.textContent = "Acceso administrador";
    adminLogin.hidden = false;
    adminBody.hidden = true;
    setLoginStatus("", "");
    setTimeout(() => emailInput.focus(), 40);
  }

  function showAdminConfig() {
    adminTitle.textContent = "Configuración de la tienda";
    adminLogin.hidden = true;
    adminBody.hidden = false;
    fillForm();
    catalogMeta.textContent = counts();
    if (STORE.hasLocal) {
      setStatus("Tienes cambios guardados solo en este navegador. Descarga config.js para publicarlos.", "warn");
    } else {
      setStatus("Configuración cargada desde config.js.", "");
    }
    closeBtn.focus();
  }

  function showServerConfig(config) {
    adminTitle.textContent = "Configuración de la tienda";
    adminLogin.hidden = true;
    adminBody.hidden = false;
    if (config) STORE.apply(config);
    STORE.clearLocal();
    fillForm();
    catalogMeta.textContent = counts();
    setStatus("Configuración cargada del servidor. Guarda para publicar los cambios al instante.", "");
    closeBtn.focus();
  }

  async function openAdmin() {
    panel.hidden = false;
    document.body.classList.add("admin-open");
    adminTitle.textContent = "Acceso administrador";
    adminLogin.hidden = false;
    adminBody.hidden = true;

    const isServer = await initMode();
    applyModeUi();

    if (isServer) {
      const me = await api("/api/admin/me");
      if (me.ok && me.data && me.data.authenticated) {
        csrf = me.data.csrf;
        showServerConfig(me.data.config);
      } else {
        csrf = "";
        showAdminLogin();
      }
      return;
    }

    if (hasAdminSession()) showAdminConfig();
    else showAdminLogin();
  }

  function closeAdmin() {
    panel.hidden = true;
    document.body.classList.remove("admin-open");
    if (/[?&]admin=1/.test(location.search) || location.hash === "#admin") {
      history.replaceState(null, "", location.pathname);
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const pass = passInput.value;

    if (!email || !pass) {
      setLoginStatus("Escribe tu email y contraseña.", "err");
      (email ? passInput : emailInput).focus();
      return;
    }

    setLoginStatus("Comprobando…", "");

    if (server.active) {
      const res = await api("/api/admin/login", { method: "POST", body: { email, password: pass } });
      if (res.status === 429) {
        setLoginStatus("Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.", "err");
        return;
      }
      if (!res.ok || !res.data || !res.data.ok) {
        setLoginStatus(
          res.status === 401 ? "Email o contraseña incorrectos." : "No se pudo iniciar sesión. Inténtalo de nuevo.",
          "err"
        );
        passInput.value = "";
        passInput.focus();
        return;
      }

      csrf = res.data.csrf;
      loginForm.reset();
      setLoginStatus("", "");
      const me = await api("/api/admin/me");
      if (me.ok && me.data && me.data.authenticated) {
        showServerConfig(me.data.config);
      } else {
        setLoginStatus("No se pudo abrir la sesión. Inténtalo de nuevo.", "err");
      }
      return;
    }

    const emailDigest = await digest("email", email);
    const passDigest = await digest("pass", pass);
    const ok =
      emailDigest.algo === "sha256"
        ? emailDigest.hash === ADMIN_EMAIL_SHA && passDigest.hash === ADMIN_PASS_SHA
        : emailDigest.hash === ADMIN_EMAIL_FNV && passDigest.hash === ADMIN_PASS_FNV;

    if (!ok) {
      setLoginStatus("Email o contraseña incorrectos.", "err");
      passInput.value = "";
      passInput.focus();
      return;
    }

    saveAdminSession();
    loginForm.reset();
    setLoginStatus("", "");
    showAdminConfig();
  }

  function validateForm() {
    const wa = waInput.value.replace(/\D/g, "").slice(0, 15);
    const usd = Number(usdInput.value);
    const eur = Number(eurInput.value);
    const text = stripText.value.trim();

    if (wa && (wa.length < 8 || wa.length > 15)) {
      setStatus("El número de WhatsApp debe tener entre 8 y 15 dígitos, con código de país.", "err");
      waInput.focus();
      return null;
    }
    if (!(usd > 0)) {
      setStatus("La tasa del dólar debe ser mayor que 0.", "err");
      usdInput.focus();
      return null;
    }
    if (!(eur > 0)) {
      setStatus("La tasa del euro debe ser mayor que 0.", "err");
      eurInput.focus();
      return null;
    }
    if (stripOn.checked && !text) {
      setStatus("Escribe el texto de la franja o desactívala.", "err");
      stripText.focus();
      return null;
    }

    return { whatsappNumber: wa, usdRate: usd, eurRate: eur, stripText: text, stripEnabled: stripOn.checked };
  }

  async function saveForm() {
    const next = validateForm();
    if (!next) return false;

    if (server.active) {
      saveBtn.disabled = true;
      setStatus("Guardando en el servidor…", "");
      const res = await api("/api/admin/config", { method: "PUT", body: next, csrf });
      saveBtn.disabled = false;

      if (res.status === 401) {
        csrf = "";
        showAdminLogin();
        setLoginStatus("Tu sesión expiró. Vuelve a entrar.", "err");
        return false;
      }
      if (!res.ok || !res.data || !res.data.ok) {
        setStatus(
          res.status === 403
            ? "No se pudo verificar la sesión. Recarga la página e inténtalo de nuevo."
            : "No se pudo guardar en el servidor. Inténtalo de nuevo.",
          "err"
        );
        return false;
      }

      STORE.apply(res.data.config);
      STORE.clearLocal();
      waInput.value = next.whatsappNumber;
      setStatus("Guardado en el servidor. Tus clientes ya ven los cambios.", "ok");
      return true;
    }

    STORE.apply(next);
    STORE.persist();
    waInput.value = next.whatsappNumber;
    setStatus("Cambios guardados en este navegador. Descarga config.js para publicarlos.", "ok");
    return true;
  }

  async function downloadConfig() {
    if (!(await saveForm())) return;
    const blob = new Blob([STORE.buildConfigSource()], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "config.js";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus("config.js descargado. Reemplaza el archivo en la carpeta del sitio para publicar los cambios.", "ok");
  }

  loginForm.addEventListener("submit", submitLogin);
  saveBtn.addEventListener("click", function () {
    saveForm();
  });
  downloadBtn.addEventListener("click", function () {
    downloadConfig();
  });

  resetBtn.addEventListener("click", function () {
    if (!confirm("¿Descartar los cambios guardados en este navegador y volver a la configuración de config.js?")) return;
    STORE.clearLocal();
    location.reload();
  });

  logoutBtn.addEventListener("click", async function () {
    if (server.active) {
      logoutBtn.disabled = true;
      await api("/api/admin/logout", { method: "POST", csrf });
      logoutBtn.disabled = false;
      csrf = "";
      showAdminLogin();
      setLoginStatus("Sesión cerrada.", "");
      return;
    }
    clearAdminSession();
    showAdminLogin();
  });

  closeBtn.addEventListener("click", closeAdmin);
  panel.addEventListener("click", function (e) {
    if (e.target === panel) closeAdmin();
  });

  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key === "Escape" && !panel.hidden) {
        e.stopImmediatePropagation();
        closeAdmin();
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (panel.hidden) openAdmin();
        else closeAdmin();
      }
    },
    true
  );

  const adminLink = document.getElementById("adminLink");
  if (adminLink) {
    adminLink.addEventListener("click", function (e) {
      e.preventDefault();
      openAdmin();
    });
  }

  const params = new URLSearchParams(location.search);
  if (params.get("admin") === "1" || location.hash === "#admin") openAdmin();
})();
