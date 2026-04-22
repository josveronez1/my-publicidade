<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'

const props = withDefaults(
  defineProps<{
    /** Quando `true`, usado em ClientHubView; título e cancelar para lista ajustados. */
    embed?: boolean
    /** Obrigatório em modo embed (UUID do cliente). */
    clientId?: string
    /** `all` = ecrã completo (novo ou legado). `dados` / `paineis` = separadores no hub. */
    section?: 'all' | 'dados' | 'paineis'
  }>(),
  { embed: false, section: 'all' },
)

const route = useRoute()
const router = useRouter()

const id = computed(() => {
  if (props.embed && props.clientId) return props.clientId
  return (route.params.id as string) || undefined
})

const isNew = computed(() => !id.value)

const form = ref({
  legal_name: '',
  trade_name: '',
  document_type: 'cnpj',
  document_number: '',
  email_commercial: '',
  phone: '',
  city: '',
  state: '',
  postal_code: '',
  status: 'active' as 'lead' | 'active' | 'inactive' | 'churned',
  payment_terms_days: 30,
  notes_internal: '',
})

const saving = ref(false)
const err = ref<string | null>(null)

type PanelOption = { id: string; name: string; code: string }
const allPanels = ref<PanelOption[]>([])
const selectedPanelIds = ref<string[]>([])

const showDados = computed(() => props.section === 'all' || props.section === 'dados')
const showPaineis = computed(() => props.section === 'all' || props.section === 'paineis')

const pageTitle = computed(() => {
  if (props.embed) {
    if (props.section === 'dados') return 'Dados e pagamento'
    if (props.section === 'paineis') return 'Painéis vinculados'
  }
  return isNew.value ? 'Novo cliente' : 'Editar cliente'
})

function togglePanel(pid: string) {
  const set = new Set(selectedPanelIds.value)
  if (set.has(pid)) set.delete(pid)
  else set.add(pid)
  selectedPanelIds.value = Array.from(set)
}

async function loadPanels() {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('panels')
    .select('id, name, code')
    .order('name')
  if (error) {
    err.value = error.message
    return
  }
  allPanels.value = (data ?? []) as PanelOption[]
}

async function loadClientPanelIds(clientId: string) {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('client_panels')
    .select('panel_id')
    .eq('client_id', clientId)
  if (error) {
    err.value = error.message
    return
  }
  selectedPanelIds.value = (data ?? []).map((r: { panel_id: string }) => r.panel_id)
}

async function replaceClientPanels(clientId: string, panelIds: string[]) {
  const sb = getSupabase()
  const { error: delErr } = await sb.from('client_panels').delete().eq('client_id', clientId)
  if (delErr) throw new Error(delErr.message)
  if (panelIds.length === 0) return
  const rows = panelIds.map((panel_id) => ({ client_id: clientId, panel_id }))
  const { error: insErr } = await sb.from('client_panels').insert(rows)
  if (insErr) throw new Error(insErr.message)
}

async function load() {
  err.value = null
  if (showPaineis.value) await loadPanels()
  if (!id.value) {
    if (isNew.value) {
      form.value = {
        legal_name: '',
        trade_name: '',
        document_type: 'cnpj',
        document_number: '',
        email_commercial: '',
        phone: '',
        city: '',
        state: '',
        postal_code: '',
        status: 'active',
        payment_terms_days: 30,
        notes_internal: '',
      }
      selectedPanelIds.value = []
      if (showPaineis.value) await loadPanels()
    }
    return
  }
  if (showDados.value) {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('clients')
      .select(
        'legal_name, trade_name, document_type, document_number, email_commercial, phone, city, state, postal_code, status, payment_terms_days, notes_internal',
      )
      .eq('id', id.value)
      .maybeSingle()
    if (error) {
      err.value = error.message
      return
    }
    if (!data) {
      err.value = 'Cliente não encontrado.'
      return
    }
    form.value = {
      legal_name: data.legal_name ?? '',
      trade_name: data.trade_name ?? '',
      document_type: data.document_type ?? 'cnpj',
      document_number: data.document_number ?? '',
      email_commercial: data.email_commercial ?? '',
      phone: data.phone ?? '',
      city: data.city ?? '',
      state: data.state ?? '',
      postal_code: data.postal_code ?? '',
      status: (data.status as typeof form.value.status) ?? 'active',
      payment_terms_days: data.payment_terms_days ?? 30,
      notes_internal: data.notes_internal ?? '',
    }
  } else {
    if (!allPanels.value.length) await loadPanels()
  }
  if (showPaineis.value) await loadClientPanelIds(id.value)
}

onMounted(load)

async function save() {
  saving.value = true
  err.value = null
  const sec = props.section
  try {
    if (isNew.value) {
      if (sec !== 'all') {
        err.value = 'Criação de cliente só no fluxo completo (Novo cliente).'
        return
      }
    }
    const sb = getSupabase()
    const payload = {
      legal_name: form.value.legal_name.trim(),
      trade_name: form.value.trade_name.trim() || null,
      document_type: form.value.document_type.trim() || 'cnpj',
      document_number: form.value.document_number.trim(),
      email_commercial: form.value.email_commercial.trim() || null,
      phone: form.value.phone.trim() || null,
      city: form.value.city.trim() || null,
      state: form.value.state.trim().toUpperCase().slice(0, 2) || null,
      postal_code: form.value.postal_code.trim() || null,
      status: form.value.status,
      payment_terms_days: Number.isFinite(form.value.payment_terms_days)
        ? form.value.payment_terms_days
        : 30,
      notes_internal: form.value.notes_internal.trim() || null,
    }

    if (sec === 'dados' || sec === 'all') {
      if (!payload.legal_name || !payload.document_number) {
        err.value = 'Preencha razão social e documento.'
        return
      }
    }

    if (sec === 'paineis' && id.value) {
      try {
        await replaceClientPanels(id.value, selectedPanelIds.value)
      } catch (e) {
        err.value = e instanceof Error ? e.message : 'Erro ao vincular painéis.'
        return
      }
      if (props.embed) {
        await router.replace({ path: `/admin/clients/${id.value}`, query: { ...route.query, tab: 'paineis' } })
      } else {
        await router.push('/admin/clients')
      }
      return
    }

    if (sec === 'dados' && id.value) {
      const { error } = await sb.from('clients').update(payload).eq('id', id.value)
      if (error) {
        err.value = error.message
        return
      }
      if (props.embed) {
        await router.replace({ path: `/admin/clients/${id.value}`, query: { ...route.query, tab: 'dados' } })
      } else {
        await router.push('/admin/clients')
      }
      return
    }

    if (sec === 'all' && isNew.value) {
      if (!payload.legal_name || !payload.document_number) {
        err.value = 'Preencha razão social e documento.'
        return
      }
      const { data, error } = await sb.from('clients').insert(payload).select('id').single()
      if (error) {
        err.value = error.message
        return
      }
      if (!data?.id) {
        err.value = 'Não foi possível obter o ID do cliente.'
        return
      }
      try {
        await replaceClientPanels(data.id, selectedPanelIds.value)
      } catch (e) {
        err.value = e instanceof Error ? e.message : 'Erro ao vincular painéis.'
        return
      }
      await router.replace({ path: `/admin/clients/${data.id}`, query: { tab: 'dados' } })
      return
    }

    if (sec === 'all' && id.value) {
      const { error } = await sb.from('clients').update(payload).eq('id', id.value)
      if (error) {
        err.value = error.message
        return
      }
      try {
        await replaceClientPanels(id.value, selectedPanelIds.value)
      } catch (e) {
        err.value = e instanceof Error ? e.message : 'Erro ao vincular painéis.'
        return
      }
      await router.push('/admin/clients')
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : 'Erro inesperado ao salvar.'
    console.error(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <h1
      v-if="!embed"
      class="text-xl font-semibold text-slate-900"
    >
      {{ pageTitle }}
    </h1>
    <h2
      v-else
      class="text-base font-semibold text-slate-800"
    >
      {{ pageTitle }}
    </h2>
    <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>

    <form class="mt-4 max-w-2xl space-y-4" @submit.prevent="save">
      <div
        v-if="showDados"
        class="grid gap-3 sm:grid-cols-2"
      >
        <label class="block text-xs font-medium text-slate-600 sm:col-span-2">
          Razão social
          <input
            v-model="form.legal_name"
            required
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-xs font-medium text-slate-600 sm:col-span-2">
          Nome fantasia
          <input v-model="form.trade_name" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Tipo de documento
          <select v-model="form.document_type" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="cnpj">CNPJ</option>
            <option value="cpf">CPF</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Número do documento
          <input
            v-model="form.document_number"
            required
            autocomplete="off"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          E-mail comercial
          <input
            v-model="form.email_commercial"
            type="email"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Telefone
          <input v-model="form.phone" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Cidade
          <input v-model="form.city" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          UF
          <input
            v-model="form.state"
            maxlength="2"
            placeholder="RS"
            class="mt-1 w-full uppercase rounded-lg border border-slate-200 px-3 py-2 text-sm"
            @blur="form.state = form.state.trim().toUpperCase().slice(0, 2)"
          />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          CEP
          <input v-model="form.postal_code" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Status
          <select v-model="form.status" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="lead">Lead</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="churned">Encerrado</option>
          </select>
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Prazo de pagamento (dias)
          <input
            v-model.number="form.payment_terms_days"
            type="number"
            min="0"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-xs font-medium text-slate-600 sm:col-span-2">
          Observações internas
          <textarea
            v-model="form.notes_internal"
            rows="3"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Visível só para a equipe MW."
          />
        </label>
      </div>

      <div
        v-if="showPaineis"
        class="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2"
      >
        <p v-if="section === 'all'" class="text-xs font-medium text-slate-700">Painéis vinculados a este cliente</p>
        <p class="mt-1 text-xs text-slate-500">
          Cada víncio conta no mapa público para vagas, até existir contrato ativo a cobrir o mesmo par cliente+painel.
        </p>
        <ul
          v-if="allPanels.length"
          class="mt-3 max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2"
        >
          <li v-for="p in allPanels" :key="p.id">
            <label class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white">
              <input
                type="checkbox"
                class="mt-0.5 rounded border-slate-300"
                :checked="selectedPanelIds.includes(p.id)"
                @change="togglePanel(p.id)"
              />
              <span>
                <span class="font-mono text-xs text-slate-500">{{ p.code }}</span>
                <span class="ml-1.5 text-slate-800">{{ p.name }}</span>
              </span>
            </label>
          </li>
        </ul>
        <p v-else class="mt-2 text-xs text-slate-500">Nenhum painel cadastrado. Crie painéis no menu Painéis.</p>
      </div>

      <p
        v-if="section === 'all'"
        class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
      >
        O cliente final não acessa este sistema. Propostas e ficheiros seguem por e-mail e links enviados pela MW.
      </p>

      <div class="flex flex-wrap gap-2 pt-2">
        <button
          type="submit"
          class="rounded-lg bg-[#e7bb0e] px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c] disabled:opacity-50"
          :disabled="saving"
        >
          {{ saving ? 'Salvando…' : 'Salvar' }}
        </button>
        <RouterLink
          v-if="!embed"
          to="/admin/clients"
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </RouterLink>
      </div>
    </form>
  </div>
</template>
