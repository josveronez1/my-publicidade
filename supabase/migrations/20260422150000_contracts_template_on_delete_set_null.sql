-- Permitir remover modelos de contrato: contratos existentes ficam sem referência ao modelo.

alter table public.contracts drop constraint if exists contracts_template_id_fkey;

alter table public.contracts
  add constraint contracts_template_id_fkey
  foreign key (template_id)
  references public.contract_templates (id)
  on delete set null;
