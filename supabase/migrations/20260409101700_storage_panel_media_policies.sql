-- Storage policies for panel photos in bucket `panel-media`
-- NOTE: bucket creation is done in Supabase dashboard; this migration only sets RLS policies.

-- Admin full control
create policy panel_media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'panel-media' and public.is_admin());

create policy panel_media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'panel-media' and public.is_admin())
  with check (bucket_id = 'panel-media' and public.is_admin());

create policy panel_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'panel-media' and public.is_admin());

-- Public read (anon/authenticated) only when referenced by a published panel
create policy panel_media_public_select_if_referenced on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'panel-media'
    and exists (
      select 1
      from public.panels p
      where p.is_published = true
        and (
          p.thumbnail_path = storage.objects.name
          or (p.gallery_paths ? storage.objects.name)
        )
    )
  );

