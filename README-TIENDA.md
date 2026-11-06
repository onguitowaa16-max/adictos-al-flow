# ADICTOS AL FLOW — tienda online

Tienda de streetwear con 265 productos y 296 fotos, más un panel de administrador
con seguridad real (servidor Express + SQLite).

## Qué hay en el proyecto

| Carpeta / archivo | Para qué sirve |
| --- | --- |
| `adictos-al-flow/` | La tienda: HTML, CSS, JS, fotos y catálogo. |
| `tienda-server/` | Servidor con login seguro, sesiones, CSRF, anti-inyección SQL y configuración en SQLite. |
| `INICIAR-TIENDA.bat` | Arranca la tienda con el servidor en tu PC. |
| `SUBIR-A-GITHUB.bat` | Sube el proyecto a tu cuenta de GitHub. |
| `render.yaml` | Configuración para publicar el servidor completo en Render. |
| `.github/workflows/pages.yml` | Publica la tienda estática en GitHub Pages. |

La cuenta de administrador se configura en `tienda-server/.env`.
Ese archivo **no se sube a GitHub**, igual que la base de datos (`tienda-server/data/`).

---

## 1. Probarlo en tu PC

1. Doble clic en **INICIAR-TIENDA.bat**.
2. Se abre `http://localhost:3000`.
3. El panel está en el botón **Admin** al pie de la página.

La primera vez, el lanzador instala lo necesario y crea la cuenta de administrador
con los datos de `tienda-server/.env`.

Para detenerlo: cierra la ventana negra o pulsa `Ctrl+C`.

### Cambiar la contraseña del administrador

1. Abre `tienda-server/.env` con el Bloc de notas.
2. Cambia `ADMIN_PASSWORD` (mínimo 10 caracteres).
3. Guarda y vuelve a abrir **INICIAR-TIENDA.bat**.

En Render: cambia la variable `ADMIN_PASSWORD` en el panel del servicio y ejecuta
en la Shell `cd tienda-server && npm run seed`. También puedes cambiarla antes del
primer despliegue.

---

## 2. Publicarlo en GitHub (gratis, solo la tienda)

1. Doble clic en **SUBIR-A-GITHUB.bat**.
2. Escribe tu usuario de GitHub y crea el repositorio como **Public**.
3. En GitHub: **Settings → Pages → Source: GitHub Actions**.
4. En 1–2 minutos la tienda queda en:
   `https://TU-USUARIO.github.io/adictos-al-flow/`

**Importante:** GitHub Pages solo sirve archivos. Allí el panel funciona en modo
local (la contraseña se comprueba en el navegador y los cambios se guardan en ese
dispositivo). No hay servidor, así que **no** ofrece la seguridad real de la
sección 3. Úsalo para mostrar el catálogo, no para administrar la tienda.

---

## 3. Hosting completo con seguridad real (Render)

Aquí sí corre el servidor: login validado en el servidor, configuración compartida
para todos los clientes y protección anti-inyección SQL.

1. Sube el proyecto a GitHub (sección 2).
2. Entra en [render.com](https://render.com) y crea una cuenta con GitHub.
3. **New → Blueprint** y elige tu repositorio.
4. Render lee `render.yaml` y pide dos variables:
   - `ADMIN_EMAIL`: tu correo de administrador.
   - `ADMIN_PASSWORD`: una contraseña larga (mínimo 10 caracteres).
5. Pulsa **Deploy**. La tienda queda en:
   `https://adictos-al-flow.onrender.com`

`render.yaml` está preparado con **plan Starter + disco persistente** para que la
configuración (WhatsApp, tasas, franja) no se borre al reiniciar. Tiene un costo
mensual pequeño; consulta el precio actual en Render.

Si quieres probar **gratis**: cambia `plan: starter` por `plan: free`, borra el
bloque `disk:` y la variable `STORE_DB`. Ten en cuenta que en el plan gratuito el
servidor se duerme y la base de datos se reinicia en cada despliegue.

### Dominio propio

1. Compra el dominio en Namecheap, Cloudflare, GoDaddy o similar.
2. En Render: **Settings → Custom Domains → Add Custom Domain**.
3. Render te muestra los registros DNS exactos (CNAME para `www` y A para el
   dominio raíz). Cópialos en el panel de tu proveedor de dominio.
4. Espera la propagación (puede tardar de minutos a unas horas). Render activa el
   HTTPS automáticamente.

Si te quedas en GitHub Pages, el dominio se configura en
**Settings → Pages → Custom domain** y luego se crean los registros DNS que
GitHub indique.

---

## 4. Qué seguridad incluye el servidor

- Contraseñas con **scrypt** (nunca se guardan en texto plano).
- Sesión en cookie **httpOnly**, **SameSite=Strict** y **Secure** en HTTPS.
- Token **CSRF** para guardar configuración y cerrar sesión.
- **Límite de intentos** de login: 5 fallos por cuenta / 15 minutos.
- **Consultas SQL parametrizadas** en todo el servidor (anti-inyección).
- Validación estricta de todos los datos del panel.
- Cabeceras de seguridad y **CSP**; sin `X-Powered-By`.
- Base de datos y `.env` fuera de la carpeta pública.
- La configuración se genera en `/config.js` desde la base de datos.

Lo que no incluye: recuperación de contraseña por correo y cuentas de clientes en
el servidor. Las cuentas de clientes (favoritos y pedidos) siguen guardándose en
el navegador de cada persona, como hasta ahora.

---

## 5. Fotos del catálogo

Las fotos y los nombres de marca provienen de un catálogo de referencia de
terceros. Para vender de forma comercial necesitas permiso o derechos de uso sobre
esas imágenes. Sustituir una foto es tan simple como reemplazar el archivo dentro
de `adictos-al-flow/assets/catalog/` manteniendo el mismo nombre.
