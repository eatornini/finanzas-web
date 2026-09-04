// Único punto de acceso a localStorage. Claves namespaced "finanzas.".
const PREFIJO = "finanzas.";

function hoyISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// tipo: "bool" | "str"; def puede ser función (se evalúa al leer).
const DEFS = {
  modo: { tipo: "str", def: "real" },
  tema: { tipo: "str", def: "auto" },
  ocultarTotal: { tipo: "bool", def: false },
  incluirInactivos: { tipo: "bool", def: false },
  periodoTipo: { tipo: "str", def: "mes" },
  fechaRef: { tipo: "str", def: hoyISO },
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
    return spec.tipo === "bool" ? crudo === "true" : crudo;
  },
  set(clave, valor) {
    if (!DEFS[clave]) throw new Error(`pref desconocida: ${clave}`);
    try {
      localStorage.setItem(PREFIJO + clave, String(valor));
    } catch {
      /* almacenamiento no disponible: se ignora */
    }
  },
};
