import { supabase } from "../supabaseClient.js";

// Normaliza el resultado de supabase-js: devuelve data o lanza el error.
// Ante 401 (sesión inválida) cierra la sesión; el router mostrará el login.
export async function verificar(resultado) {
  const { data, error } = resultado;
  if (error) {
    if (error.status === 401 || error.code === "PGRST301") {
      await supabase.auth.signOut();
    }
    throw error;
  }
  return data;
}
