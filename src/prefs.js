// Único punto de acceso a localStorage. Claves namespaced "finanzas.".
const PREFIJO = "finanzas.";

function hoyISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// tipo: "bool" | "str" | "json"; def puede ser función (se evalúa al leer).
const DEFS = {
  modo: { tipo: "str", def: "real" },
  tema: { tipo: "str", def: "auto" },
  // Color de acento (#rrggbb). Por defecto el mismo que define app.css.
  acento: { tipo: "str", def: "#0966DF" },
  // Última vista abierta en el shell (movimientos | resumen | categorias |
  // buscar | reportes | configuracion). Se valida contra VISTAS al leerla.
  vistaActiva: { tipo: "str", def: "movimientos" },
  ocultarTotal: { tipo: "bool", def: false },
  incluirInactivos: { tipo: "bool", def: false },
  periodoTipo: { tipo: "str", def: "mes" },
  fechaRef: { tipo: "str", def: hoyISO },
  // Claves de grupos (fecha en modo real, categoría en estimado) colapsados
  // en la lista de Movimientos, con el modo como prefijo para no mezclar.
  gruposColapsados: { tipo: "json", def: () => [] },
};

function leerCrudo(clave) {
  try {
    return localStorage.getItem(PREFIJO + clave);
  } catch {
    return null;
  }
}

export const prefs = {
  get(clave) {
    const spec = DEFS[clave];
    if (!spec) throw new Error(`pref desconocida: ${clave}`);
    const crudo = leerCrudo(clave);
    if (crudo === null) return typeof spec.def === "function" ? spec.def() : spec.def;
    if (spec.tipo === "bool") return crudo === "true";
    if (spec.tipo === "json") {
      try {
        return JSON.parse(crudo);
      } catch {
        return typeof spec.def === "function" ? spec.def() : spec.def;
      }
    }
    return crudo;
  },
  set(clave, valor) {
    const spec = DEFS[clave];
    if (!spec) throw new Error(`pref desconocida: ${clave}`);
    try {
      localStorage.setItem(PREFIJO + clave, spec.tipo === "json" ? JSON.stringify(valor) : String(valor));
    } catch {
      /* almacenamiento no disponible: se ignora */
    }
  },
};
