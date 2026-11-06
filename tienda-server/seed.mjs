import "./env.mjs";

import { adminCount, upsertAdmin } from "./db.mjs";
import { hashPassword } from "./crypto.mjs";

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";

if (!email || !password) {
  console.error("Faltan ADMIN_EMAIL y ADMIN_PASSWORD en tienda-server/.env");
  console.error("Copia .env.example a .env y escribe tus datos.");
  process.exit(1);
}

if (email.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("El email del administrador no es válido.");
  process.exit(1);
}

if (password.length < 10 || password.length > 200) {
  console.error("La contraseña debe tener entre 10 y 200 caracteres.");
  process.exit(1);
}

const existed = adminCount() > 0;
upsertAdmin(email, hashPassword(password));
console.log(existed ? "Contraseña de administrador actualizada." : "Administrador creado correctamente.");
