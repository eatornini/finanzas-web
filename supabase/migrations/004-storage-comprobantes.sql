-- 004 — Bucket de Storage para imágenes de comprobantes (Fase 4b).
-- Correr una sola vez en el SQL Editor de Supabase.

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- Cada usuario solo ve/escribe archivos bajo su propia carpeta
-- ({user_id}/...), igual criterio que las tablas con RLS por auth.uid().
create policy "comprobantes_select_propio" on storage.objects for select
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comprobantes_insert_propio" on storage.objects for insert
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comprobantes_update_propio" on storage.objects for update
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comprobantes_delete_propio" on storage.objects for delete
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
