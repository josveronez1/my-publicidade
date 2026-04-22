<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'

const route = useRoute()
const router = useRouter()

/** Sempre resolvido pela rota `clients/:id/contracts/new` (não cria contrato sem cliente). */
const fixedClientId = computed(() => (route.params.id as string) || '')

const clientLabel = ref('')
const panels = ref<{ id: string; code: string; name: string; total_ad_slots: number }[]>([])
const start = ref(new Date().toISOString().slice(0, 10))
const end = ref(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10))
const panelSlots = ref<Record<string, number>>({})
const saving = ref(false)
const err = ref<string | null>(null)

onMounted(async () => {
  const sb = getSupabase()
  const p = await sb.from('panels').select('id, code, name, total_ad_slots').order('code')
  panels.value = (p.data ?? []) as typeof panels.value
  for (const x of panels.value) panelSlots.value[x.id] = 0

  if (!fixedClientId.value) {
    err.value = 'Rota inválida: abra Novo contrato a partir da ficha do cliente.'
    return
  }
  const { data: c } = await sb.from('clients').select('legal_name').eq('id', fixedClientId.value).single()
  if (c?.legal_name) clientLabel.value = c.legal_name
  else if (fixedClientId.value) err.value = 'Cliente não encontrado para este registo.'
})

function togglePanel(id: string, on: boolean) {
  panelSlots.value[id] = on ? 1 : 0
}

async function submit() {
  const cid = fixedClientId.value
  if (!cid) {
    err.value = 'Cliente não identificado.'
    return
  }
  saving.value = true
  err.value = null
  const sb = getSupabase()
  const { data: num, error: e1 } = await sb.rpc('next_contract_number')
  if (e1 || !num) {
    err.value = e1?.message ?? 'Falha ao gerar número'
    saving.value = false
    return
  }
  const { data: userData } = await sb.auth.getUser()
  const uid = userData.user?.id ?? null
  const { data: contract, error: e2 } = await sb
    .from('contracts')
    .insert({
      contract_number: num,
      client_id: cid,
      status: 'draft',
      effective_start_date: start.value,
      effective_end_date: end.value,
      created_by: uid,
    })
    .select('id')
    .single()
  if (e2 || !contract) {
    err.value = e2?.message ?? 'Erro ao criar contrato'
    saving.value = false
    return
  }
  for (const p of panels.value) {
    const n = panelSlots.value[p.id] ?? 0
    if (n > 0) {
      const { error: e3 } = await sb.from('contract_panels').insert({
        contract_id: contract.id,
        panel_id: p.id,
        slots_used: n,
      })
      if (e3) {
        err.value = e3.message
        saving.value = false
        return
      }
    }
  }
  saving.value = false
  await router.push({ name: 'admin-client-detail', params: { id: cid }, query: { tab: 'contratos' } })
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-slate-900">Novo contrato (anexo ao cliente)</h1>
    <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>
    <p v-else class="mt-1 text-sm text-slate-600">
      Rascunho vinculado a
      <span class="font-medium text-slate-800">{{ clientLabel || '…' }}</span>
      . O PDF/modelo, quando existir, só gera documento; não muda regras de vaga.
    </p>
    <form class="mt-6 max-w-2xl space-y-4" @submit.prevent="submit">
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-xs font-medium text-slate-600">
          Início vigência
          <input v-model="start" type="date" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Fim vigência
          <input v-model="end" type="date" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
      </div>
      <div>
        <p class="text-xs font-medium text-slate-600">Painéis e vagas</p>
        <ul class="mt-2 space-y-2 rounded-lg border border-slate-200 p-3">
          <li v-for="p in panels" :key="p.id" class="flex flex-wrap items-center gap-3 text-sm">
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                :checked="(panelSlots[p.id] ?? 0) > 0"
                @change="togglePanel(p.id, ($event.target as HTMLInputElement).checked)"
              />
              <span>{{ p.code }} — {{ p.name }}</span>
            </label>
            <span v-if="(panelSlots[p.id] ?? 0) > 0" class="flex items-center gap-1 text-slate-600">
              Slots
              <input
                v-model.number="panelSlots[p.id]"
                type="number"
                min="1"
                :max="p.total_ad_slots"
                class="w-16 rounded border border-slate-200 px-2 py-1 text-xs"
              />
            </span>
          </li>
        </ul>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="submit"
          class="rounded-lg bg-[#e7bb0e] px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c] disabled:opacity-50"
          :disabled="saving"
        >
          Criar rascunho
        </button>
        <RouterLink
          v-if="fixedClientId"
          :to="{ name: 'admin-client-detail', params: { id: fixedClientId }, query: { tab: 'contratos' } }"
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm"
        >
          Voltar à ficha do cliente
        </RouterLink>
      </div>
    </form>
  </div>
</template>
