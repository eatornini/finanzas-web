# Fase 4 — PWA, imágenes en Storage y OCR de comprobantes (diseño)

Fecha: 2026-09-04
Estado: aprobado (diseño). Rama: `feat/fase-4-pwa-storage-ocr` (una sola
rama para 4a+4b+4c, decisión explícita para esta fase).
Roadmap: `docs/superpowers/specs/2026-09-04-roadmap-fases-2-5.md` (Fase 4).

## Contexto y hallazgos previos a diseñar

- **`TransferExtractor.kt` y `TransferenciaOcrParser.kt` son casi
  idénticos** (mismo algoritmo, letra por letra). El roadmap los describía
  como variantes distintas ("heurísticas geométricas" vs. no), pero eso no
  existe en el código real. Se porta **un solo módulo** de transferencias.
- **`OcrHelper.kt`** no se porta como módulo propio: es el pegamento
  específico de ML Kit (bitmaps de Android, `Text.textBlocks`). Su única
  utilidad es de referencia para el paso de "agrupar líneas en bloques",
  que en la versión web lo resuelve directamente la estructura de datos de
  Tesseract.js (ver Sección 3).
- **`abrirMovimientoForm` hoy no tiene `valoresIniciales` ni campo de
  imagen** (se verificó leyendo `src/ui/movimientoForm.js` actual). Fase 4
  lo extiende, no lo "conecta" a algo que ya existía.
- **Decisión (usuario):** Web Share Target (compartir una imagen desde otra
  app directo a Finanzas) queda **fuera de esta fase** — es la pieza de
  mayor riesgo técnico (el service worker debe interceptar un POST
  multipart y pasarle el archivo a la página) y no se puede probar sin
  navegador. El diseño de todos modos deja el punto de entrada (Sección 4,
  flujo de captura) listo para que Share Target solo tenga que invocarlo
  con un `File` obtenido del `fetch event` en vez de un `<input>`.
- **Decisión (usuario):** el motor de Tesseract.js se autohospeda en **una
  sola variante** (SIMD+LSTM, la más moderna), no las 4 que soporta la
  librería para compatibilidad amplia — este es el único dispositivo/
  navegador que usa el usuario.
- **Decisión (usuario):** el ícono de la PWA se genera como **SVG simple**
  (mismo estilo que la marca actual: "$" sobre fondo `--acento`), porque
  este entorno no tiene forma de generar PNG (sin ImageMagick/Python/sharp
  disponibles).

---

## Fase 4a — PWA

### `manifest.webmanifest` (nuevo, raíz del repo)

```json
{
  "name": "Finanzas",
  "short_name": "Finanzas",
  "description": "Control de ingresos y gastos, real y estimado.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#f7f8fa",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "assets/icons/icono.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}
```

Colores tomados de `app.css` (`--bg-pagina: #f7f8fa`, `--acento: #2563eb`).

### `assets/icons/icono.svg` (nuevo)

Cuadrado redondeado color `--acento` con un "$" blanco centrado (mismo
tratamiento que `.marca-logo` del sidebar), con margen suficiente (~10% por
lado) para que funcione como ícono "maskable" (Android recorta a un
círculo/squircle sin cortar el símbolo).

### `sw.js` (nuevo, raíz)

Estrategia sin build (no hay lista de bundles que precachear con hash):

- **Precache explícito** en `install` de la cáscara mínima: `./`,
  `index.html`, `app.css`, `manifest.webmanifest`, `assets/icons/icono.svg`,
  `src/main.js`.
- **`fetch`**: solo intercepta `GET` del mismo origen.
  - Cross-origin (Supabase) o método distinto de `GET` → no se llama
    `respondWith`, pasa directo a la red.
  - Navegación (`request.mode === "navigate"`, o sea `index.html`):
    **network-first** con fallback a caché (para que las actualizaciones se
    vean apenas hay conexión, pero siga arrancando offline).
  - Resto de assets del mismo origen (`.js`, `.css`, `.svg`, `.woff2`,
    `.wasm`, `.gz`, íconos): **cache-first**, y si no está en caché se pide
    a la red y se guarda la respuesta para la próxima vez (así los módulos
    de `src/**` se cachean solos a medida que se navega, sin listarlos a
    mano).
- **`activate`**: borra cachés con nombre distinto a `CACHE_NAME` (versión
  fija tipo `finanzas-v1`; subirla a mano en cada release fuerza refresco).

### `index.html`

Agregar en `<head>`:

```html
<link rel="manifest" href="manifest.webmanifest" />
<link rel="icon" href="assets/icons/icono.svg" type="image/svg+xml" />
<meta name="theme-color" content="#2563eb" />
```

### `src/main.js`

```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* PWA es progresiva: si falla el registro, la app igual funciona online */
    });
  });
}
```

**Verificación manual (no automatizable):** Chrome Android → "Instalar
app"; cerrar datos/desconectar red → la app abre y muestra el último
estado cacheado (lectura); Lighthouse/DevTools → Application → Manifest y
Service Worker sin errores.

---

## Fase 4b — Imágenes en Supabase Storage

### `supabase/migrations/004-storage-comprobantes.sql` (nuevo)

Bucket privado + políticas por carpeta de usuario (`{user_id}/...`), mismo
patrón que las tablas (`auth.uid()`):

```sql
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

create policy "comprobantes_select_propio" on storage.objects for select
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comprobantes_insert_propio" on storage.objects for insert
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comprobantes_update_propio" on storage.objects for update
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comprobantes_delete_propio" on storage.objects for delete
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
```

Reflejar en `supabase/schema.sql` al final (igual que las funciones RPC).

### `src/data/storage.js` (nuevo)

```js
import { supabase } from "../supabaseClient.js";

const EXT_POR_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function subirComprobante(userId, file) {
  const ext = EXT_POR_MIME[file.type] || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("comprobantes").upload(path, file);
  if (error) throw error;
  return path;
}

export async function urlComprobante(path) {
  const { data, error } = await supabase.storage
    .from("comprobantes")
    .createSignedUrl(path, 60 * 60); // 1 hora, alcanza para ver/editar
  if (error) throw error;
  return data.signedUrl;
}

export async function eliminarComprobante(path) {
  if (!path) return;
  await supabase.storage.from("comprobantes").remove([path]); // best-effort
}
```

`movimientos.imagen` ya existe (columna agregada en la migración 002 de
Fase 0+1, sin uso hasta ahora) — guarda el `path`, no una URL (las firmadas
expiran).

---

## Fase 4c — OCR de comprobantes en el navegador

### Vendoreo de Tesseract.js (una sola variante, autohospedado)

`assets/ocr/` (binario, se commitea; documentado en
`assets/ocr/README.md` con origen/versión/licencia y cómo regenerar):

| Archivo | Origen | Peso aprox. |
|---|---|---|
| `tesseract.esm.min.js` | `tesseract.js@7.0.0` (paquete npm, `dist/`) | 63 KB |
| `worker.min.js` | `tesseract.js@7.0.0` (`dist/`) | 111 KB |
| `tesseract-core-simd-lstm.wasm.js` | `tesseract.js-core@6.1.2` | 3.95 MB |
| `tesseract-core-simd-lstm.wasm` | `tesseract.js-core@6.1.2` (binario que carga el `.js` de arriba, debe quedar al lado) | 2.87 MB |
| `spa.traineddata.gz` | `@tesseract.js-data/spa@1.0.0`, variante **`4.0.0_best_int`** (no la default `4.0.0`: mejor precisión y **más liviana**, 2.1 MB vs. 8.4 MB) | 2.1 MB |

Total ≈ 9.1 MB. Todo Apache-2.0 (Tesseract.js y Tesseract). `corePath` se
fija directo al archivo `tesseract-core-simd-lstm.wasm.js` (la librería
"desaconseja" fijar un archivo puntual porque normalmente querés que elija
entre 4 según el dispositivo — acá es intencional: un solo dispositivo, un
solo build).

### `src/ocr/tesseractWorker.js` (nuevo)

```js
import { createWorker } from "../../assets/ocr/tesseract.esm.min.js";

const BASE = new URL("../../assets/ocr/", import.meta.url).href;
let workerPromise = null;

function obtenerWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("spa", 1, {
      workerPath: BASE + "worker.min.js",
      corePath: BASE + "tesseract-core-simd-lstm.wasm.js",
      langPath: BASE,
    });
  }
  return workerPromise;
}

// file: File | Blob de la imagen. Devuelve Tesseract.Block[] (con bbox).
export async function reconocerImagen(file) {
  const worker = await obtenerWorker();
  const { data } = await worker.recognize(file, {}, { blocks: true });
  return data.blocks || [];
}
```

(`worker.recognize` acepta `File` directamente — confirmado en el tipo
`ImageLike` de `tesseract.js@7`.)

### `src/ocr/construirBloques.js` (nuevo — bridge Tesseract → LineInfo/BlockInfo)

Tesseract expone `blocks[].paragraphs[].lines[].bbox{x0,y0,x1,y1}` (3
niveles), mientras que ML Kit (Android) exponía `textBlocks[].lines[]` (2
niveles) — la referencia Kotlin asume ese segundo nivel. La equivalencia
natural es **párrafo de Tesseract ≈ bloque de ML Kit**: cada párrafo pasa a
ser un `BlockInfo`.

```js
// LineInfo: { text, top, bottom, height, left, right }
// BlockInfo: { lines: LineInfo[], top, bottom, left, right }
export function construirBloques(tesseractBlocks) {
  const bloques = [];
  for (const block of tesseractBlocks) {
    for (const parrafo of block.paragraphs) {
      const lineas = parrafo.lines
        .map((l) => ({
          text: l.text.trim(),
          top: l.bbox.y0,
          bottom: l.bbox.y1,
          height: l.bbox.y1 - l.bbox.y0,
          left: l.bbox.x0,
          right: l.bbox.x1,
        }))
        .filter((l) => l.text);
      if (lineas.length) {
        bloques.push({
          lines: lineas,
          top: parrafo.bbox.y0,
          bottom: parrafo.bbox.y1,
          left: parrafo.bbox.x0,
          right: parrafo.bbox.x1,
        });
      }
    }
  }
  const lineas = bloques.flatMap((b) => b.lines).sort((a, b) => a.top - b.top);
  return { lineas, bloques };
}
```

Función pura, testeable con un `tesseractBlocks` de ejemplo hecho a mano.

### `src/ocr/documentTypeDetector.js` (nuevo — port de `DocumentTypeDetector.kt`)

Puerto 1:1: dos listas de keywords (transferencia/compra), cuenta
coincidencias en el texto en minúsculas; `transferencia` si el score de
transferencia es `>= 2` y mayor al de compra; si no, `compra`.

```js
const TRANSFER_KEYWORDS = [
  "transferencia", "operacion exitosa", "operación exitosa", "destinatario",
  "cuenta destino", "cuenta origen", "monto transferido",
  "fecha y hora", "n° de operacion", "n° de operación",
  "comprobante de transferencia", "transferencia exitosa",
  "transferencia realizada", "transferiste",
  "transferencia recibida", "transferencia enviada",
  "pago exitoso", "pago realizado", "pago recibido",
  "beneficiario", "cuenta rut", "cuentanut", "cuenta pro",
  "banco destino", "banco origen", "tipo de cuenta",
];
const PURCHASE_KEYWORDS = [
  "gracias por tu compra", "compra aprobada", "total", "subtotal",
  "comercio", "boleta", "factura", "consumo", "establecimiento",
  "código de autorización", "codigo de autorizacion",
];

export function detectarTipoDocumento(fullText) {
  const lower = fullText.toLowerCase();
  const transferScore = TRANSFER_KEYWORDS.filter((k) => lower.includes(k)).length;
  const purchaseScore = PURCHASE_KEYWORDS.filter((k) => lower.includes(k)).length;
  if (transferScore >= 2 && transferScore > purchaseScore) return "transferencia";
  return "compra";
}
```

### `src/ocr/transferenciaParser.js` (nuevo — port de `TransferenciaOcrParser.kt`)

Puerto 1:1 de: `esTransferencia` (gate interno, `>=2` keywords — queda como
red de seguridad aunque el router ya clasificó antes), `extractComercio`
(busca etiquetas "para/nombre/destinatario/razón social/beneficiario" con
`findLabelValue`, si no cae a la primera línea "razonable"), `extractMonto`
(etiquetas monto/monto transferido/total/transferido → línea con `$` →
cualquier número parseable), `extractFecha` (múltiples estrategias:
etiqueta "fecha y hora"/"fecha"+"hora" combinadas, `dd/mm/yyyy` +
`HH:mm[:ss]` sueltos, hora "global" más cercana). Devuelve
`{ comercio, monto, fecha, detalle }` o `null` si no pasa `esTransferencia`.

`fecha` se devuelve como `Date` (no epoch millis de `Calendar` como en
Kotlin): mismos campos año/mes/día/hora/minuto, construidos con
`new Date(año, mes - 1, día, hora, minuto)` en hora local del dispositivo
(equivalente a `Calendar.getInstance()`, que usa la zona horaria del
dispositivo).

`extractDetalle` en el Kotlin original siempre devuelve `null` (código
muerto) → se omite directamente, `detalle` queda `null`.

### `src/ocr/purchaseExtractor.js` (nuevo — port de `PurchaseExtractor.kt`)

Puerto 1:1: `extractMonto` (regex `CLP $ N`, `$ N`, o etiqueta
Total/Monto/Importe/Valor/Pago, con `limpiarMonto` para formato chileno
`1.234,56` / `1,234.56` / `1234`), `extractFechaHora` (patrón
`"d de MMMM a las HH:mm"` en español con tabla de meses, o `dd/mm/yyyy
[HH:mm]` suelto — año en el segundo caso, o año actual si el patrón no trae
año), `extractComercio` (de los bloques por encima del bloque del monto,
descartando bloques con palabras excluidas — operador, tarjeta, fecha,
días de la semana, etc. — o que sean "monetarios"/"secundarios" por forma;
elige el más cercano al bloque del monto, empatando por altura de línea y
longitud de texto). Devuelve siempre `{ comercio, monto, fecha }` (nunca
`null`, igual que el Kotlin).

### `src/ocr/ocrManager.js` (nuevo — orquestador, no existía en Kotlin como archivo propio)

```js
import { detectarTipoDocumento } from "./documentTypeDetector.js";
import { parsearTransferencia } from "./transferenciaParser.js";
import { parsearCompra } from "./purchaseExtractor.js";

// { lineas, bloques } ya construidos por construirBloques().
// Devuelve { comercio, monto, fecha, detalle, tipo } — tipo: "transferencia" | "compra".
export function analizarComprobante({ lineas, bloques }) {
  const fullText = lineas.map((l) => l.text).join(" | ");
  const tipo = detectarTipoDocumento(fullText);

  if (tipo === "transferencia") {
    const r = parsearTransferencia(lineas);
    if (r) return { ...r, tipo };
  }
  const r = parsearCompra(lineas, bloques);
  return { ...r, detalle: null, tipo: "compra" };
}
```

Si el texto se clasificó como transferencia pero el parser específico
igual devuelve `null` (p. ej. el clasificador amplio de
`documentTypeDetector` coincidió pero el gate interno más estricto de
`transferenciaParser` no), se degrada a `parsearCompra` sobre el mismo
texto en vez de devolver todo vacío — mejor una extracción parcial que
ninguna.

### Tests (`tests/ocr/*.test.js`)

No hay volcados reales de OCR (serían capturas de pantalla de comprobantes
reales, con datos personales). Se arman **fixtures sintéticas**
(`LineInfo[]` escritos a mano imitando la salida de Tesseract para un
comprobante típico chileno, anonimizados desde el vamos) para:

- `documentTypeDetector`: un texto con ≥2 keywords de transferencia → 
  `"transferencia"`; uno de boleta con "total"/"boleta" → `"compra"`.
- `transferenciaParser`: comprobante con etiquetas "Para: Juan Pérez",
  "Monto: $15.000", "Fecha: 04/09/2026", "Hora: 14:30" → extrae los 4
  campos; caso sin suficientes keywords → `null`.
- `purchaseExtractor`: boleta con nombre de comercio arriba, "Total $8.500"
  y "4 de septiembre a las 19:05" → extrae comercio/monto/fecha; boleta sin
  fecha reconocible → `fecha: null` pero comercio/monto igual se extraen.
- `construirBloques`: un `tesseractBlocks` de ejemplo (2 niveles anidados)
  → aplana correctamente a `lineas`/`bloques` ordenados por `top`.

### UI — flujo de captura

**`src/ui/movimientosView.js`**: botón **"Cargar comprobante"** (ícono
cámara nuevo en `iconos.js`) junto a "+ Agregar movimiento", con un
`<input type="file" accept="image/*" capture="environment" hidden>`
disparado por ese botón. Al elegir archivo:

1. Deshabilita el botón, muestra "Leyendo comprobante…".
2. `reconocerImagen(file)` → `construirBloques(...)` → `analizarComprobante(...)`.
3. Éxito o error (deja `valoresIniciales = null` si falla, para no bloquear
   la carga manual): `abrirMovimientoForm({ modo, categorias, valoresIniciales, archivoInicial: file, onGuardado: recargar })`.

**`src/ui/movimientoForm.js`** — cambios a la firma y el cuerpo:

- `abrirMovimientoForm({ modo, categorias, movimiento = null, valoresIniciales = null, archivoInicial = null, onGuardado })`.
- Sección nueva **"Comprobante"** al principio del formulario:
  miniatura (de `archivoInicial` vía `URL.createObjectURL`, o de
  `movimiento.imagen` vía `urlComprobante()` si se está editando y no hay
  archivo nuevo) + botón "Cargar comprobante" / "Reemplazar" + botón
  "Quitar" (si hay imagen). Estado interno: `archivoComprobante` (File
  pendiente de subir, arranca en `archivoInicial`), `imagenEliminada`
  (bool).
- Elegir un archivo **nuevo** desde este botón (no el inicial) también
  dispara OCR y rellena **solo los campos que estén vacíos** (nunca
  pisa algo que el usuario ya escribió) — cubre "adjunto el comprobante
  después de empezar a cargar a mano" y "reemplazo la imagen".
- Si `valoresIniciales` viene con datos (solo tiene efecto si `movimiento`
  es `null`, o sea alta): precarga `nombre`, `monto` (formateado con
  `formatoCLP`), `fecha` (vía `isoAInputLocal`), `detalle`. **No** setea
  `tipo` ni categoría — `tipoDetectado` (transferencia/compra) no equivale
  a gasto/ingreso (una transferencia puede ser cualquiera de los dos), así
  que se deja el default actual (`"gasto"`) y el usuario ajusta si hace
  falta.
- `huboCambios()` suma la condición `archivoComprobante !== archivoInicial || imagenEliminada`
  (en alta, cualquier `archivoComprobante` cuenta como cambio, igual que
  hoy con los demás campos).
- Al guardar (`onSubmit`): si `archivoComprobante` está seteado, se sube
  primero (`subirComprobante(sesión.user.id, archivoComprobante)`) y el
  path va en `datos.imagen`; si `imagenEliminada` y no hay archivo nuevo,
  `datos.imagen = null`. Tras un guardado exitoso, si había una imagen
  previa distinta (reemplazo o eliminación), se borra la vieja con
  `eliminarComprobante` (best-effort, no bloquea ni falla el guardado si
  eso falla).

**Verificación manual (no automatizable):** elegir una foto de una boleta
real → se abre el form con los campos plausibles rellenados y la miniatura
visible; guardar y volver a editar → la imagen se ve (URL firmada); subir
una transferencia con etiquetas claras ("Para", "Monto", "Fecha") → detecta
tipo transferencia y rellena correctamente; probar con una foto borrosa o
sin datos reconocibles → el formulario igual se abre vacío, sin romper.

---

## Fuera de alcance (quedan para después, sin fase asignada)

- Web Share Target (compartir imagen desde otra app).
- Fallback de OCR en la nube (Edge Function + Google Vision/OCR.space) —
  ya era opcional en el roadmap.
- Reintentar automáticamente con mayor resolución si el OCR da baja
  confianza.

## Orden de implementación sugerido

1. **4a**: `manifest.webmanifest` + ícono SVG + `sw.js` + cambios en
   `index.html`/`main.js`.
2. **4b**: migración 004 + `schema.sql` + `data/storage.js`.
3. **4c, capa pura**: vendoreo de Tesseract.js + `src/ocr/*.js` +
   `tests/ocr/*.test.js` (sin UI todavía).
4. **4c, integración**: cambios en `movimientoForm.js` y
   `movimientosView.js`, ícono de cámara.
5. Verificación manual de las 3 partes y ajustes de estilo.
