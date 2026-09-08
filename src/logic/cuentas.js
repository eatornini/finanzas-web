// Helpers puros para el flujo de cuentas (registro / recuperación / estado).
// Sin DOM ni Supabase: fáciles de testear.

export const LARGO_MINIMO_PASSWORD = 8;

// Validación laxa de email: hay un caracter antes y después de una @, y un
// punto en el dominio. La validación real la hace Supabase.
const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(email) {
  return RX_EMAIL.test(String(email || "").trim());
}

// Valida los campos del formulario de registro. Devuelve { ok, error }:
// `error` es un mensaje listo para mostrar (o "" si ok).
export function validarRegistro({ email, pass, pass2 }) {
  if (!emailValido(email)) {
    return { ok: false, error: "Escribe un email válido." };
  }
  if (!pass || pass.length < LARGO_MINIMO_PASSWORD) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
    };
  }
  if (pass !== pass2) {
    return { ok: false, error: "Las contraseñas no coinciden." };
  }
  return { ok: true, error: "" };
}

// Valida el par de contraseñas de la pantalla "fijar nueva contraseña".
export function validarPasswordNueva(pass, pass2) {
  if (!pass || pass.length < LARGO_MINIMO_PASSWORD) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
    };
  }
  if (pass !== pass2) {
    return { ok: false, error: "Las contraseñas no coinciden." };
  }
  return { ok: true, error: "" };
}

// Una cuenta accede a la app solo si su perfil está 'activo'.
export function cuentaActiva(perfil) {
  return perfil != null && perfil.estado === "activo";
}

export function esAdmin(perfil) {
  return perfil != null && perfil.rol === "admin" && perfil.estado === "activo";
}

// Mensaje para la pantalla que ve un usuario logueado pero sin acceso.
export function mensajeEstadoCuenta(estado) {
  switch (estado) {
    case "pendiente":
      return "Tu cuenta está pendiente de aprobación. Un administrador debe habilitarla antes de que puedas entrar.";
    case "deshabilitado":
      return "Tu cuenta está deshabilitada. Contacta al administrador si crees que es un error.";
    case "rechazado":
      return "Tu solicitud de cuenta fue rechazada. Contacta al administrador para más información.";
    default:
      return "Tu cuenta no tiene acceso a la aplicación en este momento.";
  }
}

// Etiqueta corta del estado, para la tabla del panel de administración.
export function etiquetaEstado(estado) {
  const mapa = {
    pendiente: "Pendiente",
    activo: "Activo",
    deshabilitado: "Deshabilitado",
    rechazado: "Rechazado",
  };
  return mapa[estado] || estado || "—";
}
