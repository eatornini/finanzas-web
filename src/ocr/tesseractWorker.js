// El build ESM de Tesseract.js exporta todo como default (sin exports
// nombrados) — se verificó inspeccionando el archivo vendoreado.
import Tesseract from "../../assets/ocr/tesseract.esm.min.js";

const { createWorker } = Tesseract;
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
