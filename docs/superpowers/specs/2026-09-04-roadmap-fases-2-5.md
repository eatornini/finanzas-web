# Roadmap web-only — Fases 2 a 5

Fecha: 2026-09-04
Contexto previo:
- `docs/superpowers/specs/2026-09-04-paridad-app-web-fase-0-1-design.md` (diseño Fase 0+1)
- `docs/superpowers/plans/2026-09-04-paridad-app-web-fase-0-1.md` (plan Fase 0+1, ya implementado y mergeado a `main`)

Decisión estratégica: la app web reemplaza a la app Android (`Finanzas APK/`,
Kotlin, JSON local). Se lleva la web a paridad y se jubila la APK. Fase 0+1 ya
está en `main`. Este documento describe lo que falta, para retomarlo en frío en
otra máquina.

## Cómo retomar

Estado (2026-09-04): Fases 0+1, 2 y 3 mergeadas a `main`. Fase 4 (PWA +
Storage + OCR) está implementada completa en la rama remota
`feat/fase-4-pwa-storage-ocr` (pusheada a GitHub, no mergeada — falta
verificación manual, ver abajo).

1. `git fetch origin` y `git checkout feat/fase-4-pwa-storage-ocr` (o
   `git pull` en `main` si la Fase 4 ya se mergeó y solo vas a seguir con
   la Fase 5).
2. `npm install` (por si cambió algo).
3. Migraciones de Supabase ya aplicadas en el proyecto compartido: 001 a
   003. **Falta correr `supabase/migrations/004-storage-comprobantes.sql`**
   (crea el bucket de Storage `comprobantes` con sus políticas) — se
   necesita antes de poder probar Fase 4b/4c.
4. Verificación manual pendiente de Fase 4 (con `npx serve .`, migración
   004 corrida):
   - PWA: manifest/service worker sin errores en DevTools, "Instalar app",
     que abra offline.
   - Cargar comprobante (botón en Movimientos) con una foto real de
     boleta/transferencia → formulario prellenado + miniatura; editar,
     reemplazar y quitar la imagen.
   - Detalle completo del spec/plan de Fase 4:
     `docs/superpowers/specs/2026-09-04-fase-4-pwa-storage-ocr-design.md`.
5. Abrir Claude Code en el repo (rama `feat/fase-4-pwa-storage-ocr`) y
   contarle qué probaste y si funcionó. Si todo OK, pedile que mergee la
   Fase 4 a `main` y siga con la Fase 5 (retiro de la APK). Si algo falla,
   describí qué viste (mensaje de error, captura, etc.) para que lo
   arregle antes de mergear.
6. El plugin `superpowers` está deshabilitado en esta cuenta — cada fase se
   trabajó con brainstorming → spec → plan → ejecución manual (sin el
   skill), igual criterio a seguir en la Fase 5.

## Referencia para el port del OCR

Los archivos Kotlin del parser de comprobantes de la APK están copiados en
`docs/referencia-apk-ocr/` para poder portarlos sin depender de la carpeta
`Finanzas APK/` (que está en `.gitignore`):

- `DocumentTypeDetector.kt` — clasifica el comprobante (transferencia vs compra) por palabras clave.
- `OcrModels.kt` — tipos (`LineInfo`, `BlockInfo`, `DocumentType`, `OcrResult`).
- `TransferenciaOcrParser.kt` — extrae comercio/monto/fecha/detalle de transferencias.
- `TransferExtractor.kt` — variante con heurísticas geométricas (usa coordenadas de línea).
- `PurchaseExtractor.kt` — extrae datos de boletas/compras.

Son ~1400 líneas de lógica pura (listas de palabras, regex de montos/fechas/horas,
meses en español, listas de exclusión de bancos chilenos). Se traducen 1:1 a JS
en `src/ocr/*.js`. Lo único atado a Android es el motor OCR (ML Kit) y que las
líneas traen bounding boxes.

---

## Fase 2 — Herramientas de mes (modo estimado)

**Objetivo:** paridad con las acciones de menú de la APK en modo estimado.

- **Copiar mes estimado al siguiente**: duplica los movimientos `modo='estimado'`
  del mes visible al mes siguiente; los `recurrente` mantienen su `monto`, el
  resto queda en 0. (APK: `MainActivity.copiarMesEstimado`.)
- **Borrar datos del mes**: elimina todos los `modo='estimado'` del mes visible.
  (APK: `borrarDatosMes`.)
- **Activar / desactivar todos** los movimientos del mes visible (`activo`).
  (APK: `cambiarEstadoMovimientosMes`.)
- **Materialización de recurrentes**: definir la regla. Opción simple: al abrir
  un mes estimado sin instancias de un recurrente, no autogenerar; la generación
  ocurre solo vía "copiar mes". Opción completa: un `pg_cron` / Edge Function que
  crea las instancias del período. Recomendado: la simple para Fase 2.

**Dónde:** nueva sección en el shell o en Resumen con estas acciones (menú
"⋯" o botones), visibles solo en `modo === 'estimado'`. Lógica de duplicado
como funciones puras en `src/logic/` + wrappers de escritura batch en
`src/data/movimientos.js` (o una RPC `copiar_mes_estimado(p_desde date)` si el
volumen lo pide). Tests de la lógica de duplicado/filtrado por mes.

**Fuera de alcance:** nada nuevo de esquema.

---

## Fase 3 — Reportes y gráfico interactivo

- **Torta interactiva**: reemplazar la dona CSS estática de `panelResumenView`
  por un SVG (o Chart.js autohospedado — pero preferible SVG a mano, sin
  dependencia) con: tap en un sector → resalta y muestra tooltip con monto y %.
  (APK: `ResumenFragment.crearGrafico`.)
- **Vista Reportes** (hoy placeholder): tendencias por período y comparativa
  entre períodos (mes vs mes anterior, año vs año). Series a partir de
  `listarMovimientos` sobre rangos ampliados; agregación en `src/logic/`.
- **Buscador global**: buscar en todos los movimientos del usuario (no solo el
  período visible), con filtros por tipo y categoría. (APK: `BusquedaActivity`.)
  Necesita una consulta sin filtro de `fecha_local` con paginación (`range()` de
  PostgREST).

**Fuera de alcance:** exportar/compartir reportes.

---

## Fase 4 — PWA + captura de comprobantes (OCR)

### 4a. PWA

- `manifest.webmanifest` (name, icons, `display: standalone`, `start_url`,
  `theme_color`, `background_color`).
- `sw.js` (service worker): precache del app shell (`index.html`, `app.css`,
  `src/**`, la fuente de iconos) con estrategia cache-first para assets y
  network-first para las llamadas a Supabase. Registrar en `main.js`.
- `<link rel="manifest">` e íconos en `index.html`.
- Verificar "Instalar app" en Chrome Android y arranque offline (lectura).

### 4b. Imágenes en Supabase Storage

- Bucket `comprobantes` con RLS por usuario
  (`(storage.foldername(name))[1] = auth.uid()::text`).
- Subir la imagen del comprobante, guardar su path en `movimientos.imagen`
  (columna ya existe). Mostrar miniatura en el detalle/edición del movimiento.

### 4c. OCR en el navegador

- **Entrada de la imagen:**
  - `<input type="file" accept="image/*" capture>` en el form de movimiento
    (botón "Cargar comprobante"). Funciona siempre.
  - Web Share Target: en `manifest.webmanifest`, `share_target` con
    `method: POST`, `enctype: multipart/form-data`, `params.files` aceptando
    `image/*`; el service worker intercepta el POST a `/agregar`, saca el `File`
    del `FormData` y abre el alta con la imagen. (GitHub Pages no procesa POST:
    lo resuelve el SW.)
- **Motor:** Tesseract.js (WASM, offline) con idioma `spa`. Autohospedar el
  `.wasm` y el `spa.traineddata` (no cargar de CDN, choca con el objetivo PWA).
  Da bounding boxes por línea/palabra, así que las heurísticas geométricas del
  parser se conservan.
- **Parser:** portar de `docs/referencia-apk-ocr/*.kt` a `src/ocr/*.js`:
  `documentTypeDetector.js`, `ocrModels.js` (tipos JS/JSDoc),
  `transferenciaParser.js`, `transferExtractor.js`, `purchaseExtractor.js`.
  Salida `{ comercio, monto, fecha, detalle, tipo }` → pre-llena el form
  (`abrirMovimientoForm` acepta `valoresIniciales`).
- **Fallback opcional:** Supabase Edge Function que llame a un OCR en la nube
  (Google Vision u OCR.space, capa gratis) con la key del lado servidor, para
  casos donde Tesseract falle. Requiere conexión.

**Tests:** el parser es lógica pura → tests con textos de comprobante reales
(anonimizados) que verifiquen extracción de monto, fecha y comercio.

---

## Fase 5 — Retiro de la APK

- Verificación de paridad contra el checklist del gap analysis.
- Confirmar que no hay datos solo en la APK (ya se decidió partir de Supabase).
- Dejar de usar la APK. Opcional: archivar el repo Android.
- Actualizar `README.md` de `finanzas-web` (ya no es "sin importador desde la
  app Android"; ahora es la app principal, PWA instalable).

---

## Checklist de gap (para Fase 5 / verificación)

Funciones de la APK que estas fases cubren:

- [ ] Fecha con hora (Fase 0+1 ✔)
- [ ] Activo/inactivo + "incluir inactivos" (Fase 0+1 ✔)
- [ ] Recurrente/frecuencia como campo (Fase 0+1 ✔); autogeneración vía "copiar mes" (Fase 2 ✔, regla simple)
- [ ] Iconos/emoji por categoría (Fase 0+1 ✔)
- [ ] Categorías por tipo y modo (Fase 0+1 ✔)
- [ ] Chips rápidos por uso (Fase 0+1 ✔)
- [ ] Autocompletado de comercio (Fase 0+1 ✔)
- [ ] Ocultar total (Fase 0+1 ✔)
- [ ] Drill-down por categoría (Fase 0+1 ✔)
- [ ] Persistencia de período (Fase 0+1 ✔)
- [ ] Copiar mes / borrar mes / activar-desactivar todos (Fase 2 ✔)
- [ ] Torta interactiva (Fase 3 ✔)
- [ ] Reportes / comparativas (Fase 3 ✔)
- [ ] Buscador global (Fase 3 ✔)
- [ ] Adjuntar imagen → Fase 4b
- [ ] OCR de comprobante → Fase 4c
- [ ] Instalable / offline (PWA) → Fase 4a
- [ ] Exportar backup JSON → opcional, sin fase asignada (bajo esfuerzo: descargar JSON)
