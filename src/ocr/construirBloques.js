// Convierte la salida de Tesseract.js (blocks[].paragraphs[].lines[], con
// bbox {x0,y0,x1,y1}) a la forma LineInfo/BlockInfo que usan los parsers
// portados de la APK (que ahí consumían block.lines de ML Kit, 2 niveles).
// Un párrafo de Tesseract equivale a un bloque de ML Kit.
//
// LineInfo:  { text, top, bottom, height, left, right }
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
