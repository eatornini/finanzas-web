// Elige un icono representativo para un movimiento según palabras clave
// de su nombre/categoría, con reglas de color coherentes con el tipo.
import {
  combustibleIcono,
  llaveIcono,
  billeteIcono,
  carritoIcono,
  casaIcono,
  corazonIcono,
  peliculaIcono,
  autoIcono,
  maletinIcono,
  flechaArribaCirculo,
  flechaAbajoCirculo,
  utensiliosIcono,
  alcanciaIcono,
  saludPulsoIcono,
  intercambioIcono,
  carroIcono,
} from "./iconos.js";

const REGLAS = [
  { rx: /bencina|combustible|gasolina|nafta/i, icono: combustibleIcono },
  { rx: /arregl|repar|mantenci[oó]n|manten/i, icono: llaveIcono },
  { rx: /sueldo|liquidaci[oó]n|salario|honorario/i, icono: billeteIcono },
  { rx: /super|mercado|almac[eé]n|comida|compras/i, icono: carritoIcono },
  { rx: /arriendo|casa|hipoteca|dividendo/i, icono: casaIcono },
  { rx: /salud|farmacia|m[eé]dic|dentista/i, icono: corazonIcono },
  { rx: /cine|streaming|netflix|entretenim|ocio/i, icono: peliculaIcono },
  { rx: /transporte|uber|taxi|bencina|auto|micro|metro/i, icono: autoIcono },
  { rx: /trabajo|freelance|proyecto|negocio/i, icono: maletinIcono },
];

function iconoPorPalabras(texto) {
  for (const { rx, icono } of REGLAS) {
    if (rx.test(texto)) return icono;
  }
  return null;
}

// Devuelve el nodo <svg> a usar para un movimiento.
export function iconoMovimiento(m) {
  const texto = `${m.nombre || ""} ${m.categoria ? m.categoria.nombre : ""}`;
  const fabrica =
    iconoPorPalabras(texto) ||
    (m.tipo === "ingreso" ? flechaArribaCirculo : flechaAbajoCirculo);
  return fabrica();
}

// Icono semántico para una categoría por su nombre (leyenda de "Gastos por
// categoría"). Devuelve una fábrica de <svg> o null si no hay coincidencia
// (en ese caso la leyenda mantiene el punto de color de siempre).
const REGLAS_CATEGORIA = [
  { rx: /aliment|comida|super|mercado|almac[eé]n|restaurant|caf[eé]/i, icono: utensiliosIcono },
  { rx: /ahorro|saving|inversi[oó]n/i, icono: alcanciaIcono },
  { rx: /salud|farmacia|m[eé]dic|dentista|hospital/i, icono: saludPulsoIcono },
  { rx: /transferen/i, icono: intercambioIcono },
  { rx: /locomoci[oó]n|transporte|micro|metro|\bbus\b|uber|taxi|bencina|combustible|movilizaci[oó]n/i, icono: carroIcono },
];

export function iconoSemanticoCategoria(nombre) {
  const texto = nombre || "";
  for (const { rx, icono } of REGLAS_CATEGORIA) {
    if (rx.test(texto)) return icono;
  }
  return null;
}

// Devuelve el color hex a usar de fondo/ícono para un movimiento.
export function colorMovimiento(m) {
  if (m.categoria && m.categoria.color) return m.categoria.color;
  return m.tipo === "ingreso" ? "#1b7f4d" : "#c0392b";
}
