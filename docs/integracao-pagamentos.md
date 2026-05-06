# Integração de pagamentos

No produto, o **registo de contrato** (e portanto `contract_id` para cobrança) é criado a partir da **ficha do cliente** no admin, não como módulo desligado de `clients`.

## Porta abstrata

`src/infrastructure/payment/PaymentGatewayPort.ts` define:

- `createSubscriptionForContract` — após contrato **ativo** (pós-assinatura física no processo real).
- `cancelSubscription` — ao suspender/cancelar contrato.
- `syncContractStatus` — reconciliação.

Em produção/dev com gateway: `**MercadoPagoGateway`** invoca a Edge `mercadopago-create-preference`. Com `VITE_PAYMENT_GATEWAY=stub`, usa-se só `**PaymentGatewayStub`** (sem Mercado Pago).

## Mercado Pago (produção)

- Access token **somente** em Edge Function ou backend; nunca no Vue (`VITE_`*).
- **Fluxo actual (Checkout Pro):**
  1. Admin **Ativar** → front chama `supabase.functions.invoke('mercadopago-create-preference', { body: { contract_id } })` com JWT (implementação `MercadoPagoGateway`).
  2. A Edge valida admin (`profiles`), exige `total_value`, cria **preferência** na API MP (`notification_url` → `mercadopago-webhook`), coloca contrato em `active`, `gateway_subscription_id` = id da preferência, insere `gateway_charges` com `status=pending` e `checkout_url=init_point`.
  3. Webhook `mercadopago-webhook` (sem JWT do Supabase; `verify_jwt=false`) recebe notificações, confirma com **GET** `/v1/payments/:id`, actualiza `gateway_charges` e `contracts.payment_external_id` com idempotência por id de pagamento.
- Ambiente local sem cobrança: `VITE_PAYMENT_GATEWAY=stub` usa só `PaymentGatewayStub` (sem Edge).
- Webhooks: tópicos `payment` / `payments` conforme [documentação MP](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks).
- `external_reference` = `contract_id` na preferência.
- Job diário + botão “Sincronizar com gateway” (plano de produto, futuro).

## Tabela `gateway_charges`

Rastreia cobranças/links por `contract_id`, `status`, `checkout_url`, `raw_payload`.

## Chargeback

Webhook → `contracts.dispute_flag = true` + semáforo vermelho na lista admin.

## Configuração Mercado Pago (credenciais e webhook)

Checklist de app no MP, chaves, Secrets na Edge e opcional Public Key no front: [mercado-pago-setup.md](mercado-pago-setup.md).