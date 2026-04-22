# Trackeamento de entrega — MW Publicidade

Arquivo vivo: **atualize os status** ao concluir itens. Baseado em `docs/user-flows.md`, `docs/audit-and-roadmap.md` e no plano por fases do produto.

**Legenda de status**


| Símbolo | Significado                                            |
| ------- | ------------------------------------------------------ |
| ✅       | Concluído                                              |
| 🟨      | Parcial (existe base, falta fechar fluxo ou qualidade) |
| ⬜       | Pendente / não iniciado                                |


---

## Operação e ambiente (bloqueadores comuns)


| ID     | Item                                                                           | Status | Notas                              |
| ------ | ------------------------------------------------------------------------------ | ------ | ---------------------------------- |
| OPS-01 | `.env` com `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` do **mesmo** projeto | ⬜      | Quem deploya confirma              |
| OPS-02 | Migrations aplicadas no projeto Supabase (`db push` ou SQL)                    | ⬜      | `supabase/migrations/*.sql`        |
| OPS-03 | Primeiro usuário admin (`profiles.role` = `admin` ou `super_admin`)            | ⬜      | Dashboard ou SQL                   |
| OPS-04 | Media Kit: mapa Leaflet (tiles públicos, sem variável de token)               | ✅      | Carto Positron + OSM attribution   |
| OPS-05 | CI (Vitest/build) verde no repositório                                         | 🟨     | Validar `.github/workflows/ci.yml` |


---

## Fase 0 — Fundação do repositório


| ID    | Item                                                                                  | Status | Notas                           |
| ----- | ------------------------------------------------------------------------------------- | ------ | ------------------------------- |
| F0-01 | Vue 3 + Vite + TypeScript + Tailwind v4                                               | ✅      |                                 |
| F0-02 | Pinia + Vue Router                                                                    | ✅      |                                 |
| F0-03 | Estrutura Clean (`presentation`, `domain`, `composables`, `stores`, `infrastructure`) | ✅      |                                 |
| F0-04 | Vitest + testes de domínio mínimos                                                    | 🟨     | Poucos `*.spec.ts`              |
| F0-05 | `.cursor/rules/*.mdc` + `AGENTS.md`                                                   | ✅      | + `auth-and-data-mutations.mdc` |
| F0-06 | `/docs` índice + README de execução                                                   | ✅      |                                 |


---

## Fase 1 — Dados core + Auth + layout admin


| ID    | Item                                                                          | Status | Notas                                |
| ----- | ----------------------------------------------------------------------------- | ------ | ------------------------------------ |
| F1-01 | Migration: `clients`, `profiles`, `panels`, enums, triggers `handle_new_user` | ✅      |                                      |
| F1-02 | RLS base (`is_admin`, `is_client_of`, políticas documentadas)                 | ✅      | `docs/database.md`                   |
| F1-03 | Login `/login` + guard `requiresAdmin` (sem portal do anunciante)            | ✅      | Conta só equipe MW                  |
| F1-07 | CRUD clientes no admin (`/admin/clients`)                                     | ✅      | `ClientsListView` + `ClientFormView`            |
| F1-08 | Ficha cliente como hub (dados / painéis / contratos)                            | ✅      | `ClientHubView.vue`; `/clients/:id/contracts/new` |
| F1-04 | Store `auth` + sessão Supabase                                                | ✅      | Mutex em `initialize()`              |
| F1-05 | Layout admin (sidebar, navegação)                                             | ✅      | `AdminLayout.vue`                    |
| F1-06 | Sign-up / recuperação de senha na UI                                          | ⬜      | Hoje: usuário via Supabase Dashboard |


---

## Fase 2 — Painéis + Media Kit público


| ID    | Item                                                 | Status | Notas                                   |
| ----- | ---------------------------------------------------- | ------ | --------------------------------------- |
| F2-01 | Lista + criar/editar painel (`/admin/panels`)        | ✅      | `PanelFormView` com validações recentes |
| F2-02 | Publicação `is_published` + leitura pública na lista | ✅      | `usePublicPanels`                       |
| F2-03 | Mapa Leaflet + marcadores por status                 | ✅      | `useLeafletPublicMap`                   |
| F2-04 | Layout responsivo do mapa (grid / resize)            | ✅      | Ajustes em `MediaKitView`               |
| F2-05 | RPC `panel_slots_used_public` no Media Kit           | ✅      | + migration `20260422120000_*` (CRM + contrato) |
| F2-06 | Upload de foto/thumbnail do painel (Storage + RLS)   | ⬜      | Campo existe no schema; UI não no form  |
| F2-07 | Galeria de imagens (`gallery_paths`) na UI           | ⬜      |                                         |


---

## Fase 3 — Propostas + contratos + templates


| ID    | Item                                                        | Status | Notas                                                    |
| ----- | ----------------------------------------------------------- | ------ | -------------------------------------------------------- |
| F3-01 | Formulário “Solicitar proposta” + insert `quote_requests`   | 🟨     | Funciona se RLS/env OK; honeypot ajustado                |
| F3-02 | Lista de propostas no admin (`/admin/quotes`)               | 🟨     | Leitura; workflow status limitado                        |
| F3-03 | CRUD / lista `contract_templates`                           | 🟨     | `TemplatesListView` básico                               |
| F3-04 | Novo contrato: vigência, `contract_panels` (só a partir da ficha) | 🟨     | `ContractFormView` em `/clients/:id/contracts/new`         |
| F3-05 | Número de contrato (`next_contract_number`)                 | ✅      | Migration `20250407120100_*`                             |
| F3-06 | Lista contratos admin + ações (ativar, stub gateway)        | 🟨     | `ContractsListView`                                      |
| F3-07 | Geração/deploy PDF real (Edge Function + Storage)           | ⬜      | Esqueleto em `supabase/functions/generate-contract-pdf/` |
| F3-08 | Dashboard admin com contagens                               | 🟨     | `AdminDashboardView` (counts)                            |


---

## Fase 4 — Anunciante (sem login na app)


Decisão de produto: **o anunciante não tem área logada**. Contratos, propostas e cobrança chegam por **e-mail e links** (PDF, checkout, etc.). Código legado `ClientLayout` / `ClientHomeView` fica fora de rota; `/client` redireciona ao Media Kit.


| ID    | Item                                                       | Status | Notas                                               |
| ----- | ---------------------------------------------------------- | ------ | --------------------------------------------------- |
| F4-01 | ~~Portal `/client`~~ — não faz parte do escopo            | ⬛     | Redirecionamento; preferir entrega por link/e-mail  |
| F4-02 | Links de proposta / cobrança / PDF para o cliente         | ⬜      | Edge, Storage, e-mail; ver Fase 3 e 5               |
| F4-03 | Upload de criativos fora de portal (e-mail, link, admin)  | ⬜      | RLS `creative_assets`; UI admin futura se necessário |
| F4-04 | E-mail transacional (proposta, lembrete, confirmação)    | ⬜      |                                                     |
| F4-05 | (Removida) notificações in-app                            | ⬛     | —                                                  |


---

## Fase 5 — Pagamentos reais + webhooks


| ID    | Item                                                                      | Status | Notas                  |
| ----- | ------------------------------------------------------------------------- | ------ | ---------------------- |
| F5-01 | Porta abstraída `PaymentGatewayPort` + stub                               | 🟨     | Domínio/infra parcial  |
| F5-02 | Implementação Mercado Pago (ou outro) conforme `integracao-pagamentos.md` | ⬜      |                        |
| F5-03 | Webhooks + reconciliação + `gateway_charges`                              | ⬜      |                        |
| F5-04 | Cancelamento / semáforo de cobrança                                       | ⬜      | Documentado em `docs/` |


---

## Fase A — Confiabilidade (roadmap auditoria)


| ID   | Item                                                            | Status | Notas                      |
| ---- | --------------------------------------------------------------- | ------ | -------------------------- |
| A-01 | Mutex `auth.initialize()`                                       | ✅      | `src/stores/auth.ts`       |
| A-02 | Padrão único de mutação (`useSupabaseMutation` ou services)     | ⬜      | Reduz bugs de loading/erro |
| A-03 | Página ou painel “Status / debug” (dev) — sessão, role, ping DB | ⬜      |                            |
| A-04 | `supabase gen types` → `database.types.ts` e uso nos forms      | ⬜      |                            |
| A-05 | Mensagens de erro RLS/rede amigáveis (mapa de códigos)          | ⬜      |                            |


---

## Fase B — Produto mínimo utilizável


| ID   | Item                                                 | Status | Notas                                      |
| ---- | ---------------------------------------------------- | ------ | ------------------------------------------ |
| B-01 | Sign-up ou convite documentado na UI                 | ⬜      |                                            |
| B-02 | Paginação / busca nas listagens admin                | ⬜      |                                            |
| B-03 | LGPD: texto + checkbox no quote (se jurídico exigir) | ⬜      | Mencionado em `user-flows.md`              |
| B-04 | `site_settings` na UI admin                         | ⬛      | Removido: produto fixo MW; nome no Media Kit hardcoded |


---

## Fase C — Qualidade e performance


| ID   | Item                                                  | Status | Notas        |
| ---- | ----------------------------------------------------- | ------ | ------------ |
| C-01 | Testes de integração / contrato API (mock ou staging) | ⬜      |              |
| C-02 | Lazy-load mapa na rota `/` (Leaflet já é leve)        | ⬜      | Opcional |
| C-03 | E2E (ex.: Playwright): login + criar painel           | ⬜      |              |
| C-04 | Monitoramento / logs estruturados (opcional Sentry)   | ⬜      |              |


---

## Resumo numérico (estimativa)

- **Concluídos (✅):** ~22 itens explícitos  
- **Parciais (🟨):** ~14 itens  
- **Pendentes (⬜):** ~24 itens

*(Ajuste estes números quando marcar linhas acima.)*

---

## Como manter este arquivo

1. Ao fechar uma tarefa, troque 🟨/⬜ por ✅ e acrescente uma nota curta na coluna **Notas** se útil.
2. Se o plano mudar, adicione linhas com novo **ID** (ex.: `F3-09`) em vez de apagar histórico.
3. Referência de contexto: `**docs/audit-and-roadmap.md`**.

