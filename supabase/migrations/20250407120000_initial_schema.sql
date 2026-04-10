-- MW Publicidade — schema inicial (ajustar em produção conforme docs/database.md)

create extension if not exists "pgcrypto";

-- Enums
create type public.user_role as enum ('super_admin', 'admin', 'client_user', 'viewer');
create type public.client_status as enum ('lead', 'active', 'inactive', 'churned');
create type public.panel_status as enum ('planning', 'installation', 'active', 'maintenance', 'inactive');
create type public.contract_status as enum (
  'draft', 'under_review', 'pending_signature', 'active', 'suspended',
  'renewal_pending', 'expired', 'cancelled'
);

-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  document_type text not null default 'cnpj',
  document_number text not null,
  state_registration text,
  municipal_registration text,
  email_commercial text,
  email_financial text,
  phone text,
  website text,
  address_line1 text,
  address_line2 text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  country text default 'BR',
  segment text,
  status public.client_status not null default 'active',
  payment_terms_days int default 30,
  credit_limit numeric(14,2),
  notes_internal text,
  account_manager_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (document_type, document_number)
);

-- Profiles (1:1 auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'client_user',
  client_id uuid references public.clients (id),
  is_active boolean not null default true,
  preferences jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients
  add constraint clients_account_manager_fk
  foreign key (account_manager_id) references public.profiles (id);

-- Site branding (single row)
create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  org_display_name text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (org_display_name) values ('MW Publicidade');

-- Panels
create table public.panels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  slug text not null unique,
  description text,
  target_audience text,
  panel_type text not null default 'indoor_led',
  status public.panel_status not null default 'active',
  address_line1 text,
  address_line2 text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  country text default 'BR',
  latitude double precision not null,
  longitude double precision not null,
  mapbox_place_id text,
  building_name text,
  floor text,
  timezone text not null default 'America/Sao_Paulo',
  orientation text default 'landscape',
  width_mm numeric,
  height_mm numeric,
  width_px int,
  height_px int,
  pixel_pitch_mm numeric,
  brightness_nits int,
  total_ad_slots int not null default 1 check (total_ad_slots > 0),
  slot_notes text,
  thumbnail_path text,
  gallery_paths jsonb default '[]',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contract templates
create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  version int not null default 1,
  body text not null,
  body_format text not null default 'markdown',
  placeholders_schema jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, version)
);

-- Contracts
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null unique,
  client_id uuid not null references public.clients (id),
  template_id uuid references public.contract_templates (id),
  template_version int,
  status public.contract_status not null default 'draft',
  title text,
  effective_start_date date not null,
  effective_end_date date not null,
  signed_at timestamptz,
  total_value numeric(14,2),
  currency text not null default 'BRL',
  billing_period text default 'monthly',
  payment_method text,
  payment_external_id text,
  gateway_subscription_id text,
  pdf_storage_path text,
  signed_pdf_storage_path text,
  form_snapshot jsonb,
  custom_clauses jsonb,
  manual_paid_at timestamptz,
  manual_payment_note text,
  dispute_flag boolean not null default false,
  health_override text,
  override_reason text,
  override_by uuid references public.profiles (id),
  override_at timestamptz,
  last_gateway_sync_at timestamptz,
  gateway_last_error text,
  created_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  cancelled_at timestamptz,
  cancellation_reason text,
  notes_internal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_end_date >= effective_start_date)
);

-- Contract ↔ Panel
create table public.contract_panels (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  panel_id uuid not null references public.panels (id),
  slots_used int not null default 1 check (slots_used > 0),
  start_date date,
  end_date date,
  share_of_voice_percent numeric(5,2),
  created_at timestamptz not null default now(),
  unique (contract_id, panel_id)
);

-- Quote requests (public insert with RLS)
create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  company text,
  message text,
  panel_ids jsonb,
  honeypot text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- Creative assets
create table public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  panel_id uuid references public.panels (id),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  valid_from date,
  valid_until date,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Gateway charges (F5)
create table public.gateway_charges (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  gateway text not null default 'mercadopago',
  external_id text,
  status text not null default 'pending',
  checkout_url text,
  amount_cents int,
  raw_payload jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contract number sequence per year
create table public.contract_number_seq (
  y int primary key,
  last_n int not null default 0
);

-- RPC: occupied slots on panel (public read for published panels)
create or replace function public.panel_slots_used_public(p_panel_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cp.slots_used), 0)::int
  from contract_panels cp
  join contracts c on c.id = cp.contract_id
  where cp.panel_id = p_panel_id
    and c.status = 'active'
    and current_date between c.effective_start_date and c.effective_end_date;
$$;

grant execute on function public.panel_slots_used_public(uuid) to anon, authenticated;

-- Updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated before update on public.clients
  for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger panels_updated before update on public.panels
  for each row execute function public.set_updated_at();
create trigger contract_templates_updated before update on public.contract_templates
  for each row execute function public.set_updated_at();
create trigger contracts_updated before update on public.contracts
  for each row execute function public.set_updated_at();
create trigger gateway_charges_updated before update on public.gateway_charges
  for each row execute function public.set_updated_at();

-- New user → profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'client_user'::public.user_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.panels enable row level security;
alter table public.site_settings enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_panels enable row level security;
alter table public.quote_requests enable row level security;
alter table public.creative_assets enable row level security;
alter table public.gateway_charges enable row level security;

-- Helper: is admin
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
      and p.is_active = true
  );
$$;

create or replace function public.is_client_of(c_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.client_id = c_id
      and p.is_active = true
  );
$$;

-- Profiles
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- Clients
create policy clients_all_admin on public.clients
  for all using (public.is_admin()) with check (public.is_admin());
create policy clients_select_own on public.clients
  for select using (public.is_client_of(id));

-- Panels: public read published
create policy panels_select_public on public.panels
  for select to anon, authenticated
  using (is_published = true);
create policy panels_all_admin on public.panels
  for all using (public.is_admin()) with check (public.is_admin());

-- Site settings: public read org name, admin write
create policy site_settings_read on public.site_settings
  for select to anon, authenticated using (true);
create policy site_settings_admin on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Templates admin only
create policy contract_templates_admin on public.contract_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- Contracts
create policy contracts_admin on public.contracts
  for all using (public.is_admin()) with check (public.is_admin());
create policy contracts_client_read on public.contracts
  for select using (public.is_client_of(client_id));

-- Contract panels
create policy contract_panels_admin on public.contract_panels
  for all using (public.is_admin()) with check (public.is_admin());
create policy contract_panels_client_read on public.contract_panels
  for select using (
    exists (
      select 1 from public.contracts c
      where c.id = contract_id and public.is_client_of(c.client_id)
    )
  );

-- Quote: anon insert if honeypot empty (checked in app too)
create policy quote_insert_anon on public.quote_requests
  for insert to anon, authenticated
  with check (honeypot is null or honeypot = '');
create policy quote_admin on public.quote_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- Creative assets
create policy creative_admin on public.creative_assets
  for all using (public.is_admin()) with check (public.is_admin());
create policy creative_client_read on public.creative_assets
  for select using (
    exists (
      select 1 from public.contracts c
      where c.id = contract_id and public.is_client_of(c.client_id)
    )
  );

-- Gateway
create policy gateway_admin on public.gateway_charges
  for all using (public.is_admin()) with check (public.is_admin());
create policy gateway_client_read on public.gateway_charges
  for select using (
    exists (
      select 1 from public.contracts c
      where c.id = contract_id and public.is_client_of(c.client_id)
    )
  );

-- Slot capacity: enforced in application layer + tests (see domain/slots.ts);
-- DB trigger omitted to avoid edge cases when contract status/vigência changes.
