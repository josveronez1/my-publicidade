# Banco de dados e RLS (Supabase)

## Migrations

Ordem em `supabase/migrations/`:

1. `20250407120000_initial_schema.sql` — enums, tabelas, RLS, `panel_slots_used_public`, trigger perfil em `auth.users`.
2. `20250407120100_contract_number_fn.sql` — `next_contract_number()`.
3. `20260409120000_client_panels.sql` — tabela N:N `client_panels` (cadastro de cliente ↔ painéis), política só admin.
4. `20260422120000_panel_slots_used_public_crm.sql` — redefine `panel_slots_used_public`: soma slots de **contratos ativos** na vigência **mais** vínculos `client_panels` cujo par cliente+painel **não** está já coberto por contrato ativo (evita duplicar CRM com regulamento legal na mesma linha).

## Tabelas principais

- `clients`, `profiles` (FK `auth.users`), `panels`, `site_settings` (dados legados; o app não expõe mais tela admin para editar `org_display_name`)
- `client_panels` — N:N `clients` ↔ `panels` (cadastro comercial no admin; alimenta o mapa público em conjunto com `contract_panels` — ver `panel_slots_used_public`)
- `contract_templates`, `contracts`, `contract_panels`
- `quote_requests`, `creative_assets`, `gateway_charges`
- `contract_number_seq` — sequência por ano para `MW-AAAA-NNNN`

## RLS (resumo)

| Tabela | anon | authenticated cliente | admin |
|--------|------|----------------------|-------|
| `panels` | SELECT se `is_published` | — | ALL |
| `site_settings` | SELECT | SELECT | ALL |
| `quote_requests` | INSERT (honeypot vazio) | idem | ALL |
| `client_panels` | — | — | ALL (admin) |
| `contracts` | — | SELECT próprio `client_id` | ALL |
| Demais operacionais | — | conforme política | `is_admin()` |

Funções `SECURITY DEFINER`: `is_admin()`, `is_client_of(uuid)`, `panel_slots_used_public`, `next_contract_number`, `handle_new_user`.

### `panel_slots_used_public(panel_id)`

Usada pelo Media Kit (anon). Retorna número inteiro de **vagas ocupadas** exibidas: (1) soma de `contract_panels.slots_used` em contratos `active` com data corrente entre início e fim de vigência; (2) **+** uma unidade por linha em `client_panels` para aquele painel quando o mesmo par (`client_id`, `panel_id`) **não** tem cobertura em (1). O gerador de PDF / templates **não** altera esta função.

## Storage (a criar no painel Supabase)

Buckets sugeridos:

- `panel-media` — fotos dos painéis (público leitura para paths referenciados em painéis publicados).
- `contracts-pdf` — PDFs gerados (privado; URLs assinadas ou via RLS storage policies).
- `creative-assets` — mídias do cliente.

Políticas de storage devem espelhar RLS das tabelas.

## Primeiro usuário admin

Após o primeiro cadastro:

```sql
update public.profiles set role = 'admin' where id = '<uuid do auth.users>';
```
