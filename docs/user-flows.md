# Fluxos de usuário

## Visitante (Media Kit — `/`)

1. Vê mapa (Leaflet + tiles Carto Positron) e lista de painéis **publicados**.
2. Para cada painel: endereço, público-alvo, vagas ocupadas / total (`panel_slots_used_public`).
3. Formulário “Solicitar proposta” (honeypot oculto + validação servidor via RLS).
4. Rodapé com texto LGPD (checkbox opcional no roadmap jurídico).

## Admin — login

1. `/login` → e-mail/senha (Supabase Auth).
2. Perfil com `role` in (`admin`, `super_admin`) acessa `/admin` e sidebar.

## Admin — painéis

1. CRUD em `/admin/panels`; marcar **Publicar** para aparecer no Media Kit.
2. **Endereço:** preencher logradouro, cidade e UF (CEP recomendado); o sistema geocodifica (Nominatim) e posiciona o pin no mapa; o operador confere e pode arrastar/clicar para ajustar. Coordenadas manuais ficam em “Avançado”.
3. Status operacional no mapa público (ex.: manutenção → marcador acinzentado).

## Admin — contratos

1. Novo contrato: cliente, vigência, painéis e `slots_used` por painel.
2. Número gerado por `next_contract_number()`.
3. **Ativar + cobrança (stub):** passa contrato para `active`, chama `PaymentGatewayStub`, grava `gateway_charges` (Fase 5: Mercado Pago).

## Cliente — `/client`

1. Login com `profiles.client_id` preenchido.
2. Lista contratos, link de pagamento se existir em `gateway_charges`.

## Estados do contrato (enum)

`draft` → `pending_signature` → `active` | `suspended` | `expired` | `cancelled` (fluxo completo configurável no admin).
