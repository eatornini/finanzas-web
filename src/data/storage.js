import { supabase } from "../supabaseClient.js";

const EXT_POR_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function subirComprobante(userId, file) {
  const ext = EXT_POR_MIME[file.type] || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("comprobantes").upload(path, file);
  if (error) throw error;
  return path;
}

export async function urlComprobante(path) {
  const { data, error } = await supabase.storage
    .from("comprobantes")
    .createSignedUrl(path, 60 * 60); // 1 hora, alcanza para ver/editar
  if (error) throw error;
  return data.signedUrl;
}

export async function eliminarComprobante(path) {
  if (!path) return;
  await supabase.storage.from("comprobantes").remove([path]); // best-effort
}
