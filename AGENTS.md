# Instruções para agentes (Cursor / IA)

Use este arquivo como **contexto fixo** ao trabalhar neste repositório. Complementa `.cursor/rules/*.mdc` e `docs/`.

## Produto

**MW Publicidade** — gestão de painéis LED indoor, **cadastro de clientes (anunciantes) como eixo central** (ficha com dados, prazos de pagamento, painéis e contratos anexos), propostas (quotes) e **Media Kit** público (`/`). **Login** é só para a equipe MW; o anunciante **não** tem conta na aplicação (recebe propostas/arquivos por e-mail e links). Contratos no app são **registos ligados ao cliente**; o **gerador de PDF** (modelos/Edge) só emite documento e **não** altera regras de vagas ou RPCs.

## Como rodar

```bash
npm install
cp .env.example .env   # preencher VITE_SUPABASE_*
npm run dev
```

Sempre **reinicie** o dev server após alterar variáveis `VITE_*`.

## Deploy (Vercel)

- Preset Vite: **Output** `dist`, **Build** `npm run build` (padrão).
- Raiz do repo contém `vercel.json` com **rewrite** de todas as rotas para `index.html`, para o Vue Router (history mode) não devolver 404 em `/admin`, `/login`, etc. Ficheiros estáticos do build continuam a ser servidos em primeiro lugar.
- Definir no projeto Vercel as mesmas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do `.env` local (mesmo projecto Supabase).

## Arquitetura (resumo)

| Caminho | Uso |
|---------|-----|
| `src/presentation/` | Views Vue, layouts — **evitar** lógica pesada e evitar importar Leaflet/Supabase direto nos SFC quando a regra `vue-presentation-layer` proíbe |
| `src/composables/` | Orquestração, dados públicos, mapa |
| `src/stores/` | Pinia — **`auth`** é crítico |
| `src/infrastructure/` | `supabaseClient.ts`, ports |
| `src/domain/` | Funções puras + testes Vitest |
| `supabase/migrations/` | Verdade do schema; manter `docs/database.md` alinhado |

## Auth e sessão (crítico)

- Cliente browser: **somente anon key**; sessão JWT no cliente Supabase (`persistSession: true` + `localStorage` por defeito — sessão persiste entre recarregamentos até expirar ou *logout*).
- **`useAuthStore().initialize()`** deve rodar antes de confiar em `isAdmin` / `isClientUser` (o segundo pode existir no schema, mas a UI de login **não** encaminha para portal de cliente). Implementação usa **mutex** para evitar múltiplos `onAuthStateChange` se `initialize()` for chamado em paralelo (ex.: guards do router).
- Admin no banco = `public.profiles.role` ∈ `admin` | `super_admin` para o mesmo `id` que `auth.users.id`. Utilizador autenticado que não for admin vê recusa e *logout* em `/login`.

## RLS e “não salva”

Se insert/update falhar:

1. Conferir mensagem de erro do Supabase (UI ou `console.error`).
2. Conferir política em `docs/database.md` e migration.
3. Conferir se o usuário é realmente admin (`profiles`).
4. Conferir se URL + anon key são do **mesmo** projeto.

## Padrões obrigatórios para novas features

1. **Mutações**: `try` / `finally` (ou helper) para **sempre** limpar `loading`; exibir `error.message` ao usuário quando fizer sentido.
2. **Novas tabelas**: migration + RLS + atualização de `docs/database.md`.
3. **Sem service_role no front**.

## Documentação obrigatória ao mudar comportamento

- Schema / RLS → `docs/database.md`
- Fluxo de usuário → `docs/user-flows.md`
- Visão de alto nível de gaps → `docs/audit-and-roadmap.md`
- Trackeamento de entrega (checklist) → `docs/TRACKING.md`

## Leitura recomendada por tarefa

| Tarefa | Ler primeiro |
|--------|----------------|
| Login / sessão / guards | `src/stores/auth.ts`, `src/router/index.ts` |
| Painéis / quotes / clientes | `docs/database.md`, `docs/user-flows.md`, `docs/geocoding.md`, ficha cliente em `presentation/views/admin/ClientHubView.vue` |
| Mapa público | `useLeafletPublicMap.ts`, `MediaKitView.vue` |
