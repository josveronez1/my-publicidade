# Fluxos de usuário

## Visitante (Media Kit — `/`)

1. Vê mapa (Leaflet + tiles Carto Positron) e lista de painéis **publicados**.
2. Para cada painel: endereço, público-alvo, vagas ocupadas / total (`panel_slots_used_public` — contratos ativos na vigência + vínculos em `client_panels` sem duplicar par cliente+painel já coberto por contrato ativo).
3. Formulário “Solicitar proposta” (honeypot oculto + validação servidor via RLS).
4. Rodapé com texto LGPD (checkbox opcional no roadmap jurídico).

## Admin — login

1. `/login` → e-mail/senha (Supabase Auth).
2. Perfil com `role` in (`admin`, `super_admin`) acessa `/admin` e sidebar.

## Admin — painéis

1. CRUD em `/admin/panels`; marcar **Publicar** para aparecer no Media Kit.
2. **Endereço:** preencher logradouro, cidade e UF (CEP recomendado); o sistema geocodifica (Nominatim) e posiciona o pin no mapa; o operador confere e pode arrastar/clicar para ajustar. Coordenadas manuais ficam em “Avançado”.
3. Status operacional no mapa público (ex.: manutenção → marcador acinzentado).

## Admin — clientes (eixo principal do negócio)

1. Lista em `/admin/clients`; **Novo cliente** abre cadastro completo (dados + painéis); após criar, a ficha em `/admin/clients/:id`.
2. **Ficha do cliente** (`/admin/clients/:id`): separadores **Dados e pagamento** (CNPJ, prazos, etc.), **Painéis** (N:N `client_panels`), **Contratos** (lista de registos e **Novo contrato**). O contrato é **anexo** ao cadastro, não um módulo separado no mesmo nível do menu.
3. **Novo contrato:** só a partir da ficha — rota `/admin/clients/:id/contracts/new`; não existe contrato sem `client_id`. O gerador de PDF (quando existir) **só** produz documento; não muda contagem de vagas.
4. **Não existe login para o anunciante:** a equipa MW gere tudo no admin; o anunciante recebe e-mail e links.
5. O papel `client_user` em `profiles` pode existir no schema; o produto não oferece área autenticada em `/client` (redireciona ao Media Kit).

## Admin — contratos (registo anexado ao cliente)

1. Criar rascunho a partir da ficha do cliente: vigência, painéis e `slots_used` por painel em `contract_panels`.
2. Número gerado por `next_contract_number()`.
3. **Ativar + cobrança (stub):** passa contrato para `active`, chama `PaymentGatewayStub`, grava `gateway_charges` (Fase 5: Mercado Pago) — quando a lista global de contratos estiver ligada na UI.

## Estados do contrato (enum)

`draft` → `pending_signature` → `active` | `suspended` | `expired` | `cancelled` (fluxo completo configurável no admin).
