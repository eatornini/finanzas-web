# Motor de OCR autohospedado (Tesseract.js)

Archivos vendoreados para que el reconocimiento de texto funcione offline y
sin pegarle a un CDN (objetivo de la PWA). Se eligió una sola variante del
motor (SIMD+LSTM, la más moderna) en vez de las 4 que soporta la librería
para compatibilidad amplia: este proyecto lo usa un solo usuario en
dispositivos con Chrome actualizado.

| Archivo | Paquete npm / origen | Peso |
|---|---|---|
| `tesseract.esm.min.js` | `tesseract.js@7.0.0`, `dist/tesseract.esm.min.js` | 63 KB |
| `worker.min.js` | `tesseract.js@7.0.0`, `dist/worker.min.js` | 109 KB |
| `tesseract-core-simd-lstm.wasm.js` | `tesseract.js-core@6.1.2` | 3.77 MB |
| `tesseract-core-simd-lstm.wasm` | `tesseract.js-core@6.1.2` (el `.js` de arriba le hace `fetch` por ruta relativa — **debe quedar en esta misma carpeta**) | 2.74 MB |
| `spa.traineddata.gz` | `@tesseract.js-data/spa@1.0.0`, carpeta `4.0.0_best_int/` (no la `4.0.0/` default: esa pesa 8.4 MB y da peor precisión — `best_int` es el modelo "best" de Tesseract cuantizado a int8) | 2.0 MB |

Todo Apache-2.0 (Tesseract.js y Tesseract).

## Uso

`src/ocr/tesseractWorker.js` importa el `default` de `tesseract.esm.min.js`
(el build ESM no tiene exports nombrados) y crea un worker con
`corePath`/`workerPath`/`langPath` apuntando a esta carpeta. `corePath` se
fija directo al archivo `.wasm.js` (la documentación de Tesseract.js
desaconseja esto para librerías públicas porque normalmente querés que
elija entre los 4 builds según el dispositivo — acá es intencional).

## Cómo regenerar / actualizar de versión

```bash
# tesseract.js (main lib + worker)
curl -sL "https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz" -o tessjs.tgz
tar xzf tessjs.tgz package/dist/tesseract.esm.min.js package/dist/worker.min.js
cp package/dist/tesseract.esm.min.js package/dist/worker.min.js assets/ocr/

# tesseract.js-core (motor wasm, variante simd-lstm)
curl -sL "https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-6.1.2.tgz" -o tesscore.tgz
tar xzf tesscore.tgz package/tesseract-core-simd-lstm.wasm.js package/tesseract-core-simd-lstm.wasm
cp package/tesseract-core-simd-lstm.wasm.js package/tesseract-core-simd-lstm.wasm assets/ocr/

# datos de idioma español, variante best_int
curl -sL "https://registry.npmjs.org/@tesseract.js-data/spa/-/spa-1.0.0.tgz" -o spa.tgz
tar xzf spa.tgz package/4.0.0_best_int/spa.traineddata.gz
cp package/4.0.0_best_int/spa.traineddata.gz assets/ocr/
```

Verificar que `worker.min.js` sigue esperando `corePath`/`langPath` con la
misma forma (revisar `docs/local-installation.md` del paquete `tesseract.js`
si cambia de versión mayor).
