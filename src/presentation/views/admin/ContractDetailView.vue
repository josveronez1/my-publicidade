<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'
import { activateContractWithGateway } from '@/composables/useContractActivation'
import { contractTemplateLogoSignedUrl } from '@/infrastructure/storage/contractTemplateLogo'
import { removeContractPdfFromStorage } from '@/infrastructure/storage/contractPdfStorage'
import ContractPdfPanel from '@/presentation/components/ContractPdfPanel.vue'

type PanelRow = {
  slots_used: number
  panels: { code: string; name: string; total_ad_slots: number | null } | null
}

const route = useRoute()
const router = useRouter()

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

const chargeRows = ref<Array<{ status: string; checkout_url: string | null; created_at: string }>>([])

const usePaymentStub = import.meta.env.VITE_PAYMENT_GATEWAY === 'stub'

const pendingCheckoutUrl = computed(() => {
  const p = chargeRows.value.find(
    (c) =>
      (c.status === 'pending' || c.status === 'in_process') &&
      typeof c.checkout_url === 'string' &&
      c.checkout_url.length > 0,
  )
  return p?.checkout_url ?? null
})

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

  const { data: ch } = await sb
    .from('gateway_charges')
    .select('status, checkout_url, created_at')
    .eq('contract_id', contractId.value)
    .order('created_at', { ascending: false })
  chargeRows.value = ch ?? []

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
    const r = await activateContractWithGateway(row.value.id)
    if (!r.ok) err.value = r.message ?? 'Falha ao ativar.'
    else if (r.checkoutUrl) {
      window.open(r.checkoutUrl, '_blank', 'noopener,noreferrer')
    }
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

const canCancelContract = computed(() => row.value && row.value.status !== 'cancelled')

const canDeleteContract = computed(() => {
  if (!row.value) return false
  if (row.value.status === 'active') return false
  return true
})

async function cancelContract() {
  if (!row.value) return
  if (
    !window.confirm(
      'Cancelar este contrato? O estado passa para «cancelled» e deixa de contar como vigente para efeitos operacionais.',
    )
  ) {
    return
  }
  const reason =
    window.prompt('Motivo do cancelamento (opcional — visível só na equipa MW):')?.trim() ?? ''
  actionBusy.value = 'cancel'
  err.value = null
  const sb = getSupabase()
  const { error } = await sb
    .from('contracts')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason.length ? reason : null,
    })
    .eq('id', row.value.id)

  actionBusy.value = null
  if (error) {
    err.value = error.message
    return
  }
  await load()
}

async function deleteContractRegisto() {
  if (!row.value) return
  if (row.value.status === 'active') {
    err.value =
      'Cancele o contrato antes de eliminar o registo. Contratos «active» têm cobrança e vagas vinculadas.'
    return
  }
  if (
    !window.confirm(
      `Eliminar PERMANENTEMENTE o contrato ${row.value.contract_number}? Isto remove painéis/cobranças ligadas ao registo nesta base. Não dá para desfazer.`,
    )
  ) {
    return
  }
  actionBusy.value = 'delete'
  err.value = null
  const id = row.value.id
  const pdfPath = row.value.pdf_storage_path

  try {
    if (pdfPath) await removeContractPdfFromStorage(pdfPath)
  } catch {
    /* continuar — ficheiro pode não existir */
  }

  const sb = getSupabase()
  const { error } = await sb.from('contracts').delete().eq('id', id)
  actionBusy.value = null
  if (error) {
    err.value = error.message
    return
  }
  await router.push({
    name: 'admin-client-detail',
    params: { id: clientId.value },
    query: { tab: 'contratos' },
  })
}
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
        <div v-if="pendingCheckoutUrl" class="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <span class="font-medium">Pagamento pendente no Mercado Pago.</span>
          <a
            :href="pendingCheckoutUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-2 font-semibold text-[#c9a017] underline decoration-[#c9a017]/40 hover:decoration-[#c9a017]"
          >
            Abrir checkout
          </a>
        </div>
      </div>

      <ContractPdfPanel
        v-if="row"
        :contract-number="row.contract_number"
        :markdown="mergedSnapshotText"
        :logo-url="templateLogoUrl"
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
            actionBusy === 'activate'
              ? 'A ativar…'
              : usePaymentStub
                ? 'Ativar + cobrança (stub)'
                : 'Ativar + Checkout Mercado Pago'
          }}
        </button>
      </div>

      <div class="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        <button
          v-if="canCancelContract"
          type="button"
          class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          :disabled="actionBusy !== null"
          @click="cancelContract"
        >
          {{ actionBusy === 'cancel' ? 'A cancelar…' : 'Cancelar contrato' }}
        </button>
        <button
          v-if="canDeleteContract"
          type="button"
          class="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          :disabled="actionBusy !== null"
          @click="deleteContractRegisto"
        >
          {{ actionBusy === 'delete' ? 'A eliminar…' : 'Eliminar registo' }}
        </button>
      </div>
      <p v-if="row.status === 'active'" class="text-xs text-slate-500">
        Para eliminar o registo, cancele o contrato primeiro (contratos activos não podem ser apagados directamente).
      </p>
    </div>
  </div>
</template>
