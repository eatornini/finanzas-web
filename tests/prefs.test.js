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
