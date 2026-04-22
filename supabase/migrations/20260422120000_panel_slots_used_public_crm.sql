-- Vagas visíveis no Media Kit: soma de slots em contrato ativo (vigência corrente)
-- mais vínculos client_panels sem cobertura do mesmo par cliente+painel num contrato ativo
-- (evita duplicar CRM + contrato).

create or replace function public.panel_slots_used_public(p_panel_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with
  a as (
    select coalesce(sum(cp.slots_used), 0)::int as n
    from contract_panels cp
    join contracts c on c.id = cp.contract_id
    where cp.panel_id = p_panel_id
      and c.status = 'active'
      and current_date between c.effective_start_date and c.effective_end_date
  ),
  b as (
    select count(*)::int as n
    from client_panels j
    where j.panel_id = p_panel_id
      and not exists (
        select 1
        from contract_panels cp2
        join contracts c2 on c2.id = cp2.contract_id
        where cp2.panel_id = j.panel_id
          and c2.client_id = j.client_id
          and c2.status = 'active'
          and current_date between c2.effective_start_date and c2.effective_end_date
      )
  )
  select (select n from a) + (select n from b);
$$;

comment on function public.panel_slots_used_public(uuid) is
'Slots ocupados exibidos no mapa: contratos ativos (contract_panels) + vínculos em client_panels sem duplicar o par cliente-painel já coberto por contrato ativo.';

grant execute on function public.panel_slots_used_public(uuid) to anon, authenticated;
