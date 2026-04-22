-- Associação N:N: quais painéis estão vinculados ao cadastro do cliente (comercial/operacional).
-- Distinto de public.contract_panels, que liga contrato vigente a painéis e slots.

create table public.client_panels (
  client_id uuid not null references public.clients (id) on delete cascade,
  panel_id uuid not null references public.panels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, panel_id)
);

create index client_panels_panel_id_idx on public.client_panels (panel_id);

alter table public.client_panels enable row level security;

-- Operacional MW; sem leitura anônima. Cliente final não usa app logado.
create policy client_panels_all_admin on public.client_panels
  for all using (public.is_admin()) with check (public.is_admin());
