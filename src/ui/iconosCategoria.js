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

// Devuelve el color hex a usar de fondo/ícono para un movimiento.
export function colorMovimiento(m) {
  if (m.categoria && m.categoria.color) return m.categoria.color;
  return m.tipo === "ingreso" ? "#1b7f4d" : "#c0392b";
}
