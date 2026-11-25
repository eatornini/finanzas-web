// Invierte los colores de una imagen (blanco<->negro). Mejora el OCR en
// capturas con tema oscuro (texto claro sobre fondo oscuro): Tesseract está
// entrenado sobre todo con texto oscuro sobre fondo claro, y en capturas
// oscuras comprimidas (WhatsApp, etc.) pierde justo los bloques grandes en
// negrita — visto en vivo con un monto tipo "CLP2,200" que ni PSM 11 ni
// PSM 3 reconocían en la versión oscura del comprobante, pero sí en la
// misma captura con el teléfono en modo claro.
//
// En capturas claras se usa solo como último fallback (ver movimientoForm.js):
// invertir una captura en tema claro empeoraría su OCR. En capturas oscuras
// (esImagenOscura) pasa a ser el primer intento.
// true si la imagen es mayormente oscura (captura con tema oscuro). Se mide
// la luminancia promedio sobre una miniatura de 64x64: barato y suficiente
// para decidir si conviene empezar el OCR por la versión invertida en vez de
// gastar dos pasadas sobre la original que suelen fallar en ese caso.
const LADO_MUESTRA = 64;
const UMBRAL_OSCURA = 90; // luminancia promedio 0-255

export async function esImagenOscura(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = LADO_MUESTRA;
  canvas.height = LADO_MUESTRA;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, LADO_MUESTRA, LADO_MUESTRA);
  bitmap.close?.();
  const px = ctx.getImageData(0, 0, LADO_MUESTRA, LADO_MUESTRA).data;
  let suma = 0;
  for (let i = 0; i < px.length; i += 4) {
    suma += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }
  return suma / (px.length / 4) < UMBRAL_OSCURA;
}

export async function invertirImagen(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = datos.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i] = 255 - px[i];
    px[i + 1] = 255 - px[i + 1];
    px[i + 2] = 255 - px[i + 2];
  }
  ctx.putImageData(datos, 0, 0);
  return canvas;
}
