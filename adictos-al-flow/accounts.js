(function () {
  const ACCOUNTS_KEY = "aaf-accounts";
  const SESSION_KEY = "aaf-session";

  const html = `
    <div class="acct" id="acctPanel" hidden>
      <div class="acct-box" role="dialog" aria-modal="true" aria-labelledby="acctTitle">
        <button class="acct-close" id="acctClose" type="button" aria-label="Cerrar">✕</button>

        <div class="acct-view" id="acctAuth">
          <div class="acct-eyebrow">ADICTOS AL FLOW · CUENTA</div>
          <h2 id="acctTitle">Tu cuenta</h2>
          <p class="acct-sub">Opcional. Puedes pedir por WhatsApp sin crear cuenta. Con una cuenta guardas tus favoritos y tus pedidos en este dispositivo.</p>

          <div class="acct-tabs" role="tablist" aria-label="Acceso">
            <button class="acct-tab active" type="button" data-tab="login" role="tab" aria-selected="true">Entrar</button>
            <button class="acct-tab" type="button" data-tab="register" role="tab" aria-selected="false">Crear cuenta</button>
          </div>

          <form class="acct-form" id="loginForm" novalidate>
            <label class="acct-field">Email
              <input type="email" name="email" autocomplete="email" placeholder="tucorreo@ejemplo.com" maxlength="80">
            </label>
            <label class="acct-field">Contraseña
              <input type="password" name="password" autocomplete="current-password" placeholder="Tu contraseña" maxlength="72">
            </label>
            <p class="acct-msg" id="loginMsg" role="alert"></p>
            <button class="acct-primary" type="submit">Entrar</button>
          </form>

          <form class="acct-form" id="registerForm" hidden novalidate>
            <label class="acct-field">Nombre
              <input type="text" name="name" autocomplete="name" placeholder="Tu nombre" maxlength="40">
            </label>
            <label class="acct-field">Email
              <input type="email" name="email" autocomplete="email" placeholder="tucorreo@ejemplo.com" maxlength="80">
            </label>
            <label class="acct-field">WhatsApp (opcional)
              <input type="tel" name="phone" inputmode="numeric" autocomplete="tel" placeholder="18091234567" maxlength="18">
            </label>
            <label class="acct-field">Contraseña
              <input type="password" name="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" maxlength="72">
            </label>
            <p class="acct-msg" id="regMsg" role="alert"></p>
            <button class="acct-primary" type="submit">Crear cuenta</button>
            <p class="acct-fine">La cuenta se guarda solo en este navegador, no en un servidor. No uses una contraseña que uses en otros sitios.</p>
          </form>
        </div>

        <div class="acct-view" id="acctHome" hidden>
          <div class="acct-eyebrow">TU CUENTA</div>
          <h2 id="acctHomeTitle">Hola</h2>
          <p class="acct-sub" id="acctMeta"></p>

          <div class="acct-stats">
            <div class="acct-stat"><strong id="acctFavCount">0</strong><span>FAVORITOS</span></div>
            <div class="acct-stat"><strong id="acctOrderCount">0</strong><span>PEDIDOS</span></div>
          </div>

          <section class="acct-sec">
            <h3>Favoritos</h3>
            <div class="fav-list" id="favList"></div>
          </section>

          <section class="acct-sec">
            <h3>Mis pedidos</h3>
            <div class="order-list" id="orderList"></div>
          </section>

          <div class="acct-actions">
            <button class="acct-out" id="logoutBtn" type="button">Cerrar sesión</button>
            <button class="acct-out danger" id="deleteBtn" type="button">Eliminar cuenta</button>
          </div>

          <p class="acct-fine">Cuenta local de este dispositivo. Los pedidos se completan por WhatsApp y no se envían a ningún servidor.</p>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", html);

  const panel = document.getElementById("acctPanel");
  const closeBtn = document.getElementById("acctClose");
  const authView = document.getElementById("acctAuth");
  const homeView = document.getElementById("acctHome");
  const tabs = Array.from(document.querySelectorAll(".acct-tab"));
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginMsg = document.getElementById("loginMsg");
  const regMsg = document.getElementById("regMsg");
  const homeTitle = document.getElementById("acctHomeTitle");
  const metaEl = document.getElementById("acctMeta");
  const favCountEl = document.getElementById("acctFavCount");
  const orderCountEl = document.getElementById("acctOrderCount");
  const favList = document.getElementById("favList");
  const orderList = document.getElementById("orderList");
  const logoutBtn = document.getElementById("logoutBtn");
  const deleteBtn = document.getElementById("deleteBtn");
  const accountBtn = document.getElementById("accountBtn");
  const accountBtnText = document.getElementById("accountBtnText");

  let accounts = readAccounts();
  let current = null;
  let lastFocused = null;

  const session = readSession();
  if (session && session.id) current = accounts.find((a) => a.id === session.id) || null;
  if (!current) writeSession(null);

  let migrated = false;
  accounts.forEach((a) => {
    if (!Array.isArray(a.favs)) {
      a.favs = [];
      migrated = true;
    }
    if (!Array.isArray(a.orders)) {
      a.orders = [];
      migrated = true;
    }
  });
  if (migrated) writeAccounts();

  function readAccounts() {
    try {
      const list = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
      return Array.isArray(list) ? list.filter((a) => a && typeof a.id === "string" && typeof a.email === "string") : [];
    } catch (e) {
      return [];
    }
  }

  function writeAccounts() {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (e) {}
  }

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function writeSession(id) {
    try {
      if (id) localStorage.setItem(SESSION_KEY, JSON.stringify({ id }));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function subtleAvailable() {
    return !!(window.crypto && window.crypto.subtle && window.TextEncoder);
  }

  async function makeHash(password, salt, algo) {
    const input = salt + ":" + password + ":adictos-al-flow";
    if (algo === "sha256" && subtleAvailable()) {
      const data = new TextEncoder().encode(input);
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    let h1 = 0x811c9dc5;
    let h2 = 5381;
    for (let round = 0; round < 2000; round++) {
      for (let i = 0; i < input.length; i++) {
        const c = input.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
        h2 = (Math.imul(h2, 33) + c) >>> 0;
      }
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function price(value) {
    if (typeof window.formatPrice === "function") return window.formatPrice(value);
    return "RD$" + Number(value || 0).toLocaleString("en-US");
  }

  function dateLabel(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" });
  }

  function findProduct(id) {
    return PRODUCTS.find((p) => p.id === id);
  }

  function setMsg(el, text) {
    el.textContent = text || "";
    el.classList.toggle("show", !!text);
  }

  function fail(el, text, input) {
    setMsg(el, text);
    if (input) input.focus();
    return false;
  }

  function showView(name) {
    authView.hidden = name !== "auth";
    homeView.hidden = name !== "home";
  }

  function setTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
    });
    loginForm.hidden = tab !== "login";
    registerForm.hidden = tab !== "register";
    setMsg(loginMsg, "");
    setMsg(regMsg, "");
    if (focus) {
      const input = (tab === "login" ? loginForm : registerForm).querySelector("input");
      if (input) setTimeout(() => input.focus(), 30);
    }
  }

  function updateHeader() {
    if (!accountBtn || !accountBtnText) return;
    if (current) {
      accountBtn.classList.add("on");
      const first = current.name.split(/\s+/)[0];
      accountBtnText.textContent = first.length > 12 ? first.slice(0, 12) + "…" : first;
      accountBtn.setAttribute("aria-label", "Mi cuenta: " + current.name);
    } else {
      accountBtn.classList.remove("on");
      accountBtnText.textContent = "CUENTA";
      accountBtn.setAttribute("aria-label", "Crear cuenta o iniciar sesión");
    }
    syncFavButtons();
    syncModalFav();
  }

  function openAccount(tab) {
    lastFocused = document.activeElement;
    if (current) {
      renderHome();
    } else {
      showView("auth");
      setTab(tab || "login", false);
    }
    panel.hidden = false;
    document.body.classList.add("acct-open");
    if (current) closeBtn.focus();
    else {
      const input = ((tab || "login") === "login" ? loginForm : registerForm).querySelector("input");
      if (input) setTimeout(() => input.focus(), 30);
    }
  }

  function closeAccount() {
    if (panel.hidden) return;
    panel.hidden = true;
    document.body.classList.remove("acct-open");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function renderHome() {
    if (!current) return;
    showView("home");
    homeTitle.textContent = "Hola, " + current.name.split(/\s+/)[0];
    metaEl.textContent = current.email;
    favCountEl.textContent = current.favs.length;
    orderCountEl.textContent = current.orders.length;
    renderFavs();
    renderOrders();
  }

  function renderFavs() {
    const items = current.favs.map(findProduct).filter(Boolean);
    if (!items.length) {
      favList.innerHTML = '<p class="acct-empty">Toca el corazón en cualquier producto para guardarlo aquí.</p>';
      return;
    }
    favList.innerHTML = items
      .map(
        (p) => `
        <div class="fav-item" data-id="${esc(p.id)}" role="button" tabindex="0">
          <img src="${p.img[0]}" alt="" width="44" height="44" loading="lazy">
          <div class="fav-info">
            <strong>${esc(p.name)}</strong>
            <span>${price(p.price)}</span>
          </div>
          <button class="fav-remove" type="button" data-remove="${esc(p.id)}" aria-label="Quitar de favoritos">✕</button>
        </div>`
      )
      .join("");
  }

  function renderOrders() {
    if (!current.orders.length) {
      orderList.innerHTML = '<p class="acct-empty">Cuando pidas por WhatsApp con la sesión abierta, el pedido aparecerá aquí.</p>';
      return;
    }
    orderList.innerHTML = current.orders
      .map((o) => {
        const openable = findProduct(o.productId);
        return `
        <div class="order-item"${openable ? ` data-open="${esc(o.productId)}" role="button" tabindex="0"` : ""}>
          <div>
            <strong>${esc(o.name)}</strong>
            <small>Talla ${esc(o.size)} · ${dateLabel(o.date)}</small>
          </div>
          <span class="order-price">${price(o.price)}</span>
        </div>`;
      })
      .join("");
  }

  function syncFavButtons() {
    document.querySelectorAll(".fav-btn").forEach((btn) => {
      const on = !!current && current.favs.indexOf(btn.dataset.id) >= 0;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  function syncModalFav() {
    const btn = document.getElementById("mFav");
    const label = document.getElementById("mFavText");
    if (!btn) return;
    const on = !!(btn.dataset.id && current && current.favs.indexOf(btn.dataset.id) >= 0);
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Quitar de favoritos" : "Guardar en favoritos");
    if (label) label.textContent = on ? "Guardado" : "Favorito";
  }

  function toggleFav(id) {
    if (!id) return;
    if (!current) {
      openAccount("register");
      if (typeof window.showToast === "function") window.showToast("Crea una cuenta para guardar tus favoritos");
      return;
    }
    const index = current.favs.indexOf(id);
    if (index >= 0) current.favs.splice(index, 1);
    else current.favs.unshift(id);
    writeAccounts();
    syncFavButtons();
    syncModalFav();
    if (!panel.hidden) renderHome();
    if (typeof window.showToast === "function") {
      window.showToast(index >= 0 ? "Quitado de favoritos" : "Guardado en favoritos");
    }
  }

  async function register(event) {
    event.preventDefault();
    const fields = registerForm.elements;
    const name = fields.name.value.trim().replace(/\s+/g, " ");
    const email = fields.email.value.trim().toLowerCase();
    const phone = fields.phone.value.replace(/\D/g, "").slice(0, 15);
    const password = fields.password.value;

    if (name.length < 2) return fail(regMsg, "Escribe tu nombre.", fields.name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(regMsg, "Escribe un email válido.", fields.email);
    if (phone && (phone.length < 8 || phone.length > 15)) {
      return fail(regMsg, "El WhatsApp debe tener entre 8 y 15 dígitos, con código de país.", fields.phone);
    }
    if (password.length < 6) return fail(regMsg, "La contraseña debe tener al menos 6 caracteres.", fields.password);
    if (accounts.some((a) => a.email === email)) {
      return fail(regMsg, "Ya hay una cuenta con ese email en este dispositivo.", fields.email);
    }

    const salt = randomSalt();
    const algo = subtleAvailable() ? "sha256" : "fnv";
    const hash = await makeHash(password, salt, algo);
    const account = {
      id: "acc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name,
      email,
      phone,
      salt,
      hash,
      algo,
      favs: [],
      orders: [],
      createdAt: new Date().toISOString(),
    };
    accounts.push(account);
    current = account;
    writeAccounts();
    writeSession(account.id);
    registerForm.reset();
    setMsg(regMsg, "");
    updateHeader();
    renderHome();
    if (typeof window.showToast === "function") window.showToast("Cuenta creada. Bienvenido, " + name.split(/\s+/)[0]);
  }

  async function login(event) {
    event.preventDefault();
    const fields = loginForm.elements;
    const email = fields.email.value.trim().toLowerCase();
    const password = fields.password.value;
    const account = accounts.find((a) => a.email === email);
    if (!account) return fail(loginMsg, "Email o contraseña incorrectos.", fields.email);

    const hash = await makeHash(password, account.salt, account.algo || "sha256");
    if (hash !== account.hash) return fail(loginMsg, "Email o contraseña incorrectos.", fields.password);

    current = account;
    writeSession(account.id);
    loginForm.reset();
    setMsg(loginMsg, "");
    updateHeader();
    renderHome();
    if (typeof window.showToast === "function") window.showToast("Sesión iniciada");
  }

  panelsEvents();

  function panelsEvents() {
    if (accountBtn) {
      accountBtn.addEventListener("click", () => openAccount(current ? null : "login"));
    }

    closeBtn.addEventListener("click", closeAccount);
    panel.addEventListener("click", (e) => {
      if (e.target === panel) closeAccount();
    });

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => setTab(tab.dataset.tab, true));
    });

    loginForm.addEventListener("submit", login);
    registerForm.addEventListener("submit", register);

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".fav-btn");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      toggleFav(btn.dataset.id);
    });

    const modalFav = document.getElementById("mFav");
    if (modalFav) {
      modalFav.addEventListener("click", () => toggleFav(modalFav.dataset.id));
    }

    favList.addEventListener("click", (e) => {
      const remove = e.target.closest(".fav-remove");
      if (remove) {
        e.stopPropagation();
        toggleFav(remove.dataset.remove);
        return;
      }
      const item = e.target.closest(".fav-item");
      if (item) {
        closeAccount();
        if (typeof window.openModal === "function") window.openModal(item.dataset.id);
      }
    });

    favList.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const item = e.target.closest(".fav-item");
      if (!item) return;
      e.preventDefault();
      closeAccount();
      if (typeof window.openModal === "function") window.openModal(item.dataset.id);
    });

    orderList.addEventListener("click", (e) => {
      const item = e.target.closest("[data-open]");
      if (!item) return;
      closeAccount();
      if (typeof window.openModal === "function") window.openModal(item.dataset.open);
    });

    orderList.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const item = e.target.closest("[data-open]");
      if (!item) return;
      e.preventDefault();
      closeAccount();
      if (typeof window.openModal === "function") window.openModal(item.dataset.open);
    });

    logoutBtn.addEventListener("click", () => {
      current = null;
      writeSession(null);
      showView("auth");
      setTab("login", false);
      updateHeader();
      if (typeof window.showToast === "function") window.showToast("Sesión cerrada");
    });

    deleteBtn.addEventListener("click", () => {
      if (!current) return;
      if (!confirm("¿Eliminar tu cuenta de este dispositivo? Se borrarán tus favoritos y pedidos guardados.")) return;
      accounts = accounts.filter((a) => a.id !== current.id);
      current = null;
      writeAccounts();
      writeSession(null);
      showView("auth");
      setTab("register", false);
      updateHeader();
      if (typeof window.showToast === "function") window.showToast("Cuenta eliminada");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || panel.hidden) return;
      e.stopImmediatePropagation();
      closeAccount();
    });
  }

  window.ACCOUNTS = {
    isFav(id) {
      return !!current && current.favs.indexOf(id) >= 0;
    },
    toggleFav,
    syncModalFav,
    syncFavButtons,
    open: openAccount,
    get logged() {
      return !!current;
    },
    addOrder(product, size) {
      if (!current || !product) return;
      current.orders.unshift({
        productId: product.id,
        name: product.name,
        size: String(size || ""),
        price: Number(product.price) || 0,
        date: new Date().toISOString(),
      });
      if (current.orders.length > 50) current.orders.length = 50;
      writeAccounts();
      if (!panel.hidden) renderHome();
    },
  };

  updateHeader();
})();