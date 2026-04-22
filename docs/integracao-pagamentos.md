# Integração de pagamentos

No produto, o **registo de contrato** (e portanto `contract_id` para cobrança) é criado a partir da **ficha do cliente** no admin, não como módulo desligado de `clients`.

## Porta abstrata

`src/infrastructure/payment/PaymentGatewayPort.ts` define:

- `createSubscriptionForContract` — após contrato **ativo** (pós-assinatura física no processo real).
- `cancelSubscription` — ao suspender/cancelar contrato.
- `syncContractStatus` — reconciliação.

Implementação atual: **`PaymentGatewayStub`** (desenvolvimento).

## Mercado Pago (produção)

- Access token **somente** em Edge Function ou backend; nunca no Vue.
- Webhooks: tópicos `payments`, assinaturas conforme [documentação MP](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks).
- `external_reference` / metadata com `contract_id` para idempotência.
- Job diário + botão “Sincronizar com gateway” (plano de produto).

## Tabela `gateway_charges`

Rastreia cobranças/links por `contract_id`, `status`, `checkout_url`, `raw_payload`.

## Chargeback

Webhook → `contracts.dispute_flag = true` + semáforo vermelho na lista admin.
