import { describe, it, expect } from "vitest";
import { construirBloques } from "../../src/ocr/construirBloques.js";

describe("construirBloques", () => {
  it("aplana blocks/paragraphs/lines de Tesseract a bloques y líneas ordenadas por top", () => {
    const tesseractBlocks = [
      {
        paragraphs: [
          {
            bbox: { x0: 10, y0: 200, x1: 300, y1: 230 },
            lines: [{ text: "Total $8.500", bbox: { x0: 10, y0: 200, x1: 300, y1: 230 } }],
          },
          {
            bbox: { x0: 10, y0: 50, x1: 300, y1: 90 },
            lines: [
              { text: "Supermercado Central", bbox: { x0: 10, y0: 50, x1: 300, y1: 70 } },
              { text: "Sucursal Centro", bbox: { x0: 10, y0: 72, x1: 300, y1: 90 } },
            ],
          },
        ],
      },
    ];

    const { lineas, bloques } = construirBloques(tesseractBlocks);

    expect(bloques).toHaveLength(2);
    expect(lineas).toHaveLength(3);
    expect(lineas[0].text).toBe("Supermercado Central");
    expect(lineas[1].text).toBe("Sucursal Centro");
    expect(lineas[2].text).toBe("Total $8.500");
    expect(lineas[0]).toEqual({ text: "Supermercado Central", top: 50, bottom: 70, height: 20, left: 10, right: 300 });
  });

  it("descarta líneas vacías", () => {
    const tesseractBlocks = [
      {
        paragraphs: [
          {
            bbox: { x0: 0, y0: 0, x1: 100, y1: 40 },
            lines: [
              { text: "  ", bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
              { text: "Hola", bbox: { x0: 0, y0: 20, x1: 100, y1: 40 } },
            ],
          },
        ],
      },
    ];
    const { lineas } = construirBloques(tesseractBlocks);
    expect(lineas).toHaveLength(1);
    expect(lineas[0].text).toBe("Hola");
  });

  it("lista vacía si no hay blocks", () => {
    expect(construirBloques([])).toEqual({ lineas: [], bloques: [] });
  });
});
