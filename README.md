# Finanzas Web

App web de finanzas personales. Frontend estático + Supabase (Postgres + Auth).

## Configuración inicial (una sola vez)

### 1. Supabase
1. Crear una cuenta en https://supabase.com y un proyecto nuevo.
   Guardar la contraseña de la base de datos (no se usa en el frontend).
2. SQL Editor -> pegar y ejecutar `supabase/schema.sql` (ya incluye todo el
   esquema actual; en un proyecto nuevo no hace falta correr las migraciones).
3. Authentication -> Users -> Add user: tu email y contraseña, marcar como confirmado.
4. Authentication -> Sign In / Providers: desactivar "Allow new users to sign up".
5. Authentication -> URL Configuration: Site URL y Redirect URLs =
   la URL de GitHub Pages (ej. https://TU-USUARIO.github.io/finanzas-web/).
6. Project Settings -> API: copiar "Project URL" y la clave "anon" / "publishable"
   a `config.js`.
   NUNCA copiar la clave `service_role` al repo.

### 2. GitHub Pages
1. Crear un repositorio PUBLICO (ej. `finanzas-web`) y subir este proyecto.
2. Settings -> Pages -> Source: "Deploy from a branch", rama `main`, carpeta `/ (root)`.
3. Abrir la URL publicada, iniciar sesión y probar.

## Migraciones de base de datos

`supabase/schema.sql` es el esquema completo actual (para proyectos nuevos).
`supabase/migrations/` guarda los cambios incrementales que hay que aplicar a
un proyecto que ya está en uso, en orden:

- `001-modo-estimado.sql` — agrega `modo` y `pagado` a `movimientos`.

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

- Registro de ingresos/gastos y categorías, con filtro por período (semana/mes/año).
- Resumen con totales del período.
- Modo **Real** / **Estimado** (interruptor global). En modo estimado cada
  movimiento tiene estado pagado/pendiente y el resumen muestra el desglose.

## Fuera de alcance por ahora

Presupuestos, gráficos, autocompletado de comercios, movimientos recurrentes,
OCR, soporte offline, importador desde la app Android, multiusuario.
