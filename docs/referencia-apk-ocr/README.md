# Referencia: parser de OCR de la app Android

Copia de los archivos Kotlin del parser de comprobantes de `Finanzas APK/`
(que está en `.gitignore`), para poder portarlos a JS en la Fase 4c sin
depender de esa carpeta.

- `DocumentTypeDetector.kt` — clasifica transferencia vs compra por palabras clave.
- `OcrModels.kt` — tipos (`LineInfo`, `BlockInfo`, `DocumentType`, `OcrResult`).
- `TransferenciaOcrParser.kt` — extrae comercio/monto/fecha/detalle de transferencias.
- `TransferExtractor.kt` — variante con heurísticas geométricas.
- `PurchaseExtractor.kt` — extrae datos de boletas/compras.
- `OcrHelper.kt` — utilidades de agrupado de líneas (contexto para los extractores).

Al portar: `src/ocr/*.js`, lógica pura, con tests sobre textos reales anonimizados.
El motor OCR (ML Kit en Android) se reemplaza por Tesseract.js en el navegador.
