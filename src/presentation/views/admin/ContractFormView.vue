<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'
import { mergeTemplatePlaceholders } from '@/domain/templateMerge'
import {
  placeholderValuesFromClient,
  type ClientRowLike,
} from '@/domain/clientPlaceholderValues'

const route = useRoute()
const router = useRouter()

/** Cliente sempre via `clients/:id/...`. */
const fixedClientId = computed(() => (route.params.id as string) || '')
const editContractId = computed(() =>
  typeof route.params.contractId === 'string' ? route.params.contractId : '',
)
const isEdit = computed(() => route.name === 'admin-client-contract-edit')

const clientLabel = ref('')
const clientRow = ref<ClientRowLike | null>(null)
const panels = ref<{ id: string; code: string; name: string; total_ad_slots: number }[]>([])
const templates = ref<{ id: string; name: string; version: number; body: string | null }[]>([])
const selectedTemplateId = ref('')

const start = ref(new Date().toISOString().slice(0, 10))
const end = ref(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10))
const panelSlots = ref<Record<string, number>>({})
const saving = ref(false)
const err = ref<string | null>(null)
const loading = ref(true)

const mergedPreviewMarkdown = computed(() => {
  const tpl = templates.value.find((t) => t.id === selectedTemplateId.value)
  if (!tpl?.body?.trim() || !clientRow.value) return ''
  return mergeTemplatePlaceholders(tpl.body, placeholderValuesFromClient(clientRow.value))
})

function formSnapshotForSubmit(tpl: { body: string | null } | undefined) {
  if (!clientRow.value) return null
  const body = tpl?.body ?? ''
  return {
    markdown_merged_preview: body
      ? mergeTemplatePlaceholders(body, placeholderValuesFromClient(clientRow.value))
      : '',
    generated_at: new Date().toISOString(),
  }
}

async function submit() {
  const cid = fixedClientId.value
  if (!cid) {
    err.value = 'Cliente não identificado.'
    return
  }
  if (new Date(end.value) < new Date(start.value)) {
    err.value = 'A data de fim deve ser igual ou posterior à de início.'
    return
  }

  const tpl = templates.value.find((t) => t.id === selectedTemplateId.value)

  saving.value = true
  err.value = null

  try {
    if (isEdit.value && editContractId.value) {
      await submitEdit(cid, tpl ? { id: tpl.id, version: tpl.version, body: tpl.body } : undefined)
    } else {
      await submitNew(cid, tpl ? { id: tpl.id, version: tpl.version, body: tpl.body } : undefined)
    }
  } finally {
    saving.value = false
  }
}

async function submitEdit(
  cid: string,
  tpl: { id: string; version: number; body: string | null } | undefined,
) {
  const sb = getSupabase()
  const eid = editContractId.value

  const { data: chk, error: e0 } = await sb
    .from('contracts')
    .select('id, status')
    .eq('id', eid)
    .eq('client_id', cid)
    .maybeSingle()

  if (e0 || !chk) {
    err.value = e0?.message ?? 'Contrato não encontrado.'
    return
  }
  if (!['draft', 'under_review'].includes(chk.status)) {
    err.value = 'Este contrato não pode ser editado no estado atual.'
    return
  }

  const tplFull = templates.value.find((x) => x.id === tpl?.id)
  const { error: e1 } = await sb
    .from('contracts')
    .update({
      effective_start_date: start.value,
      effective_end_date: end.value,
      template_id: tpl?.id ?? null,
      template_version: tpl !== undefined ? tpl.version : null,
      form_snapshot: formSnapshotForSubmit(tplFull) as unknown as Record<string, unknown> | null,
    })
    .eq('id', eid)

  if (e1) {
    err.value = e1.message
    return
  }

  await sb.from('contract_panels').delete().eq('contract_id', eid)

  for (const p of panels.value) {
    const n = panelSlots.value[p.id] ?? 0
    if (n <= 0) continue
    if (n > p.total_ad_slots) {
      err.value = `${p.code}: slots excedem o total do painel (${p.total_ad_slots}).`
      return
    }
    const { error: e3 } = await sb.from('contract_panels').insert({
      contract_id: eid,
      panel_id: p.id,
      slots_used: n,
    })
    if (e3) {
      err.value = e3.message
      return
    }
  }

  await router.push({
    name: 'admin-client-contract-detail',
    params: { id: cid, contractId: eid },
  })
}

async function submitNew(
  cid: string,
  tpl: { id: string; version: number; body?: string | null } | undefined,
) {
  const sb = getSupabase()
  const tplFull = templates.value.find((x) => x.id === tpl?.id)
  const { data: num, error: e1 } = await sb.rpc('next_contract_number')
  if (e1 || !num) {
    err.value = e1?.message ?? 'Falha ao gerar número'
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
      template_id: tpl?.id ?? null,
      template_version: tpl !== undefined ? tpl.version : null,
      form_snapshot: formSnapshotForSubmit(tplFull) as unknown as Record<string, unknown> | null,
    })
    .select('id')
    .single()

  if (e2 || !contract) {
    err.value = e2?.message ?? 'Erro ao criar contrato'
    return
  }

  const newId = contract.id as string

  for (const p of panels.value) {
    const n = panelSlots.value[p.id] ?? 0
    if (n <= 0) continue
    if (n > p.total_ad_slots) {
      err.value = `${p.code}: slots excedem o total do painel (${p.total_ad_slots}).`
      return
    }
    const { error: e3 } = await sb.from('contract_panels').insert({
      contract_id: newId,
      panel_id: p.id,
      slots_used: n,
    })
    if (e3) {
      err.value = e3.message
      return
    }
  }

  await router.push({
    name: 'admin-client-detail',
    params: { id: cid },
    query: { tab: 'contratos' },
  })
}

function togglePanel(id: string, on: boolean) {
  panelSlots.value[id] = on ? 1 : 0
}

onMounted(async () => {
  loading.value = true
  err.value = null

  const sb = getSupabase()

  const p = await sb.from('panels').select('id, code, name, total_ad_slots').order('code')
  panels.value = (p.data ?? []) as typeof panels.value
  for (const x of panels.value) {
    panelSlots.value[x.id] = 0
  }

  const t = await sb
    .from('contract_templates')
    .select('id, name, version, body')
    .eq('is_active', true)
    .order('name')
  templates.value = (t.data ?? []) as typeof templates.value

  if (!fixedClientId.value) {
    err.value = 'Rota inválida: abra o contrato a partir da ficha do cliente.'
    loading.value = false
    return
  }

  const { data: cfull, error: ce } = await sb
    .from('clients')
    .select('*')
    .eq('id', fixedClientId.value)
    .maybeSingle()
  if (ce) err.value = ce.message
  else if (!cfull) err.value = 'Cliente não encontrado para este registo.'
  else {
    clientRow.value = cfull as ClientRowLike
    clientLabel.value = (cfull as { legal_name?: string }).legal_name ?? 'Cliente'
  }

  if (isEdit.value && editContractId.value) {
    const { data: con, error: ec } = await sb
      .from('contracts')
      .select(
        'id, effective_start_date, effective_end_date, template_id, status, client_id',
      )
      .eq('id', editContractId.value)
      .maybeSingle()

    if (ec) err.value = ec.message
    else if (!con || con.client_id !== fixedClientId.value) {
      err.value = 'Contrato não encontrado neste cliente.'
    } else if (!['draft', 'under_review'].includes(con.status)) {
      err.value = 'Só é possível editar contratos em rascunho ou em revisão.'
    } else {
      start.value = con.effective_start_date
      end.value = con.effective_end_date
      selectedTemplateId.value = con.template_id ?? ''

      const { data: cps } = await sb.from('contract_panels').select('panel_id, slots_used').eq('contract_id', con.id)
      for (const x of panels.value) panelSlots.value[x.id] = 0
      for (const line of cps ?? []) {
        panelSlots.value[line.panel_id as string] = line.slots_used as number
      }
    }
  }

  loading.value = false
})
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-slate-900">
      {{ isEdit ? 'Editar contrato' : 'Novo contrato (anexo ao cliente)' }}
    </h1>
    <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>
    <p v-if="loading" class="mt-4 text-sm text-slate-500">A carregar…</p>
    <template v-else>
      <p class="mt-1 text-sm text-slate-600">
        {{
          isEdit ? 'Contrato em cliente' : 'Rascunho vinculado a'
        }}
        <span class="font-medium text-slate-800">{{ clientLabel || '…' }}</span
        >. O PDF não altera vagas no mapa.
      </p>
      <form class="mt-6 max-w-2xl space-y-4" @submit.prevent="submit">
        <div>
          <label class="block text-xs font-medium text-slate-600">
            Modelo de contrato (opcional)
            <select
              v-model="selectedTemplateId"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Nenhum —</option>
              <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">
                {{ tpl.name }} (v{{ tpl.version }})
              </option>
            </select>
          </label>
          <p class="mt-1 text-xs text-slate-500">
            Definir textos, variáveis e logo na área Contratos —
            <RouterLink to="/admin/contracts" class="font-medium text-[#c9a017] underline">modelos</RouterLink>.
          </p>
          <div
            v-if="mergedPreviewMarkdown"
            class="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800"
          >
            <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Pré-visualização com dados deste cliente
            </p>
            <pre class="whitespace-pre-wrap font-sans">{{ mergedPreviewMarkdown }}</pre>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-xs font-medium text-slate-600">
            Início vigência
            <input
              v-model="start"
              type="date"
              required
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-xs font-medium text-slate-600">
            Fim vigência
            <input
              v-model="end"
              type="date"
              required
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
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
            {{ saving ? 'A guardar…' : isEdit ? 'Guardar alterações' : 'Criar rascunho' }}
          </button>
          <RouterLink
            v-if="fixedClientId && isEdit && editContractId"
            :to="{ name: 'admin-client-contract-detail', params: { id: fixedClientId, contractId: editContractId } }"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm"
          >
            Cancelar
          </RouterLink>
          <RouterLink
            v-else-if="fixedClientId"
            :to="{ name: 'admin-client-detail', params: { id: fixedClientId }, query: { tab: 'contratos' } }"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm"
          >
            Voltar à ficha do cliente
          </RouterLink>
        </div>
      </form>
    </template>
  </div>
</template>
