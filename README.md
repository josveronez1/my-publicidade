# MW Publicidade — gestão

Vue 3 + Vite + Tailwind + Pinia + Supabase + Leaflet (Media Kit, tiles Carto Positron — sem token). Ver [docs/index.md](docs/index.md).

## Requisitos

- Node 20+
- Projeto Supabase (PostgreSQL + Auth)

## Setup

```bash
cp .env.example .env
# Edite .env: cole a anon key (Settings → API). A URL do projeto já vem preenchida no .env.example.
npm install
npm run dev
```

O mapa público usa tiles raster gratuitos (uso razoável; tráfego muito alto pode exigir tile server próprio).

### Geocodificação (painéis no admin)

O cadastro de painel usa **Nominatim** (OpenStreetMap) para posicionar o pin a partir do endereço — sem variável de ambiente. Respeite [a política de uso](https://operations.osmfoundation.org/policies/nominatim/) (requisições moderadas; User-Agent identificável no código). Detalhes em [docs/geocoding.md](docs/geocoding.md).

### Connection string (Postgres)

O painel mostra algo como `postgresql://postgres:[PASSWORD]@db.czfuzguxcjjgvuvlmhnh.supabase.co:5432/postgres`. Use isso **só em ferramentas locais** (nunca no front e nunca em commit). Se aparecer **“Not IPv4 compatible”**, use a URI do **Session pooler** (mesma tela de Database no Supabase) para redes só IPv4.

### Skills Supabase no Cursor (opcional)

Para o agente ter instruções prontas do Supabase:

```bash
npx skills add supabase/agent-skills
```

Aplique as migrations no Supabase (SQL Editor ou CLI):

```bash
supabase db push
# ou copie o conteúdo de supabase/migrations/*.sql
```

### Primeiro administrador

1. Crie usuário em Authentication (ou pela tela de login após signup, se habilitado).
2. No SQL Editor:

```sql
update public.profiles set role = 'admin' where id = '<uuid do usuário>';
```

### Logo

Arquivo estático: [public/mw-logo.jpg](public/mw-logo.jpg).

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build produção |
| `npm run test:run` | Vitest (domínio) |
| `npm run preview` | Preview do build |

## Edge Function (PDF)

Esqueleto em `supabase/functions/generate-contract-pdf/`. Deploy com Supabase CLI quando for implementar HTML→PDF.

## Operacional (cliente no centro)

No admin, o cadastro de **cliente** concentra dados, prazos de pagamento, painéis e **contratos como anexos** (`/admin/clients/:id`). O gerador de PDF (quando ativo) não altera a contagem de vagas do mapa — ver [docs/user-flows.md](docs/user-flows.md).

## Pagamentos (Fase 5)

A app usa `PaymentGatewayStub` ao **ativar** contrato (quando a UI global de listagem existir; o registo cria-se a partir da ficha do cliente). Troque pela implementação Mercado Pago em Edge Function conforme [docs/integracao-pagamentos.md](docs/integracao-pagamentos.md).

## Upload de criativos

UI de upload na área do cliente fica como próximo passo; tabela `creative_assets` e RLS já estão na migration.
