import { defineConfig } from "vite";

const S =
  "C:/Users/KINGRO~1/AppData/Local/Temp/claude/C--Users-KING-ROYALE-Documents-Github-finanzas-web/cda87c16-e5a8-449e-845d-a5cf2cc67f97/scratchpad";

export default defineConfig({
  server: { port: 8766, strictPort: true },
  optimizeDeps: { entries: ["__mov_harness.html"] },
  resolve: {
    alias: [
      { find: "../data/movimientos.js", replacement: `${S}/mockMovimientos.js` },
      { find: "../data/categorias.js", replacement: `${S}/mockCategorias.js` },
      { find: "../data/rpc.js", replacement: `${S}/mockRpc.js` },
      { find: "../data/storage.js", replacement: `${S}/mockStorage.js` },
      { find: "../auth.js", replacement: `${S}/mockAuth.js` },
      { find: "../ocr/tesseractWorker.js", replacement: `${S}/mockTesseract.js` },
    ],
  },
});
