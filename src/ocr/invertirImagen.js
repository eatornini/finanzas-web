// Invierte los colores de una imagen (blanco<->negro). Mejora el OCR en
// capturas con tema oscuro (texto claro sobre fondo oscuro): Tesseract está
// entrenado sobre todo con texto oscuro sobre fondo claro, y en capturas
// oscuras comprimidas (WhatsApp, etc.) pierde justo los bloques grandes en
// negrita — visto en vivo con un monto tipo "CLP2,200" que ni PSM 11 ni
// PSM 3 reconocían en la versión oscura del comprobante, pero sí en la
// misma captura con el teléfono en modo claro.
//
// Se usa solo como último fallback (ver movimientoForm.js): invertir una
// captura en tema claro empeoraría su OCR.
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
