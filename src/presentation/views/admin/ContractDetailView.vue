<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'
import { activateContractWithGatewayStub } from '@/composables/useContractActivation'
import { contractTemplateLogoSignedUrl } from '@/infrastructure/storage/contractTemplateLogo'
import ContractPdfPanel from '@/presentation/components/ContractPdfPanel.vue'

type PanelRow = {
  slots_used: number
  panels: { code: string; name: string; total_ad_slots: number | null } | null
}

const route = useRoute()

const clientId = computed(() => route.params.id as string)
const contractId = computed(() => route.params.contractId as string)

const loading = ref(true)
const err = ref<string | null>(null)

const legalName = ref('')
const row = ref<{
  id: string
  contract_number: string
  status: string
  effective_start_date: string
  effective_end_date: string
  template_id: string | null
  template_version: number | null
  total_value: number | null
  currency: string | null
  notes_internal: string | null
  pdf_storage_path: string | null
  form_snapshot: { markdown_merged_preview?: string; generated_at?: string } | null
} | null>(null)

const templateLogoUrl = ref<string | null>(null)

const mergedSnapshotText = computed(() => {
  const snap = row.value?.form_snapshot
  const s = typeof snap === 'object' && snap ? snap.markdown_merged_preview : ''
  return typeof s === 'string' && s.trim().length ? s : ''
})

const panelRows = ref<PanelRow[]>([])

const actionBusy = ref<string | null>(null)

async function load() {
  loading.value = true
  err.value = null
  const sb = getSupabase()

  const { data: cClient, error: e0 } = await sb
    .from('clients')
    .select('legal_name')
    .eq('id', clientId.value)
    .maybeSingle()
  if (e0) {
    err.value = e0.message
    loading.value = false
    return
  }
  legalName.value = cClient?.legal_name ?? 'Cliente'

  const { data: c, error: e1 } = await sb
    .from('contracts')
    .select(
      'id, contract_number, status, effective_start_date, effective_end_date, template_id, template_version, total_value, currency, notes_internal, client_id, form_snapshot, pdf_storage_path',
    )
    .eq('id', contractId.value)
    .maybeSingle()

  if (e1) {
    err.value = e1.message
    loading.value = false
    return
  }
  if (!c || c.client_id !== clientId.value) {
    err.value = 'Contrato não encontrado neste cliente.'
    row.value = null
    loading.value = false
    return
  }
  row.value = c as typeof row.value

  templateLogoUrl.value = null
  if (c.template_id) {
    const { data: tpl } = await sb
      .from('contract_templates')
      .select('logo_storage_path')
      .eq('id', c.template_id)
      .maybeSingle()
    if (tpl?.logo_storage_path) {
      templateLogoUrl.value = await contractTemplateLogoSignedUrl(tpl.logo_storage_path, 60 * 60 * 2)
    }
  }

  const { data: cp, error: e2 } = await sb
    .from('contract_panels')
    .select('slots_used, panels(code, name, total_ad_slots)')
    .eq('contract_id', contractId.value)

  if (e2) err.value = e2.message
  panelRows.value = (cp ?? []) as unknown as PanelRow[]
  loading.value = false
}

onMounted(load)

async function setStatus(next: string) {
  if (!row.value) return
  actionBusy.value = next
  err.value = null
  const sb = getSupabase()
  const { error } = await sb.from('contracts').update({ status: next }).eq('id', row.value.id)
  actionBusy.value = null
  if (error) {
    err.value = error.message
    return
  }
  await load()
}

async function onActivate() {
  if (!row.value) return
  actionBusy.value = 'activate'
  err.value = null
  try {
    const r = await activateContractWithGatewayStub(row.value.id)
    if (!r.ok) err.value = r.message ?? 'Falha ao ativar.'
  } finally {
    actionBusy.value = null
    await load()
  }
}

const canEdit = computed(() =>
  row.value ? ['draft', 'under_review'].includes(row.value.status) : false,
)

const canSendToSigning = computed(() => row.value?.status === 'draft')

const canActivate = computed(() =>
  row.value ? ['draft', 'pending_signature', 'under_review'].includes(row.value.status) : false,
)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-medium text-slate-500">Contrato</p>
        <h1 v-if="row" class="text-xl font-semibold text-slate-900">{{ row.contract_number }}</h1>
        <p class="mt-1 text-xs text-slate-500">{{ legalName }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          :to="{ name: 'admin-client-detail', params: { id: clientId }, query: { tab: 'contratos' } }"
          class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          ← Ficha do cliente
        </RouterLink>
        <RouterLink
          v-if="canEdit && row"
          :to="{ name: 'admin-client-contract-edit', params: { id: clientId, contractId: row.id } }"
          class="rounded-lg bg-[#e7bb0e] px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c]"
        >
          Editar
        </RouterLink>
      </div>
    </div>

    <p v-if="err" class="mt-3 text-sm text-red-600">{{ err }}</p>
    <p v-if="loading" class="mt-6 text-sm text-slate-500">A carregar…</p>

    <div v-else-if="row" class="mt-6 space-y-6">
      <div class="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p class="text-xs font-medium text-slate-500">Estado</p>
        <p class="mt-1 font-medium text-slate-900">{{ row.status }}</p>
        <p class="mt-3 text-xs font-medium text-slate-500">Vigência</p>
        <p class="mt-1 text-slate-800">
          {{ row.effective_start_date }} → {{ row.effective_end_date }}
        </p>
        <p v-if="row.total_value != null" class="mt-3 text-xs text-slate-600">
          Valor: {{ row.currency }} {{ row.total_value }}
        </p>
        <p v-if="row.template_id" class="mt-3 text-xs text-slate-500">
          Modelo: versão {{ row.template_version ?? '—' }} (id em schema)
        </p>
        <p v-if="row.notes_internal" class="mt-3 whitespace-pre-wrap text-xs text-slate-600">
          {{ row.notes_internal }}
        </p>
      </div>

      <ContractPdfPanel
        v-if="row"
        :contract-id="row.id"
        :contract-number="row.contract_number"
        :markdown="mergedSnapshotText"
        :logo-url="templateLogoUrl"
        :pdf-path="row.pdf_storage_path"
        @pdf-updated="load"
      />

      <div>
        <h2 class="text-sm font-semibold text-slate-800">Painéis e vagas</h2>
        <ul class="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          <li v-for="(p, i) in panelRows" :key="i" class="flex justify-between px-3 py-2 text-sm">
            <span class="font-mono text-slate-700"
              >{{ p.panels?.code }} — {{ p.panels?.name }}</span
            >
            <span class="text-slate-600">Slots: {{ p.slots_used }} / {{ p.panels?.total_ad_slots ?? '—' }}</span>
          </li>
          <li v-if="panelRows.length === 0" class="px-3 py-6 text-center text-xs text-slate-500">
            Nenhum painel ligado neste contrato.
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        <button
          v-if="canSendToSigning"
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          :disabled="actionBusy !== null"
          @click="setStatus('pending_signature')"
        >
          {{ actionBusy === 'pending_signature' ? 'A guardar…' : 'Enviar para assinatura' }}
        </button>
        <button
          v-if="canActivate"
          type="button"
          class="rounded-lg bg-[#e7bb0e] px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c] disabled:opacity-50"
          :disabled="actionBusy !== null"
          @click="onActivate"
        >
          {{
            actionBusy === 'activate' ? 'A ativar…' : 'Ativar + cobrança (stub)'
          }}
        </button>
      </div>
    </div>
  </div>
</template>
