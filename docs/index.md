# MW Publicidade — Documentação

## Visão geral

- [README do produto](../README.md) — como rodar, variáveis, primeiro admin.
- [Auditoria e roadmap](audit-and-roadmap.md) — o que está pronto, gaps, causas de instabilidade, próximos passos.
- [Trackeamento de entrega](TRACKING.md) — checklist por fase: feito, parcial, pendente.
- [AGENTS.md](../AGENTS.md) — contexto para agentes de IA (Cursor) neste repo.

## Domínio e dados

- [Esquema do banco, RLS e Storage](database.md)
- [Fluxos de usuário](user-flows.md)
- [Integração de pagamentos](integracao-pagamentos.md)

## Front-end

- [Arquitetura e pastas](front-end.md)
- [Geocodificação Nominatim (painéis)](geocoding.md)

## Glossário

- **Painel:** ponto físico de LED indoor.
- **Cliente (anunciante):** eixo operacional no admin — cadastro com dados, prazos de pagamento, painéis e contratos **anexos**; ver `user-flows.md`.
- **Contrato:** registo comercial (vigência, `contract_panels`, número) **ligado a** `clients`; não é a âncora de navegação principal — cria-se a partir da ficha do cliente. PDF/modelo não altera regras de vaga.
- **Vaga / slot:** capacidade exibida no mapa = `panel_slots_used_public` (contratos ativos + vínculos CRM `client_panels` sem duplicar par com contrato ativo).
