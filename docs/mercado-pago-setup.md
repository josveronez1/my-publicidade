# Mercado Pago (Brasil) — configuração

Este guia complementa [integracao-pagamentos.md](integracao-pagamentos.md). Resume conceitos oficiais do [Mercado Pago Developers](https://www.mercadopago.com.br/developers/pt/docs) e alinha com este projeto (Supabase Edge + front Vite).

## Contexto: Checkout Pro vs API de Pagamentos (Checkout Transparente)


|                  | **Checkout Pro**                                              | **Payments API** (Checkout Transparente / API de Pagamentos)        |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Onde paga**    | No fluxo hospedado pelo Mercado Pago (redirect ou modal).     | No seu site (você monta o formulário / tokenização).                |
| **Esforço**      | Menor — preferência criada no backend, usuário redirecionado. | Maior — UI, PCI-minded (cartão tokenizado no front com Public Key). |
| **Customização** | Limitada ao fluxo MP.                                         | Total na sua página.                                                |
| **Uso típico**   | Links de cobrança, onboarding rápido.                         | Experiência própria, assinaturas com mais controle na página.       |


O MP também evolui integrações “transparentes” com **Orders API** em novos projetos; a escolha entre Pro vs API depende de UX e de onde você quer processar o pagamento.

## Public Key vs Access Token


| Credencial       | Onde usar                                                                       | Nunca                                                       |
| ---------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Public Key**   | Front-end (ex.: tokenizar cartão, Brick, SDK JS) — é **pública** por desenho.   | Não substitui o Access Token no servidor.                   |
| **Access Token** | Servidor / Edge Function — criar preferências, cobranças, consultar pagamentos. | **Nunca** em variáveis `VITE_*`, bundle Vue ou repositório. |


Regra para este repo: **somente a anon key do Supabase** e eventual **Public Key MP** podem aparecer no cliente; **Access Token só em [Secrets das Edge Functions](https://supabase.com/docs/guides/functions/secrets)** (ou outro backend seguro).

## Webhooks (notificações)

- Configure no painel **Suas integrações** a URL HTTPS do seu endpoint (ex.: `https://<ref>.supabase.co/functions/v1/<nome-da-function>`).
- Tópicos usuais: `**payment`** / fluxos de pagamento; para assinaturas recorrentes, os eventos indicados na doc de **Assinaturas** / API que você usar.
- **Responder `2xx`** rapidamente ao MP; processamento pesado pode ser assíncrono depois do ACK.
- `**external_reference**`: campo na preferência/cobrança com **seu ID interno** (ex.: `contract_id`) para correlacionar webhook ↔ negócio.
- **Idempotência**: o MP pode reenviar a mesma notificação. Guarde o **id do pagamento** (ou idempotency key derivada) e **ignore duplicados** na sua base antes de alterar estado financeiro.
- Boas práticas: ao receber o webhook, **consultar o pagamento na API com o Access Token** e só então atualizar estado (não confiar só no body bruto).

Referência: [Webhooks — Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks).

## Credenciais de teste vs produção

No painel da aplicação MP:

- **Credenciais de teste**: Public Key + Access Token de teste — sem cobrança real.
- **Credenciais de produção**: ativadas após dados/compliance; substituem as de teste no deploy.

Use **um par consistente** (teste em dev/staging, produção só em ambiente prod). Não misturar token de teste com conta produtiva em gateway real.

---

## Checklist operacional

### 1. Criar aplicação no Mercado Pago

- [Mercado Pago Developers](https://www.mercadopago.com.br/developers/panel/app) → criar app / selecionar produto (Checkout Pro e/ou API conforme escolha).
- Anotar qual fluxo você usará (Pro vs Payments / Orders) para alinhar docs de API.

### 2. Copiar chaves (sem commit)

- Copiar **Public Key** (teste primeiro).
- Copiar **Access Token** de teste — armazenar só em gestor de segredos, não em ficheiros versionados.
- Repetir para **produção** quando for ao ar (novo par no painel).

### 3. Configurar webhook no Supabase Edge

- Edge Function `mercadopago-webhook`: consulta GET `/v1/payments/:id` e actualiza `gateway_charges` / contrato (`verify_jwt=false` nesta função).
- No MP, registrar URL: `https://<PROJECT_REF>.supabase.co/functions/v1/mercadopago-webhook`.
- Secrets: `MERCADOPAGO_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` (webhook usa service role para escrita).
- Testar com pagamentos de teste e verificar logs no dashboard Supabase.

### 4. Variáveis: Edge Secrets vs front opcional


| Onde                      | Variável (exemplo de nome)    | Conteúdo                                               |
| ------------------------- | ----------------------------- | ------------------------------------------------------ |
| **Supabase Edge Secrets** | `MERCADOPAGO_ACCESS_TOKEN`    | Access Token (teste ou prod conforme ambiente).        |
| **Front Vite (opcional)** | `VITE_MERCADOPAGO_PUBLIC_KEY` | Public Key — só se o front usar SDK/Brick/tokenização. |


Se usar **somente Checkout Pro** com preferência criada **só na Edge** e redirect para `init_point`, o front pode **não precisar** de Public Key no Vite.

### 5. Antes de produção

- Trocar segredos para credenciais **de produção** no projeto Supabase de produção.
- HTTPS na URL do webhook (Edge já serve HTTPS).
- Monitorizar duplicados de webhook e dead-letter/retry na sua lógica.

---

## Referências rápidas

- [Checkout Pro — visão geral](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/overview)
- [Checkout Transparente / API de Pagamentos](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/overview)
- [Credenciais](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/resources/credentials)
- [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)