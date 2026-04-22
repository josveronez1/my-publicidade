# Front-end — arquitetura

## Pastas (`src/`)

| Pasta | Papel |
|-------|--------|
| `presentation/` | `App.vue`, `views/`, `layouts/` — apenas UI e roteamento visual |
| `domain/` | Funções puras (slots, template, semáforo) + `*.spec.ts` |
| `composables/` | Orquestração (painéis públicos, mapa Leaflet, mapa admin do painel) |
| `infrastructure/geocoding/` | Nominatim (`GeocodingPort`); ver `docs/geocoding.md` |
| `stores/` | Pinia (ex.: `auth`) |
| `infrastructure/` | Supabase client, port `PaymentGatewayPort` (tipos gerados depois com `supabase gen types`) |
| `router/` | Definição de rotas e guards; fluxo de negócio de cliente em [`ClientHubView.vue`](../src/presentation/views/admin/ClientHubView.vue) em `/admin/clients/:id` (dados, painéis, contratos) |
| `assets/` | CSS global (`main.css`) com Tailwind v4 |

## Design system

- **Marca:** `#e7bb0e` (`mw-brand` no `@theme` do Tailwind).
- **Neutros:** escala `slate` para texto e bordas.
- **Admin:** sidebar + logo arredondada (`/mw-logo.jpg`).
- **Público:** `/` Media Kit sem sidebar de gestão.

## Testes

```bash
npm run test:run
```

Arquivos: `src/domain/*.spec.ts` (Vitest + jsdom).
