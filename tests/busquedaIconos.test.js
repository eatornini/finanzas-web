import { describe, it, expect } from "vitest";
import { buscarIconos } from "../src/logic/busquedaIconos.js";

const MAPA = {
  restaurant: "",
  local_restaurant: "",
  local_cafe: "",
  home: "",
};

describe("buscarIconos", () => {
  it("consulta vacía no devuelve resultados", () => {
    expect(buscarIconos(MAPA, "")).toEqual([]);
    expect(buscarIconos(MAPA, "   ")).toEqual([]);
  });

  it("prioriza los nombres que empiezan con la consulta sobre los que solo la contienen", () => {
    const resultados = buscarIconos(MAPA, "restaurant");
    expect(resultados.map((r) => r.nombre)).toEqual(["restaurant", "local_restaurant"]);
  });

  it("es insensible a mayúsculas y admite espacios en vez de guion bajo", () => {
    const resultados = buscarIconos(MAPA, "LOCAL CAFE");
    expect(resultados).toEqual([{ nombre: "local_cafe", caracter: "" }]);
  });

  it("no devuelve nada si ningún nombre coincide", () => {
    expect(buscarIconos(MAPA, "zzz")).toEqual([]);
  });

  it("respeta el límite de resultados", () => {
    const mapaGrande = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [`icono_${i}`, ""])
    );
    expect(buscarIconos(mapaGrande, "icono", 10)).toHaveLength(10);
  });
});
