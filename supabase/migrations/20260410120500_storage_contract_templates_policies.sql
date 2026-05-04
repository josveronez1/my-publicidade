-- Políticas RLS Storage para logos de modelo de contrato (bucket contract-templates).
-- Crie o bucket público ou privado com o nome contract-templates no Supabase Dashboard (Storage).

create policy contract_templates_logo_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contract-templates' and public.is_admin());

create policy contract_templates_logo_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'contract-templates' and public.is_admin())
  with check (bucket_id = 'contract-templates' and public.is_admin());

create policy contract_templates_logo_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'contract-templates' and public.is_admin());

create policy contract_templates_logo_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'contract-templates' and public.is_admin());
