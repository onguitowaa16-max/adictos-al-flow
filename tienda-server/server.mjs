import "./env.mjs";

import express from "express";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword, verifyPassword, sha256, randomToken, safeEqual } from "./crypto.mjs";
import {
  readConfig,
  configVersion,
  saveConfig,
  findAdmin,
  adminCount,
  createAdmin,
  createSession,
  getSession,
  deleteSession,
  purgeSessions,
  countAttempts,
  addAttempt,
  clearAttempts,
  pruneAttempts,
  audit,
} from "./db.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const SITE_DIR = process.env.SITE_DIR ? resolve(process.env.SITE_DIR) : join(here, "..", "adictos-al-flow");
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_EMAIL = Number(process.env.LOGIN_MAX_FAILS) || 5;
const MAX_FAILS_PER_IP = 25;
const COOKIE_NAME = "aaf_sid";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
].join("; ");

const DUMMY_HASH = hashPassword(randomToken(16));

const bootEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const bootPassword = process.env.ADMIN_PASSWORD || "";
if (adminCount() === 0 && bootEmail && bootPassword) {
  createAdmin(bootEmail, hashPassword(bootPassword));
  console.log("[admin] Cuenta de administrador creada desde variables de entorno.");
}

const app = express();
app.disable("x-powered-by");
if (TRUST_PROXY) app.set("trust proxy", 1);

function isSecure(req) {
  return req.secure || req.get("x-forwarded-proto") === "https";
}

function clientIp(req) {
  return (TRUST_PROXY && req.ip) || req.socket.remoteAddress || "";
}

function cookieOptions(req) {
  return { httpOnly: true, sameSite: "strict", secure: isSecure(req), path: "/" };
}

function parseCookies(header) {
  const out = Object.create(null);
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key || key in out) continue;
    try {
      out[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      out[key] = "";
    }
  }
  return out;
}

function sessionFromRequest(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token || token.length > 200) return null;
  const row = getSession(sha256(token));
  if (!row) return null;
  if (Number(row.expires_at) <= Date.now()) {
    deleteSession(row.token_hash);
    return null;
  }
  return row;
}

function requireSession(req, res, next) {
  const session = sessionFromRequest(req);
  if (!session) return res.status(401).json({ ok: false, error: "unauthorized" });
  req.adminSession = session;
  next();
}

function requireAdmin(req, res, next) {
  const session = sessionFromRequest(req);
  if (!session) return res.status(401).json({ ok: false, error: "unauthorized" });
  const provided = req.get("x-csrf-token") || "";
  if (!safeEqual(provided, session.csrf)) {
    return res.status(403).json({ ok: false, error: "csrf" });
  }
  req.adminSession = session;
  next();
}

function loginKey(req, email) {
  return sha256("login|" + clientIp(req) + "|" + email);
}

function ipKey(req) {
  return sha256("ip|" + clientIp(req));
}

function isRateLimited(key, addressKey) {
  const since = Date.now() - RATE_WINDOW_MS;
  return (
    countAttempts(key, since) >= MAX_FAILS_PER_EMAIL ||
    countAttempts(addressKey, since) >= MAX_FAILS_PER_IP
  );
}

function validateConfig(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_body" };
  }
  if (typeof body.whatsappNumber !== "string") return { ok: false, error: "whatsapp" };
  if (typeof body.stripText !== "string") return { ok: false, error: "stripText" };
  if (typeof body.stripEnabled !== "boolean") return { ok: false, error: "stripEnabled" };

  const whatsappNumber = body.whatsappNumber.replace(/\D/g, "");
  if (whatsappNumber !== body.whatsappNumber || whatsappNumber.length > 15) {
    return { ok: false, error: "whatsapp" };
  }
  if (whatsappNumber.length > 0 && (whatsappNumber.length < 8 || whatsappNumber.length > 15)) {
    return { ok: false, error: "whatsapp" };
  }

  const usdRate = Number(body.usdRate);
  const eurRate = Number(body.eurRate);
  if (!Number.isFinite(usdRate) || usdRate <= 0 || usdRate > 100000) {
    return { ok: false, error: "usdRate" };
  }
  if (!Number.isFinite(eurRate) || eurRate <= 0 || eurRate > 100000) {
    return { ok: false, error: "eurRate" };
  }

  const stripText = body.stripText.trim();
  if (stripText.length > 80) return { ok: false, error: "stripText" };
  if (body.stripEnabled && !stripText) return { ok: false, error: "stripText" };

  return {
    ok: true,
    value: {
      whatsappNumber,
      usdRate,
      eurRate,
      stripText,
      stripEnabled: body.stripEnabled,
    },
  };
}

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (isSecure(req)) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin) {
      const expected = (isSecure(req) ? "https" : "http") + "://" + req.get("host");
      if (origin !== expected) {
        return res.status(403).json({ ok: false, error: "origin" });
      }
    }
  }
  next();
});

app.use("/api", express.json({ limit: "16kb", strict: true, type: "application/json" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, mode: "server" });
});

app.get("/api/store", (req, res) => {
  res.json({ ok: true, config: readConfig(), version: configVersion() });
});

app.get("/api/admin/me", (req, res) => {
  const session = sessionFromRequest(req);
  if (!session) return res.json({ ok: true, authenticated: false });
  res.json({
    ok: true,
    authenticated: true,
    csrf: session.csrf,
    expiresAt: Number(session.expires_at),
    config: readConfig(),
    version: configVersion(),
  });
});

app.post("/api/admin/login", (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || email.length > 80 || !email.includes("@") || !password || password.length > 200) {
    return res.status(400).json({ ok: false, error: "invalid_input" });
  }

  const key = loginKey(req, email);
  const addressKey = ipKey(req);
  pruneAttempts(Date.now() - RATE_WINDOW_MS);

  if (isRateLimited(key, addressKey)) {
    audit("login_blocked", addressKey);
    res.setHeader("Retry-After", String(Math.ceil(RATE_WINDOW_MS / 1000)));
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }

  const user = findAdmin(email);
  const valid = verifyPassword(password, user ? user.pass_hash : DUMMY_HASH);

  if (!user || !valid) {
    addAttempt(key);
    addAttempt(addressKey);
    audit("login_fail", addressKey);
    return res.status(401).json({ ok: false, error: "invalid_credentials" });
  }

  clearAttempts(key);
  purgeSessions();

  const token = randomToken(32);
  const csrf = randomToken(32);
  const expiresAt = Date.now() + SESSION_MS;
  createSession(sha256(token), csrf, user.id, expiresAt);
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(req), maxAge: SESSION_MS });
  audit("login_ok", addressKey);

  res.json({ ok: true, csrf, expiresAt });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  deleteSession(req.adminSession.token_hash);
  res.clearCookie(COOKIE_NAME, cookieOptions(req));
  audit("logout", ipKey(req));
  res.json({ ok: true });
});

app.get("/api/admin/config", requireSession, (req, res) => {
  res.json({ ok: true, config: readConfig(), version: configVersion() });
});

app.put("/api/admin/config", requireAdmin, (req, res) => {
  const parsed = validateConfig(req.body);
  if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });

  const version = saveConfig(parsed.value);
  audit("config_update", ipKey(req));
  res.json({ ok: true, config: readConfig(), version });
});

app.get("/config.js", (req, res) => {
  const data = { ...readConfig(), version: configVersion() };
  const source =
    "// Configuración de Adictos al Flow (servidor). Generado automáticamente.\n" +
    "window.STORE_SERVER = true;\n" +
    "window.STORE_CONFIG = " +
    JSON.stringify(data, null, 2) +
    ";\n";
  res.type("application/javascript").setHeader("Cache-Control", "no-store").send(source);
});

app.use(
  express.static(SITE_DIR, {
    index: "index.html",
    etag: true,
    maxAge: 0,
    setHeaders(res, filePath) {
      if (/[\\/]assets[\\/]/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }
  res.status(404).type("text/plain").send("No encontrado");
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error && error.type === "entity.too.large") {
    return res.status(413).json({ ok: false, error: "too_large" });
  }
  if (error && error.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }
  console.error("[error]", error && error.message);
  res.status(500).json({ ok: false, error: "server_error" });
});

const server = app.listen(PORT, HOST, () => {
  console.log("Adictos al Flow listo en http://localhost:" + PORT);
  console.log("Sitio servido desde: " + SITE_DIR);
  if (adminCount() === 0) {
    console.warn("No hay administrador todavía. Ejecuta: npm run seed");
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
