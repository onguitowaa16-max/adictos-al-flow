const DEFAULT_CONFIG = {
  whatsappNumber: "",
  usdRate: 60,
  eurRate: 65,
  stripText: "PEDIDO MÍNIMO DE 3 PRODUCTOS O MÁS",
  stripEnabled: true,
};

const FILE_CONFIG = Object.assign({}, DEFAULT_CONFIG, window.STORE_CONFIG || {});
const FILE_VERSION = Number(FILE_CONFIG.version) || 0;
const CONFIG = Object.assign({}, FILE_CONFIG);
delete CONFIG.version;

let localConfig = null;
try {
  localConfig = JSON.parse(localStorage.getItem("aaf-config") || "null");
} catch (e) {}

const LOCAL_ACTIVE = !window.STORE_SERVER && !!(localConfig && Number(localConfig.basedOn) === FILE_VERSION);
if (LOCAL_ACTIVE) {
  if (typeof localConfig.whatsappNumber === "string") CONFIG.whatsappNumber = localConfig.whatsappNumber;
  if (Number(localConfig.usdRate) > 0) CONFIG.usdRate = Number(localConfig.usdRate);
  if (Number(localConfig.eurRate) > 0) CONFIG.eurRate = Number(localConfig.eurRate);
  if (typeof localConfig.stripText === "string") CONFIG.stripText = localConfig.stripText;
  if (typeof localConfig.stripEnabled === "boolean") CONFIG.stripEnabled = localConfig.stripEnabled;
} else {
  try {
    localStorage.removeItem("aaf-config");
  } catch (e) {}
}

const CURRENCIES = {
  DOP: { label: "$DOP", symbol: "RD$" },
  USD: { label: "$USD", symbol: "US$" },
  EUR: { label: "€EUR", symbol: "€" },
};

function rateOf(code) {
  if (code === "USD") return CONFIG.usdRate > 0 ? 1 / CONFIG.usdRate : 1;
  if (code === "EUR") return CONFIG.eurRate > 0 ? 1 / CONFIG.eurRate : 1;
  return 1;
}

const CAT_LABELS = {
  ropa: "Ropa",
  zapatillas: "Zapatillas",
  accesorios: "Accesorios",
};

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const sectionHead = document.getElementById("sectionHead");
const sectionTitle = document.getElementById("sectionTitle");
const sectionCount = document.getElementById("sectionCount");
const currencyBtn = document.getElementById("currency-btn");
const currencyDropdown = document.getElementById("currency-dropdown");
const modal = document.getElementById("modal");
const modalClose = document.getElementById("modalClose");
const track = document.getElementById("track");
const dotsBox = document.getElementById("dots");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const mCat = document.getElementById("mCat");
const mName = document.getElementById("mName");
const mPrice = document.getElementById("mPrice");
const mDesc = document.getElementById("mDesc");
const sizesBox = document.getElementById("sizes");
const addCartBtn = document.getElementById("addCartBtn");
const orderBtn = document.getElementById("orderBtn");
const toastEl = document.getElementById("toast");

let currentCat = "ropa";
let currentProduct = null;
let currentImages = [];
let slideIdx = 0;
let selectedSize = null;
let currentCurrency = "DOP";
let toastTimer = null;
let lastFocused = null;

try {
  const saved = localStorage.getItem("aaf-currency");
  if (CURRENCIES[saved]) currentCurrency = saved;
} catch (e) {}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDop(value) {
  return "RD$" + value.toLocaleString("en-US");
}

function formatPrice(value) {
  const currency = CURRENCIES[currentCurrency];
  return currency.symbol + Math.round(value * rateOf(currentCurrency)).toLocaleString("en-US");
}

function applyStoreSettings() {
  const strip = document.querySelector(".top-strip");
  const show = CONFIG.stripEnabled !== false && String(CONFIG.stripText || "").trim() !== "";
  document.body.classList.toggle("no-strip", !show);
  strip.style.display = show ? "" : "none";
  if (show) strip.textContent = CONFIG.stripText;
}

function refreshStore() {
  applyStoreSettings();
  renderGrid();
  if (currentProduct) mPrice.textContent = formatPrice(currentProduct.price);
  if (window.CART) window.CART.render();
}

function setCurrency(code) {
  if (!CURRENCIES[code]) return;
  currentCurrency = code;
  currencyBtn.textContent = CURRENCIES[code].label;
  currencyDropdown.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.cur === code));
  });
  try {
    localStorage.setItem("aaf-currency", code);
  } catch (e) {}
  renderGrid();
  if (currentProduct) mPrice.textContent = formatPrice(currentProduct.price);
  if (window.CART) window.CART.render();
}

function renderGrid() {
  const list = PRODUCTS.filter((p) => p.cat === currentCat);

  if (currentCat === "ropa") {
    sectionHead.hidden = true;
  } else {
    sectionHead.hidden = false;
    sectionTitle.textContent = CAT_LABELS[currentCat].toUpperCase();
    sectionCount.textContent = list.length + (list.length === 1 ? " MODELO" : " MODELOS");
  }

  empty.hidden = list.length > 0;

  grid.innerHTML = list
    .map((p, i) => {
      const fav = window.ACCOUNTS ? window.ACCOUNTS.isFav(p.id) : false;
      return `
      <article class="card" style="animation-delay:${(i % 8) * 35}ms">
        <div class="card-img">
          <img src="${p.img[0]}" alt="${esc(p.name)}" width="650" height="650" loading="lazy" decoding="async">
          <button class="fav-btn${fav ? " active" : ""}" type="button" data-id="${esc(p.id)}" aria-pressed="${fav}" aria-label="Guardar en favoritos">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.4S4.8 15.9 3 11.7A5.2 5.2 0 0 1 12 6.4a5.2 5.2 0 0 1 9 5.3c-1.8 4.2-9 8.7-9 8.7z"/></svg>
          </button>
        </div>
        <div class="card-body">
          <h3 class="card-name">${esc(p.name)}</h3>
          <div class="card-price">${formatPrice(p.price)}</div>
          <button class="btn-view" data-id="${esc(p.id)}">Ver producto</button>
        </div>
      </article>`;
    })
    .join("");
}

function pickCategory(cat) {
  currentCat = cat;
  document.querySelectorAll(".cat-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.cat === cat);
  });
  renderGrid();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSlide(index) {
  if (!currentImages.length) return;
  slideIdx = (index + currentImages.length) % currentImages.length;
  track.style.transform = "translateX(-" + slideIdx * 100 + "%)";
  dotsBox.querySelectorAll(".dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === slideIdx);
  });
}

function openModal(id) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return;

  currentProduct = product;
  currentImages = product.img;
  slideIdx = 0;
  selectedSize = null;
  lastFocused = document.activeElement;

  track.innerHTML = currentImages
    .map(
      (src, i) =>
        `<img src="${src}" alt="${esc(product.name)}${currentImages.length > 1 ? " — foto " + (i + 1) : ""}">`
    )
    .join("");
  track.style.transform = "translateX(0)";

  const multiple = currentImages.length > 1;
  dotsBox.innerHTML = multiple
    ? currentImages
        .map(
          (_, i) =>
            `<button class="dot${i === 0 ? " active" : ""}" data-index="${i}" aria-label="Foto ${i + 1}"></button>`
        )
        .join("")
    : "";
  prevBtn.hidden = !multiple;
  nextBtn.hidden = !multiple;

  mCat.textContent = CAT_LABELS[product.cat];
  mName.textContent = product.name;
  mPrice.textContent = formatPrice(product.price);
  mDesc.textContent = product.desc;

  const mFav = document.getElementById("mFav");
  if (mFav) mFav.dataset.id = product.id;
  if (window.ACCOUNTS) window.ACCOUNTS.syncModalFav();

  sizesBox.innerHTML = product.sizes
    .map((s) => `<button class="size-btn" data-size="${esc(s)}">${esc(s)}</button>`)
    .join("");

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  modalClose.focus();
}

function closeModal() {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  currentProduct = null;
  currentImages = [];
  selectedSize = null;
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
}

function pickSize(btn) {
  sizesBox.querySelectorAll(".size-btn").forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");
  selectedSize = btn.dataset.size;
}

function buildWhatsappUrl(product, size) {
  const lines = [
    "Hola, vengo de la página de Adictos al Flow.",
    "Quiero pedir:",
    "• " + product.name + " — Talla " + size,
    "Precio: " + formatDop(product.price),
    "",
    "¿Está disponible?",
  ];
  return "https://wa.me/" + CONFIG.whatsappNumber + "?text=" + encodeURIComponent(lines.join("\n"));
}

function orderWhatsapp() {
  if (!currentProduct) return;

  if (!selectedSize) {
    showToast("Elige una talla primero");
    return;
  }

  if (!CONFIG.whatsappNumber) {
    showToast("Falta configurar el WhatsApp de la tienda");
    return;
  }

  window.open(buildWhatsappUrl(currentProduct, selectedSize), "_blank", "noopener");
}

function addToCart() {
  if (!currentProduct) return;

  if (!selectedSize) {
    showToast("Elige una talla primero");
    return;
  }

  if (window.CART) window.CART.add(currentProduct, selectedSize);
}

function renderHero() {
  const media = document.querySelector(".hero-media");
  const count = document.getElementById("heroCount");
  if (count) count.textContent = PRODUCTS.length;

  if (!media) return;
  const picks = ["ropa", "zapatillas"].map((cat) => PRODUCTS.find((p) => p.cat === cat)).filter(Boolean);
  media.querySelectorAll("img").forEach((img, i) => {
    if (picks[i]) img.src = picks[i].img[0];
  });
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

document.querySelectorAll(".cat-btn").forEach((btn) => {
  btn.addEventListener("click", () => pickCategory(btn.dataset.cat));
});

document.querySelectorAll("[data-hero-cat]").forEach((btn) => {
  btn.addEventListener("click", () => pickCategory(btn.dataset.heroCat));
});

grid.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-view");
  if (btn) openModal(btn.dataset.id);
});

sizesBox.addEventListener("click", (e) => {
  const btn = e.target.closest(".size-btn");
  if (btn) pickSize(btn);
});

dotsBox.addEventListener("click", (e) => {
  const dot = e.target.closest(".dot");
  if (dot) showSlide(Number(dot.dataset.index));
});

prevBtn.addEventListener("click", () => showSlide(slideIdx - 1));
nextBtn.addEventListener("click", () => showSlide(slideIdx + 1));

currencyBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = currencyDropdown.classList.toggle("open");
  currencyBtn.setAttribute("aria-expanded", String(open));
});

currencyDropdown.addEventListener("click", (e) => {
  const option = e.target.closest("button[data-cur]");
  if (!option) return;
  setCurrency(option.dataset.cur);
  currencyDropdown.classList.remove("open");
  currencyBtn.setAttribute("aria-expanded", "false");
});

document.addEventListener("click", () => {
  currencyDropdown.classList.remove("open");
  currencyBtn.setAttribute("aria-expanded", "false");
});

modalClose.addEventListener("click", closeModal);
addCartBtn.addEventListener("click", addToCart);
orderBtn.addEventListener("click", orderWhatsapp);

modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (!modal.classList.contains("active")) return;
  if (e.key === "Escape") closeModal();
  if (e.key === "ArrowLeft" && currentImages.length > 1) showSlide(slideIdx - 1);
  if (e.key === "ArrowRight" && currentImages.length > 1) showSlide(slideIdx + 1);
});

window.STORE = {
  config: CONFIG,
  defaults: DEFAULT_CONFIG,
  fileConfig: FILE_CONFIG,
  fileVersion: FILE_VERSION,
  hasLocal: LOCAL_ACTIVE,
  rateOf,
  apply(next) {
    Object.assign(CONFIG, next);
    refreshStore();
  },
  persist() {
    try {
      localStorage.setItem("aaf-config", JSON.stringify(Object.assign({}, CONFIG, { basedOn: FILE_VERSION })));
      window.STORE.hasLocal = true;
    } catch (e) {}
  },
  clearLocal() {
    try {
      localStorage.removeItem("aaf-config");
    } catch (e) {}
    window.STORE.hasLocal = false;
  },
  buildConfigSource() {
    const data = {
      whatsappNumber: CONFIG.whatsappNumber,
      usdRate: CONFIG.usdRate,
      eurRate: CONFIG.eurRate,
      stripText: CONFIG.stripText,
      stripEnabled: CONFIG.stripEnabled,
      version: Date.now(),
    };
    return (
      "// Configuración de Adictos al Flow — generado " +
      new Date().toISOString() +
      "\nwindow.STORE_CONFIG = " +
      JSON.stringify(data, null, 2) +
      ";\n"
    );
  },
};

document.getElementById("year").textContent = new Date().getFullYear();

renderHero();
applyStoreSettings();
currencyBtn.textContent = CURRENCIES[currentCurrency].label;
setCurrency(currentCurrency);