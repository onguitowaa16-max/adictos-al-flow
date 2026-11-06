import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const here = dirname(fileURLToPath(import.meta.url));
const workDir = mkdtempSync(join(tmpdir(), "aaf-security-"));
const port = 3400 + Math.floor(Math.random() * 300);
const base = "http://127.0.0.1:" + port;
const EMAIL = "test-admin@example.com";
const PASSWORD = "PruebaSegura-2026!";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log("  ok   " + name);
  } else {
    failed++;
    failures.push(name + (detail ? " → " + detail : ""));
    console.log("  FAIL " + name + (detail ? " → " + detail : ""));
  }
}

async function request(path, options = {}) {
  const headers = Object.assign({ Accept: "application/json" }, options.headers || {});
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.cookie) headers.Cookie = options.cookie;
  const response = await fetch(base + path, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  return { status: response.status, headers: response.headers, text, json, setCookies };
}

function cookiePair(setCookies) {
  for (const cookie of setCookies) {
    const match = /^([^=]+)=([^;]*)/.exec(cookie);
    if (match) return { pair: match[1] + "=" + match[2], raw: cookie };
  }
  return null;
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(base + "/api/health");
      if (res.ok) return;
    } catch {}
    await delay(150);
  }
  throw new Error("El servidor de prueba no arrancó");
}

const child = spawn(process.execPath, ["server.mjs"], {
  cwd: here,
  env: {
    ...process.env,
    PORT: String(port),
    STORE_DB: join(workDir, "store.db"),
    ADMIN_EMAIL: EMAIL,
    ADMIN_PASSWORD: PASSWORD,
    NODE_ENV: "production",
    LOGIN_MAX_FAILS: "5",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
child.stdout.on("data", (chunk) => (serverLog += chunk));
child.stderr.on("data", (chunk) => (serverLog += chunk));

try {
  await waitForServer();
  console.log("\nServidor de prueba: " + base + "\n");

  console.log("Salud y sitio");
  const health = await request("/api/health");
  check("health responde modo servidor", health.status === 200 && health.json?.mode === "server");

  const index = await request("/");
  check("portada servida", index.status === 200 && index.text.includes("ADICTOS AL FLOW"));
  check("CSP con script-src self", /script-src 'self'/.test(index.headers.get("content-security-policy") || ""));
  check("nosniff activo", index.headers.get("x-content-type-options") === "nosniff");
  check("iframe bloqueado", index.headers.get("x-frame-options") === "DENY");

  const configJs = await request("/config.js");
  check("config.js dinámico", configJs.status === 200 && configJs.text.includes("window.STORE_SERVER = true"));
  check("config.js sin caché", configJs.headers.get("cache-control") === "no-store");

  console.log("\nAcceso sin sesión");
  const meAnon = await request("/api/admin/me");
  check("/me sin sesión no autentica", meAnon.status === 200 && meAnon.json?.authenticated === false);

  const putAnon = await request("/api/admin/config", {
    method: "PUT",
    body: { whatsappNumber: "18091234567", usdRate: 60, eurRate: 65, stripText: "x", stripEnabled: true },
  });
  check("guardar sin sesión → 401", putAnon.status === 401);

  console.log("\nInyección SQL en login");
  const sqliEmail = await request("/api/admin/login", {
    method: "POST",
    body: { email: "' OR 1=1 -- @x.com", password: "' OR '1'='1" },
  });
  check("email con inyección rechazado", sqliEmail.status === 401, String(sqliEmail.status));

  const sqliPass = await request("/api/admin/login", {
    method: "POST",
    body: { email: EMAIL, password: "' OR 1=1 --" },
  });
  check("contraseña con inyección rechazada", sqliPass.status === 401, String(sqliPass.status));

  const wrong = await request("/api/admin/login", {
    method: "POST",
    body: { email: EMAIL, password: "clave-incorrecta" },
  });
  check("contraseña incorrecta rechazada", wrong.status === 401);
  check("error de login no revela la causa", wrong.json?.error === "invalid_credentials");

  console.log("\nSesión y CSRF");
  const login = await request("/api/admin/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  const session = cookiePair(login.setCookies);
  check("login correcto", login.status === 200 && login.json?.ok === true);
  check("cookie de sesión creada", !!session);
  check("cookie HttpOnly", /HttpOnly/i.test(session?.raw || ""));
  check("cookie SameSite=Strict", /SameSite=Strict/i.test(session?.raw || ""));
  check("token no aparece en el JSON", !JSON.stringify(login.json || {}).includes(session?.pair.split("=")[1] || "@@"));
  const csrf = login.json?.csrf;
  check("CSRF entregado al panel", typeof csrf === "string" && csrf.length >= 20);

  const me = await request("/api/admin/me", { cookie: session.pair });
  check("sesión persistente", me.json?.authenticated === true && me.json?.csrf === csrf);
  check("config del servidor visible", me.json?.config?.usdRate === 60);

  const noCsrf = await request("/api/admin/config", {
    method: "PUT",
    cookie: session.pair,
    body: { whatsappNumber: "18091234567", usdRate: 61, eurRate: 66, stripText: "Prueba", stripEnabled: true },
  });
  check("guardar sin CSRF → 403", noCsrf.status === 403);

  const badCsrf = await request("/api/admin/config", {
    method: "PUT",
    cookie: session.pair,
    headers: { "X-CSRF-Token": "token-falso" },
    body: { whatsappNumber: "18091234567", usdRate: 61, eurRate: 66, stripText: "Prueba", stripEnabled: true },
  });
  check("CSRF inválido → 403", badCsrf.status === 403);

  const badOrigin = await request("/api/admin/config", {
    method: "PUT",
    cookie: session.pair,
    headers: { "X-CSRF-Token": csrf, Origin: "https://sitio-falso.example" },
    body: { whatsappNumber: "18091234567", usdRate: 61, eurRate: 66, stripText: "Prueba", stripEnabled: true },
  });
  check("origen externo → 403", badOrigin.status === 403);

  console.log("\nInyección SQL en configuración");
  const malicious = "'; DROP TABLE settings; --";
  const save = await request("/api/admin/config", {
    method: "PUT",
    cookie: session.pair,
    headers: { "X-CSRF-Token": csrf },
    body: { whatsappNumber: "18091234567", usdRate: 58.5, eurRate: 64, stripText: malicious, stripEnabled: true, isAdmin: true },
  });
  check("guardado con CSRF", save.status === 200 && save.json?.ok === true);

  const store = await request("/api/store");
  check("inyección guardada como texto literal", store.json?.config?.stripText === malicious);
  check("tabla settings intacta", store.status === 200 && store.json?.config?.usdRate === 58.5);
  check("campos desconocidos ignorados", !("isAdmin" in (store.json?.config || {})));

  const digits = await request("/api/admin/config", {
    method: "PUT",
    cookie: session.pair,
    headers: { "X-CSRF-Token": csrf },
    body: { whatsappNumber: "1809; DROP TABLE admin_users;", usdRate: 60, eurRate: 65, stripText: "x", stripEnabled: true },
  });
  check("WhatsApp con caracteres raros → 400", digits.status === 400);

  const negative = await request("/api/admin/config", {
    method: "PUT",
    cookie: session.pair,
    headers: { "X-CSRF-Token": csrf },
    body: { whatsappNumber: "18091234567", usdRate: -1, eurRate: 65, stripText: "x", stripEnabled: true },
  });
  check("tasa negativa → 400", negative.status === 400);

  const loginAfterConfig = await request("/api/admin/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  check("cuentas admin intactas tras inyección", loginAfterConfig.status === 200);

  const secondSession = cookiePair(loginAfterConfig.setCookies);
  if (secondSession) {
    await request("/api/admin/logout", {
      method: "POST",
      cookie: secondSession.pair,
      headers: { "X-CSRF-Token": loginAfterConfig.json?.csrf },
    });
  }

  console.log("\nCierre de sesión y límite de intentos");
  const logout = await request("/api/admin/logout", {
    method: "POST",
    cookie: session.pair,
    headers: { "X-CSRF-Token": csrf },
  });
  check("logout correcto", logout.status === 200);

  const afterLogout = await request("/api/admin/me", { cookie: session.pair });
  check("sesión invalidada en servidor", afterLogout.json?.authenticated === false);

  let limited = false;
  let retryAfter = "";
  for (let i = 0; i < 6; i++) {
    const attempt = await request("/api/admin/login", {
      method: "POST",
      body: { email: EMAIL, password: "otra-clave-mala" },
    });
    if (attempt.status === 429) {
      limited = true;
      retryAfter = attempt.headers.get("retry-after") || "";
      break;
    }
  }
  check("límite de intentos activo", limited);
  check("Retry-After presente", Number(retryAfter) > 0);

  const blockedGood = await request("/api/admin/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  check("login bloqueado durante el castigo", blockedGood.status === 429);

  console.log("\nRutas y cuerpos");
  const traversal = await request("/%2e%2e/tienda-server/.env");
  check("traversal bloqueado", traversal.status >= 400 && !traversal.text.includes("ADMIN_PASSWORD"));

  const serverFile = await request("/server.mjs");
  check("archivo de servidor no expuesto", serverFile.status === 404);

  const api404 = await request("/api/no-existe");
  check("404 JSON en API", api404.status === 404 && api404.json?.error === "not_found");

  const big = await request("/api/admin/login", {
    method: "POST",
    body: { email: EMAIL, password: "x".repeat(20000) },
  });
  check("cuerpo gigante rechazado", big.status === 413 || big.status === 400, String(big.status));

  const wrongType = await fetch(base + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "email=x&password=y",
  });
  check("content-type no JSON rechazado", wrongType.status === 400);
} catch (error) {
  failed++;
  failures.push("error inesperado: " + error.message);
  console.error(error);
} finally {
  child.kill();
  await delay(400);
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {}
}

console.log("\n" + passed + " pruebas ok · " + failed + " fallidas");
if (failed > 0) {
  console.log("\nFallos:");
  failures.forEach((item) => console.log(" - " + item));
  if (serverLog) console.log("\nLog del servidor:\n" + serverLog);
  process.exit(1);
}
