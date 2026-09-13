// El build ESM de Tesseract.js exporta todo como default (sin exports
// nombrados) — se verificó inspeccionando el archivo vendoreado.
import Tesseract from "../../assets/ocr/tesseract.esm.min.js";

const { createWorker } = Tesseract;
const BASE = new URL("../../assets/ocr/", import.meta.url).href;

let workerPromise = null;
let psmActual = "11";

function obtenerWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("spa", 1, {
      workerPath: BASE + "worker.min.js",
      corePath: BASE + "tesseract-core-simd-lstm.wasm.js",
      langPath: BASE,
    }).then(async (worker) => {
      // PSM 11 (sparse text): capturas de apps/recibos tienen texto disperso
      // en bloques de tamaño muy distinto (título/monto enormes, resto
      // chico) rodeados de mucho espacio vacío. El PSM automático (3,
      // default) suele descartar esos bloques grandes y aislados tratándolos
      // como si no fueran texto — se vio en vivo con un recibo real donde
      // faltaban justo el título y el monto.
      await worker.setParameters({ tessedit_pageseg_mode: psmActual });
      return worker;
    });
  }
  return workerPromise;
}

async function reconocerConPsm(file, psm) {
  const worker = await obtenerWorker();
  if (psm !== psmActual) {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    psmActual = psm;
  }
  const { data } = await worker.recognize(file, {}, { blocks: true });
  return data.blocks || [];
}

// file: File | Blob de la imagen. Devuelve Tesseract.Block[] (con bbox).
export async function reconocerImagen(file) {
  return reconocerConPsm(file, "11");
}

// Reintento con PSM 3 (automático completo): red de seguridad para cuando
// PSM 11 igual descarta un bloque grande y aislado (monto/título) — pasa en
// algunas capturas según compresión o contraste, aunque el caso general ya
// esté cubierto por PSM 11. Nunca se usa como modo principal: PSM 3 fue
// justamente el que originalmente perdía esos bloques (ver comentario de
// arriba), así que solo sirve como segundo intento cuando el primero falló.
export async function reconocerImagenAlterno(file) {
  return reconocerConPsm(file, "3");
}
