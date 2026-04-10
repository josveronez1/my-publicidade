# Instruções para agentes (Cursor / IA)

Use este arquivo como **contexto fixo** ao trabalhar neste repositório. Complementa `.cursor/rules/*.mdc` e `docs/`.

## Produto

**MW Publicidade** — gestão de painéis LED indoor, contratos, propostas (quotes), área cliente e **Media Kit** público (`/`).

## Como rodar

```bash
npm install
cp .env.example .env   # preencher VITE_SUPABASE_*
npm run dev
```

Sempre **reinicie** o dev server após alterar variáveis `VITE_*`.

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

- Cliente browser: **somente anon key**; sessão JWT no cliente Supabase (`persistSession: true`).
- **`useAuthStore().initialize()`** deve rodar antes de confiar em `isAdmin` / `isClientUser`. Implementação usa **mutex** para evitar múltiplos `onAuthStateChange` se `initialize()` for chamado em paralelo (ex.: guards do router).
- Admin no banco = `public.profiles.role` ∈ `admin` | `super_admin` para o mesmo `id` que `auth.users.id`.

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
| Painéis / quotes | `docs/database.md`, `docs/geocoding.md`, views em `presentation/views/` |
| Mapa público | `useLeafletPublicMap.ts`, `MediaKitView.vue` |
