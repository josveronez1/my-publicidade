-- Add panel dimensions (meters) for Media Kit and admin

alter table public.panels
  add column if not exists width_m numeric(6,2),
  add column if not exists height_m numeric(6,2);

