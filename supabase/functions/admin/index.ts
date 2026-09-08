// Edge Function "admin" — operaciones que tocan auth.users y requieren la
// service_role key (que NO puede vivir en la app estática):
//   - reset_password:   dispara el email de recuperación para un usuario
//   - set_password:      fija una contraseña nueva para un usuario
//   - eliminar_usuario:  borra la cuenta (cascade borra perfil + datos)
//
// El resto de la administración (listar, aprobar, roles, estadísticas) va
// por RPC security definer y no pasa por acá.
//
// Deploy:  supabase functions deploy admin
// El runtime inyecta SUPABASE_URL, SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY automáticamente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // 1. Identidad de quien llama, a partir de su JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "no autenticado" }, 401);

    // 2. ¿Es admin activo? (misma función que usan las políticas RLS)
    const { data: esAdmin, error: adminErr } = await userClient.rpc("es_admin", { uid: user.id });
    if (adminErr) return json({ error: adminErr.message }, 500);
    if (!esAdmin) return json({ error: "no autorizado" }, 403);

    // 3. Cliente con service_role para operar sobre auth.users.
    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const accion = String(body.accion ?? "");

    if (accion === "reset_password") {
      const email = String(body.email ?? "").trim();
      if (!email) return json({ error: "email requerido" }, 400);
      const opts = body.redirectTo ? { redirectTo: String(body.redirectTo) } : undefined;
      const { error } = await admin.auth.resetPasswordForEmail(email, opts);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (accion === "set_password") {
      const id = String(body.id ?? "");
      const password = String(body.password ?? "");
      if (!id || password.length < 8) {
        return json({ error: "id y contraseña (mínimo 8 caracteres) requeridos" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (accion === "eliminar_usuario") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id requerido" }, 400);
      if (id === user.id) return json({ error: "no puedes eliminar tu propia cuenta" }, 400);

      // No dejar el sistema sin ningún admin activo.
      const { data: objetivo } = await admin
        .from("perfiles")
        .select("rol,estado")
        .eq("id", id)
        .single();
      if (objetivo?.rol === "admin" && objetivo?.estado === "activo") {
        const { count } = await admin
          .from("perfiles")
          .select("id", { count: "exact", head: true })
          .eq("rol", "admin")
          .eq("estado", "activo");
        if ((count ?? 0) <= 1) {
          return json({ error: "debe quedar al menos un administrador activo" }, 400);
        }
      }

      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: `acción desconocida: ${accion}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
