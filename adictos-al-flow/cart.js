(function () {
  const CART_KEY = "aaf-cart";
  const MAX_QTY = 99;
  const MAX_ITEMS = 50;

  const html = `
    <div class="cart" id="cartPanel" hidden>
      <div class="cart-box" role="dialog" aria-modal="true" aria-labelledby="cartTitle">
        <div class="cart-head">
          <div>
            <div class="cart-eyebrow">ADICTOS AL FLOW</div>
            <h2 id="cartTitle">Tu carrito</h2>
          </div>
          <button class="cart-close" id="cartClose" type="button" aria-label="Cerrar carrito">✕</button>
        </div>

        <div class="cart-body" id="cartList"></div>

        <div class="cart-foot">
          <div class="cart-total-row">
            <span>Total <small id="cartPieces"></small></span>
            <strong id="cartTotal">RD$0</strong>
          </div>
          <p class="cart-note">Pedido mínimo de 3 productos · Entrega en República Dominicana</p>
          <button class="cart-checkout" id="cartCheckout" type="button">Pedir todo por WhatsApp</button>
          <button class="cart-clear" id="cartClear" type="button">Vaciar carrito</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", html);

  const panel = document.getElementById("cartPanel");
  const list = document.getElementById("cartList");
  const totalEl = document.getElementById("cartTotal");
  const piecesEl = document.getElementById("cartPieces");
  const checkoutBtn = document.getElementById("cartCheckout");
  const clearBtn = document.getElementById("cartClear");
  const closeBtn = document.getElementById("cartClose");
  const cartBtn = document.getElementById("cartBtn");
  const badge = document.getElementById("cartBadge");

  let items = readCart();
  let lastFocused = null;

  function readCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (!Array.isArray(saved)) return [];
      return saved
        .filter((it) => it && typeof it.id === "string" && typeof it.size === "string" && Number(it.qty) > 0)
        .map((it) => ({ id: it.id, size: it.size, qty: Math.min(MAX_QTY, Math.floor(Number(it.qty))) }))
        .slice(0, MAX_ITEMS);
    } catch (e) {
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (e) {}
  }

  function productOf(id) {
    return PRODUCTS.find((p) => p.id === id);
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(value) {
    if (typeof window.formatPrice === "function") return window.formatPrice(value);
    return "RD$" + Number(value || 0).toLocaleString("en-US");
  }

  function moneyDop(value) {
    return "RD$" + Number(value || 0).toLocaleString("en-US");
  }

  function totals() {
    let qty = 0;
    let dop = 0;
    items.forEach((it) => {
      const product = productOf(it.id);
      if (!product) return;
      qty += it.qty;
      dop += product.price * it.qty;
    });
    return { qty, dop };
  }

  function render() {
    items = items.filter((it) => {
      const product = productOf(it.id);
      return product && product.sizes.indexOf(it.size) >= 0;
    });
    const total = totals();

    badge.textContent = total.qty > 99 ? "99+" : String(total.qty);
    badge.hidden = total.qty === 0;
    cartBtn.setAttribute(
      "aria-label",
      total.qty
        ? "Abrir carrito, " + total.qty + (total.qty === 1 ? " pieza" : " piezas")
        : "Abrir carrito"
    );

    if (!items.length) {
      list.innerHTML = `
        <div class="cart-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.4a2 2 0 0 0 1.96 1.6H18a2 2 0 0 0 1.96-1.55L21.6 7H6"/><circle cx="10" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>
          <p>Tu carrito está vacío</p>
          <small>Agrega productos desde el catálogo para pedirlos todos juntos.</small>
          <button class="cart-shop" type="button">Ver productos</button>
        </div>`;
    } else {
      list.innerHTML = items
        .map((it, i) => {
          const product = productOf(it.id);
          return `
          <article class="cart-item">
            <img src="${product.img[0]}" alt="${esc(product.name)}" width="62" height="62" loading="lazy">
            <div class="cart-info">
              <strong>${esc(product.name)}</strong>
              <small>Talla ${esc(it.size)} · ${money(product.price)}</small>
              <div class="cart-qty">
                <button type="button" data-act="minus" data-index="${i}" aria-label="Quitar una unidad de ${esc(product.name)}">−</button>
                <span>${it.qty}</span>
                <button type="button" data-act="plus" data-index="${i}" aria-label="Añadir una unidad de ${esc(product.name)}">+</button>
              </div>
            </div>
            <div class="cart-side">
              <button class="cart-remove" type="button" data-act="remove" data-index="${i}" aria-label="Quitar ${esc(product.name)} del carrito">✕</button>
              <span class="cart-line">${money(product.price * it.qty)}</span>
            </div>
          </article>`;
        })
        .join("");
    }

    totalEl.textContent = money(total.dop);
    piecesEl.textContent = total.qty ? "· " + total.qty + (total.qty === 1 ? " pieza" : " piezas") : "";
    checkoutBtn.disabled = !items.length;
    clearBtn.hidden = !items.length;
  }

  function open() {
    if (!panel.hidden) return;
    lastFocused = document.activeElement;
    render();
    panel.hidden = false;
    document.body.classList.add("cart-open");
    closeBtn.focus();
  }

  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    document.body.classList.remove("cart-open");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function add(product, size) {
    if (!product || !size) return;
    const found = items.find((it) => it.id === product.id && it.size === size);
    if (found) {
      found.qty = Math.min(MAX_QTY, found.qty + 1);
    } else {
      items.unshift({ id: product.id, size: String(size), qty: 1 });
      if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
    }
    persist();
    render();
    if (typeof window.showToast === "function") {
      window.showToast("Añadido al carrito · Total " + money(totals().dop));
    }
  }

  function changeQty(index, delta) {
    const item = items[index];
    if (!item) return;
    const next = item.qty + delta;
    if (next < 1) items.splice(index, 1);
    else item.qty = Math.min(MAX_QTY, next);
    persist();
    render();
  }

  function remove(index) {
    if (!items[index]) return;
    items.splice(index, 1);
    persist();
    render();
    if (typeof window.showToast === "function") window.showToast("Producto quitado del carrito");
  }

  function clear() {
    if (!items.length) return;
    if (!confirm("¿Vaciar el carrito?")) return;
    items = [];
    persist();
    render();
  }

  function checkout() {
    if (!items.length) return;
    const config = (window.STORE && window.STORE.config) || {};
    if (!config.whatsappNumber) {
      if (typeof window.showToast === "function") window.showToast("Falta configurar el WhatsApp de la tienda");
      return;
    }

    const lines = ["Hola, vengo de la página de Adictos al Flow.", "Quiero pedir:"];
    let total = 0;
    let qty = 0;

    items.forEach((it) => {
      const product = productOf(it.id);
      if (!product) return;
      total += product.price * it.qty;
      qty += it.qty;
      lines.push(
        "• " + product.name + " — Talla " + it.size +
          (it.qty > 1 ? " × " + it.qty : "") +
          " — " + moneyDop(product.price * it.qty)
      );
    });

    lines.push(
      "",
      "Total: " + moneyDop(total) + " (" + qty + (qty === 1 ? " pieza" : " piezas") + ")",
      "",
      "¿Están disponibles?"
    );

    window.open(
      "https://wa.me/" + config.whatsappNumber + "?text=" + encodeURIComponent(lines.join("\n")),
      "_blank",
      "noopener"
    );

    items = [];
    persist();
    render();
    close();
  }

  cartBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  panel.addEventListener("click", (e) => {
    if (e.target === panel) close();
  });

  list.addEventListener("click", (e) => {
    const shop = e.target.closest(".cart-shop");
    if (shop) {
      close();
      const grid = document.getElementById("grid");
      if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const index = Number(btn.dataset.index);
    if (btn.dataset.act === "plus") changeQty(index, 1);
    else if (btn.dataset.act === "minus") changeQty(index, -1);
    else if (btn.dataset.act === "remove") remove(index);
  });

  checkoutBtn.addEventListener("click", checkout);
  clearBtn.addEventListener("click", clear);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || panel.hidden) return;
    e.stopImmediatePropagation();
    close();
  });

  window.CART = {
    add,
    render,
    open,
    get count() {
      return totals().qty;
    },
  };

  render();
})();
