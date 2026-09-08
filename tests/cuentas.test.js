import { describe, it, expect } from "vitest";
import {
  emailValido,
  validarRegistro,
  validarPasswordNueva,
  cuentaActiva,
  esAdmin,
  mensajeEstadoCuenta,
  etiquetaEstado,
  LARGO_MINIMO_PASSWORD,
} from "../src/logic/cuentas.js";

describe("emailValido", () => {
  it("acepta emails con formato razonable", () => {
    expect(emailValido("a@b.com")).toBe(true);
    expect(emailValido("  eric.tornini@gmail.com  ")).toBe(true);
  });
  it("rechaza vacío o sin dominio", () => {
    expect(emailValido("")).toBe(false);
    expect(emailValido("sin-arroba")).toBe(false);
    expect(emailValido("a@b")).toBe(false);
    expect(emailValido("a @b.com")).toBe(false);
  });
});

describe("validarRegistro", () => {
  const pass = "a".repeat(LARGO_MINIMO_PASSWORD);

  it("ok cuando email válido y contraseñas coinciden y cumplen el largo", () => {
    expect(validarRegistro({ email: "a@b.com", pass, pass2: pass })).toEqual({ ok: true, error: "" });
  });

  it("falla con email inválido", () => {
    expect(validarRegistro({ email: "malo", pass, pass2: pass }).ok).toBe(false);
  });

  it("falla si la contraseña es corta", () => {
    const corta = "a".repeat(LARGO_MINIMO_PASSWORD - 1);
    const r = validarRegistro({ email: "a@b.com", pass: corta, pass2: corta });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/al menos/);
  });

  it("falla si las contraseñas no coinciden", () => {
    const r = validarRegistro({ email: "a@b.com", pass, pass2: pass + "x" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no coinciden/);
  });
});

describe("validarPasswordNueva", () => {
  it("ok con par válido", () => {
    expect(validarPasswordNueva("12345678", "12345678")).toEqual({ ok: true, error: "" });
  });
  it("falla corta o distinta", () => {
    expect(validarPasswordNueva("123", "123").ok).toBe(false);
    expect(validarPasswordNueva("12345678", "87654321").ok).toBe(false);
  });
});

describe("cuentaActiva / esAdmin", () => {
  it("cuentaActiva solo con estado 'activo'", () => {
    expect(cuentaActiva({ estado: "activo" })).toBe(true);
    expect(cuentaActiva({ estado: "pendiente" })).toBe(false);
    expect(cuentaActiva(null)).toBe(false);
  });
  it("esAdmin exige rol admin y estado activo", () => {
    expect(esAdmin({ rol: "admin", estado: "activo" })).toBe(true);
    expect(esAdmin({ rol: "admin", estado: "pendiente" })).toBe(false);
    expect(esAdmin({ rol: "usuario", estado: "activo" })).toBe(false);
    expect(esAdmin(null)).toBe(false);
  });
});

describe("mensajeEstadoCuenta", () => {
  it("da un mensaje distinto por estado", () => {
    const pendiente = mensajeEstadoCuenta("pendiente");
    const deshab = mensajeEstadoCuenta("deshabilitado");
    const rechaz = mensajeEstadoCuenta("rechazado");
    expect(pendiente).toMatch(/pendiente/i);
    expect(deshab).toMatch(/deshabilitada/i);
    expect(rechaz).toMatch(/rechaz/i);
    expect(new Set([pendiente, deshab, rechaz]).size).toBe(3);
  });
  it("tiene fallback para estados desconocidos", () => {
    expect(mensajeEstadoCuenta("otro")).toBeTruthy();
  });
});

describe("etiquetaEstado", () => {
  it("traduce los estados conocidos y deja pasar el resto", () => {
    expect(etiquetaEstado("activo")).toBe("Activo");
    expect(etiquetaEstado("pendiente")).toBe("Pendiente");
    expect(etiquetaEstado("raro")).toBe("raro");
    expect(etiquetaEstado(undefined)).toBe("—");
  });
});
