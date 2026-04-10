-- Auto-generate panels.code (simple sequence) as PNL-000001

create sequence if not exists public.panel_code_seq;

create or replace function public.next_panel_code()
returns text
language sql
volatile
set search_path = public
as $$
  select 'PNL-' || lpad(nextval('public.panel_code_seq')::text, 6, '0');
$$;

alter table public.panels
  alter column code set default public.next_panel_code();

