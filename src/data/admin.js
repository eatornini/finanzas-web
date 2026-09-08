import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";
import { urlSitio } from "../auth.js";

// Operaciones del panel de administración. Las que solo tocan `perfiles` /
// `movimientos` van por RPC security definer; las que tocan auth.users
// (reset / fijar contraseña / eliminar) van por la Edge Function "admin".

export async function listarUsuarios() {
  return verificar(await supabase.rpc("admin_listar_usuarios"));
}

export async function estadisticas() {
  return verificar(await supabase.rpc("admin_estadisticas"));
}

export async function setEstado(id, estado) {
  return verificar(await supabase.rpc("admin_set_estado", { p_id: id, p_estado: estado }));
}

export async function setRol(id, rol) {
  return verificar(await supabase.rpc("admin_set_rol", { p_id: id, p_rol: rol }));
}

// Normaliza la respuesta de functions.invoke: lanza con el mensaje real de
// la función (que viaja en el cuerpo de la respuesta, no en error.message).
async function invocarAdmin(body) {
  const { data, error } = await supabase.functions.invoke("admin", { body });
  if (error) {
    let msg = error.message || "No se pudo completar la acción.";
    try {
      const cuerpo = await error.context?.json?.();
      if (cuerpo?.error) msg = cuerpo.error;
    } catch (_e) {
      /* se usa el mensaje genérico */
    }
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

export async function resetPassword(email) {
  return invocarAdmin({ accion: "reset_password", email, redirectTo: urlSitio() + "#recuperar" });
}

export async function fijarPassword(id, password) {
  return invocarAdmin({ accion: "set_password", id, password });
}

export async function eliminarUsuario(id) {
  return invocarAdmin({ accion: "eliminar_usuario", id });
}
