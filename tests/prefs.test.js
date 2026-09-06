import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub mínimo de localStorage para Node.
beforeEach(() => {
  const store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  });
});

const load = async () => (await import("../src/prefs.js?" + Math.random())).prefs;

describe("prefs", () => {
  it("devuelve defaults cuando no hay nada guardado", async () => {
    const prefs = await load();
    expect(prefs.get("modo")).toBe("real");
    expect(prefs.get("ocultarTotal")).toBe(false);
    expect(prefs.get("periodoTipo")).toBe("mes");
    expect(prefs.get("fechaRef")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("persiste y relee valores", async () => {
    const prefs = await load();
    prefs.set("modo", "estimado");
    prefs.set("ocultarTotal", true);
    expect(prefs.get("modo")).toBe("estimado");
    expect(prefs.get("ocultarTotal")).toBe(true);
  });

  it("tipo json: default es función, persiste y relee arrays", async () => {
    const prefs = await load();
    expect(prefs.get("gruposColapsados")).toEqual([]);
    prefs.set("gruposColapsados", ["real:2026-09-04", "estimado:cat1"]);
    expect(prefs.get("gruposColapsados")).toEqual(["real:2026-09-04", "estimado:cat1"]);
  });

  it("tipo json: si el valor guardado no es JSON válido, vuelve al default", async () => {
    localStorage.setItem("finanzas.gruposColapsados", "no es json{");
    const prefs = await load();
    expect(prefs.get("gruposColapsados")).toEqual([]);
  });

  it("no rompe si localStorage lanza", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    const prefs = await load();
    expect(prefs.get("tema")).toBe("auto");
    expect(() => prefs.set("tema", "oscuro")).not.toThrow();
  });
});
