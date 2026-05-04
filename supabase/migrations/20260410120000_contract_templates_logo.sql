-- Logo opcional do modelo (bucket `contract-templates` — criar no dashboard se não existir).
alter table public.contract_templates
  add column if not exists logo_storage_path text;

comment on column public.contract_templates.logo_storage_path is 'Caminho no Storage (bucket contract-templates); ex.: templates/<id>/logo.png';

