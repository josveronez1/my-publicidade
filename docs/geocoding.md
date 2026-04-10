# Geocodificação (cadastro de painéis)

O admin usa **Nominatim** (OpenStreetMap) para converter endereço em latitude/longitude e exibir um rótulo aproximado (reverse). Não é necessária API key.

## Política de uso

- Documentação oficial: [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).
- A app envia um **User-Agent** identificando o cliente (`gestao-mw-publi/1.0 (panel admin geocoding)` em [`src/infrastructure/geocoding/nominatim.ts`](../src/infrastructure/geocoding/nominatim.ts)). Em produção, mantenha um contato válido se a OSM solicitar.
- O front faz **debounce** (≈900 ms) após alteração do endereço e **cache em memória** por query na sessão para reduzir requisições.
- Tráfego muito alto pode exigir **instância própria** do Nominatim ou outro provedor; a interface [`GeocodingPort`](../src/infrastructure/geocoding/GeocodingPort.ts) permite trocar a implementação.

## Atribuição

Resultados vêm de dados **© OpenStreetMap**. O Media Kit já exibe atribuição dos tiles (OSM + CARTO).

## Código

- Cliente: `src/infrastructure/geocoding/nominatim.ts`
- Mapa admin (pin): `src/composables/useAdminPanelMap.ts`
- UI: `src/presentation/views/admin/PanelFormView.vue`
