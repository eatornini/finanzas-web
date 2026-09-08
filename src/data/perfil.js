import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

// Perfil del usuario logueado: { id, email, estado, rol, creado_en, ultimo_acceso }.
// La fila la crea un trigger al registrarse; siempre debería existir.
export async function miPerfil() {
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion?.user?.id;
  if (!uid) return null;
  return verificar(
    await supabase.from("perfiles").select("*").eq("id", uid).maybeSingle()
  );
}

// Marca el último acceso. Best-effort: si falla no interrumpe la carga.
export async function registrarAcceso() {
  try {
    await supabase.rpc("registrar_acceso");
  } catch (_e) {
    /* sin efecto visible para el usuario */
  }
}
