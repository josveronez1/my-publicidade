-- PDFs de contrato — políticas no bucket `contract-pdfs`.
-- O bucket é criado em `20260422160000_storage_create_contract_pdfs_bucket.sql` (ou manualmente no Dashboard).

create policy contract_pdfs_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contract-pdfs' and public.is_admin());

create policy contract_pdfs_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'contract-pdfs' and public.is_admin())
  with check (bucket_id = 'contract-pdfs' and public.is_admin());

create policy contract_pdfs_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'contract-pdfs' and public.is_admin());

create policy contract_pdfs_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'contract-pdfs' and public.is_admin());
