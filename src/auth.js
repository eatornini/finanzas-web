import { supabase } from "./supabaseClient.js";

// URL del sitio para armar los enlaces que Supabase manda por email
// (recuperación de contraseña). Incluye el pathname para funcionar bien
// bajo el subpath de GitHub Pages.
export function urlSitio() {
  return location.origin + location.pathname;
}

export async function iniciarSesion(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// Crea la cuenta. El trigger de la base deja el perfil en estado 'pendiente';
// un admin debe aprobarlo antes de que el usuario acceda a la app.
export async function registrarse(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: urlSitio() },
  });
  if (error) throw error;
  return data;
}

// Manda el email con el enlace para restablecer la contraseña. El enlace
// vuelve al sitio con un token de recuperación; el router lo detecta y
// muestra la pantalla para fijar la nueva contraseña (#recuperar).
export async function enviarResetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: urlSitio() + "#recuperar",
  });
  if (error) throw error;
}

// Fija una contraseña nueva para la sesión actual (se usa en la pantalla de
// recuperación, cuando ya hay una sesión de tipo recovery activa).
export async function actualizarPassword(nuevaPassword) {
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
  if (error) throw error;
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

export async function sesionActual() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function alCambiarSesion(callback) {
  const { data } = supabase.auth.onAuthStateChange((evento, session) => {
    callback(session, evento);
  });
  return () => data.subscription.unsubscribe();
}
