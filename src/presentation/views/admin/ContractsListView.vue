<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'
import { contractSemaphore } from '@/domain/semaphore'
import { activateContractWithGatewayStub } from '@/composables/useContractActivation'

type Row = {
  id: string
  client_id: string
  contract_number: string
  status: string
  effective_start_date: string
  effective_end_date: string
  dispute_flag: boolean
  health_override: string | null
  manual_paid_at: string | null
  /** Supabase pode retornar objeto ou array conforme embed */
  clients: { legal_name: string } | { legal_name: string }[] | null
}

const rows = ref<Row[]>([])
const err = ref<string | null>(null)
const today = new Date().toISOString().slice(0, 10)

function paymentState(r: Row): 'ok' | 'pending' | 'overdue' | 'unknown' {
  if (r.manual_paid_at) return 'ok'
  if (r.status === 'active') return 'pending'
  return 'unknown'
}

function sem(r: Row) {
  return contractSemaphore({
    status: r.status,
    effective_end_date: r.effective_end_date,
    today,
    warnWithinDays: 30,
    payment: paymentState(r),
    health_override: (r.health_override as 'green' | 'yellow' | 'red' | null) ?? null,
    dispute_flag: r.dispute_flag,
  })
}

function clientName(r: Row) {
  const c = r.clients
  if (!c) return '—'
  if (Array.isArray(c)) return c[0]?.legal_name ?? '—'
  return c.legal_name
}

function semClass(s: string) {
  if (s === 'green') return 'bg-emerald-500'
  if (s === 'yellow') return 'bg-amber-400'
  return 'bg-red-500'
}

async function load() {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('contracts')
    .select(
      'id, client_id, contract_number, status, effective_start_date, effective_end_date, dispute_flag, health_override, manual_paid_at, clients(legal_name)',
    )
    .order('created_at', { ascending: false })
  err.value = error?.message ?? null
  rows.value = (data ?? []) as unknown as Row[]
}

onMounted(load)

const activating = ref<string | null>(null)

/** Ativa contrato + stub de assinatura (Fase 5 troca por gateway real). */
async function activateContract(id: string) {
  activating.value = id
  try {
    const r = await activateContractWithGatewayStub(id)
    if (!r.ok && r.message) err.value = r.message
  } finally {
    activating.value = null
    await load()
  }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <RouterLink to="/admin/contracts" class="text-xs font-medium text-[#c9a017] hover:underline">
          ← Modelos de contrato
        </RouterLink>
        <h1 class="mt-1 text-xl font-semibold text-slate-900">Registos de contratos</h1>
        <p class="mt-1 text-xs text-slate-500">
          Contratos efectivos já criados. Para definir texto, variáveis e logo use
          <RouterLink to="/admin/contracts" class="font-medium underline">Contratos · modelos</RouterLink>.
        </p>
      </div>
      <RouterLink
        to="/admin/clients"
        class="shrink-0 rounded-lg bg-[#e7bb0e] px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c]"
      >
        Novo contrato (abrir cliente)
      </RouterLink>
    </div>
    <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>
    <div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th class="px-4 py-2 font-medium">Semáforo</th>
            <th class="px-4 py-2 font-medium">Número</th>
            <th class="px-4 py-2 font-medium">Cliente</th>
            <th class="px-4 py-2 font-medium">Vigência</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="border-b border-slate-100">
            <td class="px-4 py-2">
              <span
                class="inline-block h-3 w-3 rounded-full"
                :class="semClass(sem(r))"
                :title="sem(r)"
              />
            </td>
            <td class="px-4 py-2 font-mono text-xs">
              <RouterLink
                class="font-medium text-[#c9a017] hover:underline"
                :to="{ name: 'admin-client-contract-detail', params: { id: r.client_id, contractId: r.id } }"
              >
                {{ r.contract_number }}
              </RouterLink>
            </td>
            <td class="px-4 py-2">{{ clientName(r) }}</td>
            <td class="px-4 py-2 text-slate-600">
              {{ r.effective_start_date }} → {{ r.effective_end_date }}
            </td>
            <td class="px-4 py-2">{{ r.status }}</td>
            <td class="px-4 py-2">
              <button
                v-if="
                  r.status === 'pending_signature' ||
                  r.status === 'draft' ||
                  r.status === 'under_review'
                "
                type="button"
                class="text-xs font-medium text-[#e7bb0e] hover:underline disabled:opacity-50"
                :disabled="activating === r.id"
                @click="activateContract(r.id)"
              >
                Ativar + cobrança (stub)
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
