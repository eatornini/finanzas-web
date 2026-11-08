// Helpers puros de presentación (sin DOM): cómo se muestran ciertos datos
// en pantalla, sin cambiar lo que se guarda en la base.

// Nombres importados del banco llegan en MAYÚSCULAS ("RIKO POLLO"). Si el
// nombre tiene varias palabras y está entero en mayúsculas, se muestra en
// formato título ("Riko Pollo"). Una sola palabra en mayúsculas se deja
// igual, porque suele ser una sigla (VISA, AIEP, BCI).
export function nombreVisible(nombre) {
  const texto = String(nombre ?? "");
  const palabras = texto.trim().split(/\s+/);
  if (palabras.length < 2) return texto;
  const tieneLetras = /\p{L}/u.test(texto);
  if (!tieneLetras || texto !== texto.toLocaleUpperCase("es")) return texto;
  return palabras
    .map((p) =>
      /\d/.test(p)
        ? p
        : p.charAt(0).toLocaleUpperCase("es") + p.slice(1).toLocaleLowerCase("es")
    )
    .join(" ");
}

function ymd(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// "Hoy" / "Ayer" para la fecha (YYYY-MM-DD...) de un grupo; null si es otra.
export function etiquetaRelativaDia(fechaYmd, hoy = new Date()) {
  const f = String(fechaYmd || "").slice(0, 10);
  if (f === ymd(hoy)) return "Hoy";
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1, 12);
  if (f === ymd(ayer)) return "Ayer";
  return null;
}

// Días del período que ya pasaron (incluido hoy): 0 si el período aún no
// empieza, el largo completo si ya terminó. Sirve para el gasto diario
// promedio del modo Real.
export function diasTranscurridos({ desde, hasta }, hoy = new Date()) {
  const dia = (s) => new Date(`${s}T12:00:00`);
  const inicio = dia(desde);
  const fin = dia(hasta);
  const ref = dia(ymd(hoy));
  if (ref < inicio) return 0;
  const tope = ref > fin ? fin : ref;
  return Math.round((tope - inicio) / 86400000) + 1;
}
