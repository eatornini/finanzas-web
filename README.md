# Finanzas Web

App web de finanzas personales. Frontend estático + Supabase (Postgres + Auth).

## Configuración inicial (una sola vez)

### 1. Supabase
1. Crear una cuenta en https://supabase.com y un proyecto nuevo.
   Guardar la contraseña de la base de datos (no se usa en el frontend).
2. SQL Editor -> pegar y ejecutar `supabase/schema.sql` (ya incluye todo el
   esquema actual; en un proyecto nuevo no hace falta correr las migraciones).
3. Authentication -> Sign In / Providers -> Email:
   - **Activar** "Allow new users to sign up" (el registro desde la app queda
     detrás de la aprobación manual de un admin, ver más abajo).
   - **Desactivar** "Confirm email" (la barrera de acceso es la aprobación del
     admin; así el registro no depende del email limitado de Supabase).
4. Authentication -> URL Configuration: Site URL y Redirect URLs =
   la URL de GitHub Pages (ej. https://TU-USUARIO.github.io/finanzas-web/).
   El enlace de "recuperar contraseña" vuelve a esa URL con `#recuperar`.
5. Project Settings -> API: copiar "Project URL" y la clave "anon" / "publishable"
   a `config.js`.
   NUNCA copiar la clave `service_role` al repo (la Edge Function la toma del
   entorno de Supabase, no del repo).
6. **Edge Function del panel de admin**: desplegar `supabase/functions/admin`
   (`supabase functions deploy admin` con el CLI, o pegar `index.ts` en
   Edge Functions -> New function -> `admin` desde el panel). Cubre reset /
   fijar contraseña / eliminar cuentas; el resto de la administración va por
   RPC y no necesita nada extra. La función valida el JWT y el rol admin por
   su cuenta; si el navegador reporta errores de CORS al usarla, desactivar
   "Verify JWT" en la config de la función.
7. **Primer admin**: registrarte en la app con tu email y luego, en el SQL
   Editor, correr una vez:
   `update perfiles set rol = 'admin', estado = 'activo' where email = 'TU-EMAIL';`

### 2. GitHub Pages
1. Crear un repositorio PUBLICO (ej. `finanzas-web`) y subir este proyecto.
2. Settings -> Pages -> Source: "Deploy from a branch", rama `main`, carpeta `/ (root)`.
3. Abrir la URL publicada, iniciar sesión y probar.

## Migraciones de base de datos

`supabase/schema.sql` es el esquema completo actual (para proyectos nuevos).
`supabase/migrations/` guarda los cambios incrementales que hay que aplicar a
un proyecto que ya está en uso, en orden:

- `001-modo-estimado.sql` — agrega `modo` y `pagado` a `movimientos`.
- `002-paridad-app.sql` — timestamps, categorías (tipo/modo/icono), tracking
  de inactivos, funciones RPC de agregación.
- `003-copiar-mes-estimado.sql` — funciones de copiar/borrar mes y
  activar-desactivar todos los movimientos del período.
- `004-storage-comprobantes.sql` — bucket de Supabase Storage `comprobantes`
  (con RLS por usuario) para las imágenes adjuntas a los movimientos.
- `005-cuentas-admin.sql` — tabla `perfiles` (estado + rol), alta automática
  por trigger al registrarse, RLS que exige cuenta aprobada para ver/escribir
  datos, y RPC de administración (listar, aprobar, roles, estadísticas). Los
  usuarios que ya existían quedan como `activo`. Después: correr el
  `update perfiles ...` del primer admin.

Cada migración se corre una sola vez en el SQL Editor de Supabase.

## Desarrollo local

- Servir con un servidor estático (los módulos ES no cargan desde `file://`):
  `npx serve .`  ó  `python -m http.server`
- Tests de lógica pura: `npm test`

## Límites del plan gratuito

- Supabase Free: 500 MB de base, 5 GB de tráfico/mes. El proyecto se pausa tras
  7 días sin actividad (se reactiva al usarlo).
- GitHub Pages Free: 1 GB de sitio, 100 GB/mes de ancho de banda, repo público.
- Costo mensual: 0 dentro de esos límites.

## Funcionalidades

- **Cuentas**: registro desde la app con aprobación manual, recuperación de
  contraseña por email, y **panel de administración** (solo cuentas admin)
  para aprobar / rechazar / deshabilitar registros, resetear o fijar
  contraseñas, cambiar roles, eliminar cuentas y ver estadísticas.
- Registro de ingresos/gastos con categorías (icono Material Symbols o
  emoji), filtro por período (semana/mes/año) y buscador global.
- Resumen con totales del período, drill-down por categoría y torta interactiva.
- Vista Reportes: tendencias por período y comparativa entre períodos.
- Modo **Real** / **Estimado** (interruptor global). En modo estimado cada
  movimiento tiene estado pagado/pendiente; herramientas de mes para copiar,
  borrar o activar/desactivar todos los movimientos del período visible.
- Movimientos recurrentes (frecuencia configurable) y autocompletado de
  comercio por uso previo.
- Adjuntar foto del comprobante (Supabase Storage) con **lectura automática
  por OCR** (Tesseract.js, offline, autohospedado) que prellena nombre,
  monto y fecha del movimiento.
- **PWA instalable**: manifest + service worker con cache-first para el app
  shell, funciona offline una vez instalada.

## Fuera de alcance por ahora

Presupuestos, exportar backup a JSON, SMTP propio (el reset de contraseña usa
el email por defecto de Supabase, limitado a ~2-4 correos/hora — configurar
un SMTP custom en Authentication -> Emails para producción).
