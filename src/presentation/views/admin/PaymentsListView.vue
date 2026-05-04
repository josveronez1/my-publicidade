<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'

type ContractEmbed = {
  contract_number: string
  client_id: string
  clients: { legal_name: string } | { legal_name: string }[] | null
}

type Row = {
  id: string
  contract_id: string
  gateway: string
  status: string
  amount_cents: number | null
  checkout_url: string | null
  external_id: string | null
  created_at: string
  updated_at: string
  contracts: ContractEmbed | ContractEmbed[] | null
}

const rows = ref<Row[]>([])
const err = ref<string | null>(null)
const loading = ref(false)

function formatMoney(cents: number | null) {
  if (cents == null) return '—'
  const v = cents / 100
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function clientName(r: Row) {
  const block = contractEmbed(r)
  if (!block?.clients) return '—'
  const cl = block.clients
  const name = Array.isArray(cl) ? cl[0]?.legal_name : cl?.legal_name
  return name ?? '—'
}

function contractEmbed(r: Row): ContractEmbed | null {
  const c = r.contracts
  if (!c) return null
  return Array.isArray(c) ? c[0] ?? null : c
}

async function load() {
  loading.value = true
  err.value = null
  const sb = getSupabase()
  const { data, error } = await sb
    .from('gateway_charges')
    .select(
      'id, contract_id, gateway, status, amount_cents, checkout_url, external_id, created_at, updated_at, contracts(contract_number, client_id, clients(legal_name))',
    )
    .order('created_at', { ascending: false })

  err.value = error?.message ?? null
  rows.value = (data ?? []) as unknown as Row[]
  loading.value = false
}

onMounted(load)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <RouterLink to="/admin/clients" class="text-xs font-medium text-[#c9a017] hover:underline">
          ← Clientes
        </RouterLink>
        <h1 class="mt-1 text-xl font-semibold text-slate-900">Pagamentos</h1>
        <p class="mt-1 text-xs text-slate-500">
          Cobranças e links do gateway (Mercado Pago Checkout Pro). Webhooks actualizam o estado automaticamente.
        </p>
      </div>
    </div>

    <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>
    <p v-if="loading" class="mt-4 text-sm text-slate-500">A carregar…</p>

    <div v-else class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th class="px-4 py-2 font-medium">Cliente</th>
            <th class="px-4 py-2 font-medium">Contrato</th>
            <th class="px-4 py-2 font-medium">Gateway</th>
            <th class="px-4 py-2 font-medium">Estado</th>
            <th class="px-4 py-2 font-medium">Valor</th>
            <th class="px-4 py-2 font-medium">Checkout</th>
            <th class="px-4 py-2 font-medium">Actualização</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="border-b border-slate-100">
            <td class="px-4 py-2">{{ clientName(r) }}</td>
            <td class="px-4 py-2 font-mono text-xs">
              <RouterLink
                v-if="contractEmbed(r)"
                class="font-medium text-[#c9a017] hover:underline"
                :to="{
                  name: 'admin-client-contract-detail',
                  params: { id: contractEmbed(r)!.client_id, contractId: r.contract_id },
                }"
              >
                {{ contractEmbed(r)!.contract_number }}
              </RouterLink>
              <span v-else>—</span>
            </td>
            <td class="px-4 py-2">{{ r.gateway }}</td>
            <td class="px-4 py-2">{{ r.status }}</td>
            <td class="px-4 py-2">{{ formatMoney(r.amount_cents) }}</td>
            <td class="px-4 py-2">
              <a
                v-if="r.checkout_url && r.status === 'pending'"
                :href="r.checkout_url"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-[#c9a017] hover:underline"
              >
                Abrir link
              </a>
              <span v-else class="text-slate-400">—</span>
            </td>
            <td class="px-4 py-2 text-xs text-slate-600">{{ formatWhen(r.updated_at) }}</td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-xs text-slate-500">
              Nenhuma cobrança registada. Ao activar um contrato com Mercado Pago, aparece aqui.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
