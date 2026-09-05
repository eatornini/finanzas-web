# Fase 4 — PWA, Storage y OCR — Implementation Plan

**Goal:** Instalar la web como PWA (manifest + service worker), permitir
adjuntar la foto de un comprobante a un movimiento (Supabase Storage), y
prellenar el formulario con OCR en el navegador (Tesseract.js) portando el
parser Kotlin de la APK a JS.

**Spec:** `docs/superpowers/specs/2026-09-04-fase-4-pwa-storage-ocr-design.md`

## Global Constraints

Mismas de fases anteriores (sin build step, español en UI/comentarios/
commits, CLP entero, 2 espacios/comillas dobles/punto y coma), más:
- Los binarios de `assets/ocr/` se commitean tal cual se descargan (no se
  regeneran en cada build; documentar origen/versión en
  `assets/ocr/README.md`).
- El service worker y el manifest son la única excepción a "todo se sirve
  tal cual" — se cachea contenido, pero no cambia cómo se sirve hoy
  (GitHub Pages sigue siendo estático).
- Commits terminan con `Claude-Session: https://claude.ai/code/session_013jenY5tuqjSMRY5MJ5BhJc`.

## File Structure

**Nuevos:**
- `manifest.webmanifest`, `assets/icons/icono.svg`, `sw.js`
- `supabase/migrations/004-storage-comprobantes.sql`, `src/data/storage.js`
- `assets/ocr/*` (vendoreo, binario) + `assets/ocr/README.md`
- `src/ocr/tesseractWorker.js`, `src/ocr/construirBloques.js`,
  `src/ocr/documentTypeDetector.js`, `src/ocr/transferenciaParser.js`,
  `src/ocr/purchaseExtractor.js`, `src/ocr/ocrManager.js`
- `tests/ocr/documentTypeDetector.test.js`, `tests/ocr/transferenciaParser.test.js`,
  `tests/ocr/purchaseExtractor.test.js`, `tests/ocr/construirBloques.test.js`

**Modificados:**
- `index.html`, `src/main.js`
- `supabase/schema.sql`
- `src/ui/movimientoForm.js`, `src/ui/movimientosView.js`, `src/ui/iconos.js`,
  `app.css`

---

## Task 1: PWA (4a)

**Files:** Create `manifest.webmanifest`, `assets/icons/icono.svg`, `sw.js`.
Modify `index.html`, `src/main.js`.

- [ ] **Step 1: Ícono SVG**

Create `assets/icons/icono.svg`: cuadrado 512×512 con `rx` grande (esquinas
redondeadas), `fill="#2563eb"`, y un "$" blanco centrado (`<text>` o un
`<path>` simple), con margen ~10% por lado para uso "maskable".

- [ ] **Step 2: Manifest**

Create `manifest.webmanifest` con el contenido de la Sección 4a del spec.

- [ ] **Step 3: Service worker**

Create `sw.js`:

```js
const CACHE_NAME = "finanzas-v1";
const PRECACHE = [
  "./",
  "index.html",
  "app.css",
  "manifest.webmanifest",
  "assets/icons/icono.svg",
  "src/main.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        })
    )
  );
});
```

- [ ] **Step 4: `index.html` y `main.js`**

En `index.html`, dentro de `<head>` (después de `<link rel="stylesheet"
href="app.css" />`):

```html
<link rel="manifest" href="manifest.webmanifest" />
<link rel="icon" href="assets/icons/icono.svg" type="image/svg+xml" />
<meta name="theme-color" content="#2563eb" />
```

En `src/main.js`, después de los listeners de error existentes:

```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
```

- [ ] **Step 5: Verificación manual**

No automatizable. Con `npx serve .` y HTTPS real (GitHub Pages, un service
worker no registra en `http://localhost` salvo que el navegador lo trate
como origen seguro — Chrome sí trata `localhost` como seguro, así que
alcanza con local): DevTools → Application → Manifest (sin errores) y
Service Workers (activado); "Instalar app" disponible; con la app
instalada, cortar red → sigue abriendo.

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest assets/icons/icono.svg sw.js index.html src/main.js
git commit -m "feat(pwa): manifest, ícono, service worker con cache-first para el shell"
```

---

## Task 2: Imágenes en Supabase Storage (4b)

**Files:** Create `supabase/migrations/004-storage-comprobantes.sql`,
`src/data/storage.js`. Modify `supabase/schema.sql`.

- [ ] **Step 1: Migración**

Create `supabase/migrations/004-storage-comprobantes.sql` con el contenido
de la Sección 4b del spec (bucket `comprobantes` + 4 políticas por carpeta
de usuario).

- [ ] **Step 2: `schema.sql`**

Añadir el mismo bloque al final de `supabase/schema.sql`.

- [ ] **Step 3: `data/storage.js`**

Create `src/data/storage.js` con `subirComprobante`, `urlComprobante`,
`eliminarComprobante` (contenido de la Sección 4b del spec).

- [ ] **Step 4: Verificación**

El usuario corre la migración en el SQL Editor de Supabase. Marcar hecho
solo cuando confirme. Verificación manual (además, con Task 5 completo):
subir una imagen desde la UI y confirmar en el dashboard de Supabase
(Storage → comprobantes) que aparece bajo `{user_id}/...`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/004-storage-comprobantes.sql supabase/schema.sql src/data/storage.js
git commit -m "feat(db,data): bucket de Storage para comprobantes con RLS por usuario"
```

---

## Task 3: Vendoreo de Tesseract.js

**Files:** Create `assets/ocr/*` (binario) + `assets/ocr/README.md`.

- [ ] **Step 1: Descargar y commitear los archivos**

Descargar (con `curl`, documentado en el README para poder regenerarlos):
- De `tesseract.js@7.0.0` (tarball de npm, carpeta `dist/`):
  `tesseract.esm.min.js`, `worker.min.js`.
- De `tesseract.js-core@6.1.2` (tarball de npm): `tesseract-core-simd-lstm.wasm.js`,
  `tesseract-core-simd-lstm.wasm` (deben quedar en el mismo directorio: el
  `.js` hace `fetch` del `.wasm` por ruta relativa).
- De `@tesseract.js-data/spa@1.0.0` (tarball de npm), específicamente
  `4.0.0_best_int/spa.traineddata.gz` (no la carpeta `4.0.0/`, que es 4×
  más pesada y de menor calidad).

Colocar todo en `assets/ocr/` con esos mismos nombres de archivo (el
`langPath` se arma como `directorio + código + ".traineddata.gz"`, así que
`spa.traineddata.gz` tiene que llamarse exactamente así).

- [ ] **Step 2: `assets/ocr/README.md`**

Documentar: qué es cada archivo, de qué paquete/versión salió, por qué se
eligió la variante SIMD+LSTM única y el `best_int` de español, y los
comandos `curl`/`tar` para volver a descargarlos si hace falta actualizar
la versión.

- [ ] **Step 3: Commit**

```bash
git add assets/ocr/
git commit -m "feat(ocr): vendorea Tesseract.js (motor SIMD+LSTM + datos de español)"
```

---

## Task 4: Parser de OCR — lógica pura

**Files:** Create `src/ocr/documentTypeDetector.js`,
`src/ocr/transferenciaParser.js`, `src/ocr/purchaseExtractor.js`,
`src/ocr/construirBloques.js`, `src/ocr/ocrManager.js`, y sus tests.

- [ ] **Step 1: `documentTypeDetector.js` con test**

Create `tests/ocr/documentTypeDetector.test.js`:

```js
import { describe, it, expect } from "vitest";
import { detectarTipoDocumento } from "../../src/ocr/documentTypeDetector.js";

describe("detectarTipoDocumento", () => {
  it("detecta transferencia con suficientes keywords", () => {
    const texto = "Transferencia exitosa | Destinatario: Juan Pérez | Monto transferido $15.000 | Fecha y hora: 04/09/2026 14:30";
    expect(detectarTipoDocumento(texto)).toBe("transferencia");
  });

  it("detecta compra cuando no hay suficientes keywords de transferencia", () => {
    const texto = "Supermercado Central | Boleta electrónica | Total $8.500 | Gracias por tu compra";
    expect(detectarTipoDocumento(texto)).toBe("compra");
  });

  it("una sola keyword de transferencia no alcanza", () => {
    const texto = "Pago exitoso | Total $5.000 | Boleta";
    expect(detectarTipoDocumento(texto)).toBe("compra");
  });
});
```

Run: `npm test -- documentTypeDetector` → FAIL. Create
`src/ocr/documentTypeDetector.js` con el contenido de la Sección 4c del
spec. Run de nuevo → PASS.

- [ ] **Step 2: `construirBloques.js` con test**

Create `tests/ocr/construirBloques.test.js` con un `tesseractBlocks` de
ejemplo (1 block, 2 paragraphs, cada uno con 1-2 lines, `bbox` inventados)
verificando que `bloques` tiene un `BlockInfo` por párrafo y `lineas` sale
ordenado por `top`. Create `src/ocr/construirBloques.js` con el contenido
del spec. `npm test -- construirBloques` → PASS.

- [ ] **Step 3: `transferenciaParser.js` con tests**

Create `tests/ocr/transferenciaParser.test.js` con fixtures `LineInfo[]`
sintéticas (anonimizadas) cubriendo: comprobante con etiquetas claras
("Para:", "Monto:", "Fecha:", "Hora:") → extrae los 4 campos correctos;
comprobante sin destinatario etiquetado pero con línea de nombre suelta →
cae al fallback; texto sin suficientes keywords de transferencia →
`null`. Create `src/ocr/transferenciaParser.js`, puerto de
`TransferenciaOcrParser.kt` (ver Sección 4c del spec para el detalle de
qué portar). Ajustar hasta que los tests pasen.

- [ ] **Step 4: `purchaseExtractor.js` con tests**

Create `tests/ocr/purchaseExtractor.test.js` con fixtures de boleta:
nombre de comercio en un bloque arriba, bloque de "Total $8.500", línea "4
de septiembre a las 19:05" → comercio/monto/fecha correctos; boleta sin
fecha reconocible → `fecha: null` pero comercio/monto igual extraídos;
boleta con ruido (operador telefónico, "LTE", "Wifi") → esas líneas no se
eligen como comercio. Create `src/ocr/purchaseExtractor.js`, puerto de
`PurchaseExtractor.kt`.

- [ ] **Step 5: `ocrManager.js` con test**

Create `tests/ocr/ocrManager.test.js`: con un `{ lineas, bloques }`
de transferencia → `tipo: "transferencia"` y campos de
`transferenciaParser`; con uno de compra → `tipo: "compra"` y campos de
`purchaseExtractor`. Create `src/ocr/ocrManager.js` con el contenido del
spec.

- [ ] **Step 6: Todos los tests pasan**

Run: `npm test` → PASS (todos, incluidos los de fases anteriores).

- [ ] **Step 7: Commit**

```bash
git add src/ocr/ tests/ocr/
git commit -m "feat(ocr): port a JS del parser de comprobantes (clasificador, transferencia, compra)"
```

---

## Task 5: Motor Tesseract en el navegador

**Files:** Create `src/ocr/tesseractWorker.js`.

- [ ] **Step 1: Implementación**

Create `src/ocr/tesseractWorker.js` con el contenido de la Sección 4c del
spec (`reconocerImagen(file)`, worker singleton con `workerPath`/
`corePath`/`langPath` apuntando a `assets/ocr/`).

- [ ] **Step 2: Verificación manual**

No hay test automatizado (requiere WASM + Worker reales, no corren en
Vitest/Node tal como está configurado el proyecto). Con `npx serve .`, en
la consola del navegador:
`import("/src/ocr/tesseractWorker.js").then(m => m.reconocerImagen(/* File de una imagen de prueba */)).then(console.log)`
→ array de blocks con texto reconocible, sin error. Verificar que
`assets/ocr/*` se sirven con `Content-Type` correcto (los `.wasm` a veces
necesitan `application/wasm`; si el server local los sirve mal, probar
igual en GitHub Pages antes de descartarlo).

- [ ] **Step 3: Commit**

```bash
git add src/ocr/tesseractWorker.js
git commit -m "feat(ocr): worker de Tesseract.js autohospedado (spa, motor SIMD+LSTM)"
```

---

## Task 6: Integración en el formulario de movimiento

**Files:** Modify `src/ui/movimientoForm.js`, `src/ui/movimientosView.js`,
`src/ui/iconos.js`, `app.css`.

- [ ] **Step 1: Ícono de cámara**

Añadir a `src/ui/iconos.js`: `export const camaraIcono = () => svg([...])`
(ícono simple de cámara, mismo estilo Lucide-like que el resto).

- [ ] **Step 2: `movimientoForm.js` — sección Comprobante**

Extender `abrirMovimientoForm` según la Sección 4c del spec: nueva firma
(`valoresIniciales`, `archivoInicial`), sección de miniatura + botones
Cargar/Reemplazar/Quitar, disparo de OCR al elegir un archivo nuevo
(rellena solo campos vacíos), extensión de `huboCambios()`, subida/borrado
de imagen en el submit (`subirComprobante`/`eliminarComprobante` de
`data/storage.js`, `urlComprobante` para la miniatura en edición).

- [ ] **Step 3: `movimientosView.js` — botón "Cargar comprobante"**

Botón junto a "+ Agregar movimiento" con `<input type="file" hidden
accept="image/*" capture="environment">`. Al elegir archivo: estado
"Leyendo comprobante…", `reconocerImagen` → `construirBloques` →
`analizarComprobante`, luego `abrirMovimientoForm({ modo, categorias,
valoresIniciales, archivoInicial: file, onGuardado: recargar })` (si el
OCR falla, igual abre el form con `valoresIniciales: null` y el archivo
adjunto).

- [ ] **Step 4: Estilos**

Añadir a `app.css`: sección de miniatura del comprobante en el form
(`.comprobante-preview`, `.comprobante-acciones`), estado "Leyendo
comprobante…" junto al botón de movimientosView.

- [ ] **Step 5: Verificación manual**

Con la migración de Task 2 aplicada y `npx serve .`: elegir una foto real
de boleta/transferencia → el form se abre con campos plausibles y
miniatura; guardar, volver a editar → la imagen sigue visible; reemplazar
la imagen; quitarla; probar con una foto sin datos reconocibles → el form
igual se abre, vacío, sin romper. Confirmar en Supabase Storage que las
imágenes viejas se borran al reemplazar/quitar.

- [ ] **Step 6: Commit**

```bash
git add src/ui/movimientoForm.js src/ui/movimientosView.js src/ui/iconos.js app.css
git commit -m "feat(ui): cargar comprobante con OCR — prellenar el formulario de movimiento"
```

---

## Task 7: Cierre de rama

- [ ] Actualizar el checklist de gap en
  `docs/superpowers/specs/2026-09-04-roadmap-fases-2-5.md`: marcar
  "Adjuntar imagen" y "OCR de comprobante" como Fase 4 ✔, "Instalable /
  offline (PWA)" como Fase 4 ✔, y anotar Web Share Target como pendiente
  sin fase asignada (se agregó como ítem nuevo, no estaba en el checklist
  original).
- [ ] Merge de `feat/fase-4-pwa-storage-ocr` a `main` (merge commit, sin
  squash) y push.
