<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'
import ClientFormView from './ClientFormView.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id as string)

const tab = computed(() => {
  const t = route.query.tab as string
  if (t === 'paineis' || t === 'contratos') return t
  return 'dados'
})

const headName = ref('')
const contractRows = ref<{ id: string; contract_number: string; status: string; effective_start_date: string; effective_end_date: string }[]>([])
const err = ref<string | null>(null)

function goTab(t: 'dados' | 'paineis' | 'contratos') {
  router.replace({ path: route.path, query: t === 'dados' ? {} : { ...route.query, tab: t } })
}

onMounted(async () => {
  const sb = getSupabase()
  const { data, error } = await sb.from('clients').select('legal_name').eq('id', id.value).maybeSingle()
  if (error) {
    err.value = error.message
    return
  }
  if (!data) {
    err.value = 'Cliente não encontrado.'
    return
  }
  headName.value = data.legal_name ?? 'Cliente'
  await loadContracts()
})

watch(
  () => [route.query.tab, route.path] as const,
  () => {
    if (route.query.tab === 'contratos' && !err.value) void loadContracts()
  },
)

async function loadContracts() {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('contracts')
    .select('id, contract_number, status, effective_start_date, effective_end_date')
    .eq('client_id', id.value)
    .order('created_at', { ascending: false })
  err.value = error?.message ?? null
  contractRows.value = (data ?? []) as typeof contractRows.value
}
</script>

<template>
  <div>
    <p v-if="err" class="text-sm text-red-600">{{ err }}</p>
    <div v-else class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-medium text-slate-500">Cliente</p>
        <h1 class="text-xl font-semibold text-slate-900">{{ headName }}</h1>
        <p class="mt-1 text-xs text-slate-500">
          Contratos são anexos a este cadastro. O gerador de PDFs não altera vagas do mapa.
        </p>
      </div>
      <RouterLink
        to="/admin/clients"
        class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        ← Lista de clientes
      </RouterLink>
    </div>

    <nav
      v-if="!err"
      class="mt-4 flex flex-wrap gap-1 border-b border-slate-200"
      role="tablist"
      aria-label="Secções do cliente"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'dados'"
        class="rounded-t-lg border border-b-0 px-3 py-2 text-sm font-medium"
        :class="
          tab === 'dados'
            ? 'border-slate-200 bg-white text-slate-900'
            : 'border-transparent text-slate-600 hover:text-slate-900'
        "
        @click="goTab('dados')"
      >
        Dados e pagamento
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'paineis'"
        class="rounded-t-lg border border-b-0 px-3 py-2 text-sm font-medium"
        :class="
          tab === 'paineis'
            ? 'border-slate-200 bg-white text-slate-900'
            : 'border-transparent text-slate-600 hover:text-slate-900'
        "
        @click="goTab('paineis')"
      >
        Painéis
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'contratos'"
        class="rounded-t-lg border border-b-0 px-3 py-2 text-sm font-medium"
        :class="
          tab === 'contratos'
            ? 'border-slate-200 bg-white text-slate-900'
            : 'border-transparent text-slate-600 hover:text-slate-900'
        "
        @click="goTab('contratos')"
      >
        Contratos
      </button>
    </nav>

    <div v-if="!err" class="mt-4 min-h-[8rem]">
      <ClientFormView v-if="tab === 'dados'" :embed="true" :client-id="id" section="dados" />
      <ClientFormView v-else-if="tab === 'paineis'" :embed="true" :client-id="id" section="paineis" />
      <div v-else class="max-w-2xl space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-slate-600">Registos de contrato ligados a este cliente (rascunho ou formal).</p>
          <RouterLink
            :to="`/admin/clients/${id}/contracts/new`"
            class="rounded-lg bg-[#e7bb0e] px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c]"
          >
            Novo contrato
          </RouterLink>
        </div>
        <div
          v-if="contractRows.length === 0"
          class="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500"
        >
          Nenhum contrato ainda. Crie um rascunho com o botão acima.
        </div>
        <ul v-else class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          <li
            v-for="c in contractRows"
            :key="c.id"
            class="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
          >
            <span class="font-mono text-slate-800">{{ c.contract_number }}</span>
            <span class="text-slate-600">{{ c.status }}</span>
            <span class="text-xs text-slate-500"
              >{{ c.effective_start_date }} → {{ c.effective_end_date }}</span
            >
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
