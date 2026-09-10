import { prefs } from "../prefs.js";

// Color de acento por defecto (el mismo que define app.css en :root).
export const ACENTO_DEFECTO = "#0966DF";

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function esHexValido(color) {
  return HEX6.test(String(color || ""));
}

// Aplica el color de acento como estilo inline en :root. Un inline style gana
// a las reglas de app.css (incluidas las de modo oscuro), así que un solo
// color sirve para tema claro y oscuro. Si es el color por defecto se quita
// el override para volver a lo que define la hoja de estilos.
export function aplicarAcento(color) {
  const raiz = document.documentElement;
  const c = esHexValido(color) ? color : ACENTO_DEFECTO;
  if (c.toLowerCase() === ACENTO_DEFECTO.toLowerCase()) {
    raiz.style.removeProperty("--acento");
    raiz.style.removeProperty("--acento-tenue");
    return;
  }
  raiz.style.setProperty("--acento", c);
  // Versión tenue (fondos de estados activos, resaltados): tinte del acento.
  raiz.style.setProperty("--acento-tenue", `color-mix(in srgb, ${c} 14%, transparent)`);
}

// Aplica el acento guardado en preferencias. Llamar al arrancar la app.
export function aplicarAcentoGuardado() {
  aplicarAcento(prefs.get("acento"));
}
