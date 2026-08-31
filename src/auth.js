import { supabase } from "./supabaseClient.js";

export async function iniciarSesion(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
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
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
