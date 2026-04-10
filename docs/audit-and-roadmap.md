# Auditoria do projeto — o que existe, o que falha e próximos passos

Documento de alinhamento após feedback de instabilidade (login admin, salvamentos, fluxo “cliente” no Media Kit). Serve como **fonte única** para planejamento e para agentes de IA trabalharem sem reinventar o contexto.

---

## 1. Resumo executivo (franco)

O repositório é um **scaffold avançado**: schema Supabase sólido (migrations, RLS, enums), rotas admin/cliente/público, telas Vue para CRUD parcial, Media Kit com Leaflet (tiles públicos), documentação em `/docs`. Porém o **produto ainda não é “confiável para uso diário”** porque:

1. **Operação** — `.env` errado (URL/anon key), migrations não aplicadas no projeto remoto, ou `profiles.role` sem `admin` geram falhas que parecem “bug da app”.
2. **Front-end** — grande parte das mutações está **direto nas views** (`getSupabase()` + `insert/update`), sem camada única de erro/loading, sem testes de integração contra API real.
3. **Auth** — havia **condição de corrida** em `auth.initialize()`: navegações paralelas podiam registrar **vários** `onAuthStateChange`, com sessão/perfil inconsistentes e comportamento “às vezes funciona”. **Corrigido** com mutex em `src/stores/auth.ts` (ver changelog implícito no código).

A sensação de “feito de qualquer jeito” vem sobretudo da **falta de uma camada de acesso a dados** e de **observabilidade** (mensagens de erro genéricas, poucos logs estruturados), não da ausência total de arquitetura.

---

## 2. Inventário — o que já foi feito

### 2.1 Banco e Supabase

| Área | Estado | Onde |
|------|--------|------|
| Tabelas core | Feito | `supabase/migrations/20250407120000_initial_schema.sql` — clients, profiles, panels, contracts, quote_requests, creative_assets, gateway_charges, site_settings, templates, contract_panels |
| RLS | Feito | Políticas admin/cliente/anônimo em `database.md` e migration |
| Funções auxiliares | Feito | `is_admin()`, `is_client_of()`, RPC `panel_slots_used_public`, trigger `handle_new_user` → `profiles` |
| Storage / Edge PDF | Parcial | Função Edge esqueleto em `supabase/functions/generate-contract-pdf/` |

### 2.2 Front-end (Vue)

| Área | Estado | Observação |
|------|--------|------------|
| Router + guards | Feito | `requiresAdmin` / `requiresClient`; `initialize()` antes dos guards |
| Auth store | Feito + **fix** | Mutex em `initialize()` |
| Media Kit `/` | Feito | Mapa Leaflet, lista painéis publicados, formulário quote |
| Admin | Parcial | Dashboard, painéis (lista + form), clientes, contratos, propostas, modelos, settings |
| Cliente | Mínimo | Layout + home |
| Login | Só entrada | Sem sign-up na UI; usuários via Dashboard Supabase ou futuro fluxo |
| Domain puro | Parcial | `templateMerge`, slots — poucos testes |
| Testes automatizados | Fraco | Sobretudo `domain/*.spec.ts`; sem E2E |

### 2.3 Documentação

- `docs/index.md` — índice
- `docs/database.md` — RLS, tabelas
- `docs/user-flows.md` — fluxos desejados
- `docs/front-end.md` — pastas
- `docs/integracao-pagamentos.md` — desenho futuro
- `.cursor/rules/*.mdc` — convenções (ampliado com regra de auth/mutações)

### 2.4 CI / tooling

- GitHub Actions / Vitest conforme `package.json` e `.github/workflows/ci.yml` (validar localmente se necessário)

---

## 3. O que está bem estruturado

- **Separação de pastas** (`presentation`, `domain`, `composables`, `stores`, `infrastructure`) alinhada ao README e `front-end.md`.
- **Schema SQL** pensado para o negócio (painéis, slots, contratos, quotes, gateway).
- **RLS** explícito — correto para BaaS; força o mental model “anon + policies”.
- **Regras Cursor** existentes (foundations, Vue, TS/domain, Supabase, design) dão baseline clara.

---

## 4. O que está fraco ou “meia-boca”

| Problema | Impacto |
|----------|---------|
| Mutations espalhadas nas views | Duplicação, `try/finally` inconsistente, difícil garantir UX de erro |
| Sem camada `repositories/` ou `services/` | Testar sem mockar componente inteiro é penoso |
| Sem tipos gerados `supabase gen types` | Erros de coluna só em runtime |
| Sem fluxo de signup / recuperação de senha | Operação manual pelo Dashboard |
| Bundle da home | Leaflet é leve; lazy-load da rota `/` segue opcional |
| Pouca telemetria | Usuário não vê *por que* falhou (RLS vs rede vs validação) |

---

## 5. Por que “não salva” / login instável — causas prováveis

1. **Projeto Supabase diferente do `.env`** — key/URL de outro projeto → 401 ou RLS “estranho”.
2. **Migrations não aplicadas** — tabelas/policies inexistentes → erros genéricos.
3. **`profiles.role` ≠ admin** — usuário autenticado mas `is_admin()` falso → insert/update negados.
4. **Corrida em `initialize()`** — **mitigado** com mutex; após deploy, retestar login e admin.
5. **Validação de dados** — slug único, code único, coordenadas; erros PostgREST precisam ser mostrados (já melhorado em painel/quote em commits recentes).
6. **Quote / honeypot RLS** — política exige `honeypot is null or ''`; insert deve mandar `honeypot: null` explicitamente (ajustado no Media Kit).

Checklist operacional recomendado (humano):

- [ ] `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do **mesmo** projeto (Settings → API).
- [ ] Rodar migrations no projeto (`supabase db push` ou SQL Editor).
- [ ] Usuário admin: `profiles.role` in (`admin`,`super_admin`) para o `auth.users.id` correto.
- [ ] Reiniciar `npm run dev` após mudar `.env`.

---

## 6. Roadmap sugerido (ordem prática)

### Fase A — Confiabilidade (curto prazo)

1. Manter **mutex** de auth (feito).
2. Extrair **`useSupabaseMutation`** ou serviços `panelsService.save`, `quotesService.submit` com padrão único: loading, erro, mensagem.
3. Página **“Status / debug”** (só dev ou flag) mostrando sessão, `user.id`, `profile.role`, ping `select 1` — reduz suporte cego.
4. Regenerar **`database.types.ts`** e usar nos inserts.

### Fase B — Produto mínimo utilizável

1. Sign-up opcional ou fluxo documentado + convite.
2. Listagens admin com paginação e filtros básicos.
3. Tratamento de erro RLS com texto amigável (“sem permissão — fale o administrador”).

### Fase C — Qualidade

1. Testes de contrato contra PostgREST mock ou projeto de staging.
2. Lazy-load do chunk do mapa na rota `/` (opcional; Leaflet já reduz peso vs Mapbox).
3. E2E (Playwright) para login + criar painel.

---

## 7. Conclusão

O projeto **não é lixo estrutural**: a base de dados e a separação de pastas são sérias. O que faltava era **endurecer o caminho feliz do front** (auth, mutações, feedback) e **alinhar ambiente** (Supabase + RLS + role admin). Este documento e `AGENTS.md` + regras Cursor novas existem para **não repetir** o mesmo improviso nas próximas features.
