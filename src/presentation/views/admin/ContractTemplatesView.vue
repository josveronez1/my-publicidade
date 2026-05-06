<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

function bracesKey(key: string) {
  return `{{${key}}}`
}
import { RouterLink } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'
import { extractPlaceholderKeys } from '@/domain/templateMerge'
import { PLACEHOLDER_CHEATSHEET } from '@/domain/clientPlaceholderValues'
import {
  contractTemplateLogoSignedUrl,
  deleteContractTemplateLogo,
  uploadContractTemplateLogo,
} from '@/infrastructure/storage/contractTemplateLogo'

type Row = {
  id: string
  name: string
  slug: string
  version: number
  body: string
  body_format: string
  is_active: boolean
  logo_storage_path: string | null
}

const rows = ref<Row[]>([])
const err = ref<string | null>(null)
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)

const selected = ref<Row | null>(null)
const editingNew = ref(false)

const logoPreviewUrl = ref<string | null>(null)
const logoBusy = ref(false)

const draft = ref({
  name: '',
  slug: '',
  body:
    '# Contrato MW\n\nEntre **`{{empresa_mw}}`** e **`{{razao_social}}`**, documento **{{tipo_documento}} {{cnpj}}**, com prazo de {{prazo_pagamento_dias}} dias.\n\nCidade/UF: {{cidade}} / {{uf}} · CEP: {{cep}}',
  is_active: true,
})

watch(
  () => selected.value?.logo_storage_path,
  async () => {
    logoPreviewUrl.value = null
    const p = selected.value?.logo_storage_path
    if (!p) return
    logoPreviewUrl.value = await contractTemplateLogoSignedUrl(p)
  },
  { immediate: true },
)

onMounted(load)

async function load() {
  loading.value = true
  err.value = null
  const sb = getSupabase()
  const { data, error } = await sb
    .from('contract_templates')
    .select('id, name, slug, version, body, body_format, is_active, logo_storage_path')
    .order('name')
    .limit(500)
  if (error) err.value = error.message
  else rows.value = (data ?? []) as Row[]
  loading.value = false
}

function startNew() {
  editingNew.value = true
  selected.value = null
  logoPreviewUrl.value = null
  draft.value = {
    name: '',
    slug: '',
    body:
      '# Contrato MW\n\nEntre **`{{empresa_mw}}`** e **`{{razao_social}}`**, documento {{tipo_documento}} **{{cnpj}}**.\n\nContacto comercial: {{email_comercial}} · {{telefone}}',
    is_active: true,
  }
}

function openEdit(row: Row) {
  editingNew.value = false
  selected.value = row
}

function cancelEdit() {
  selected.value = null
  editingNew.value = false
  logoPreviewUrl.value = null
}

async function saveNew() {
  if (!draft.value.name.trim() || !draft.value.slug.trim()) {
    err.value = 'Nome e slug são obrigatórios.'
    return
  }
  saving.value = true
  err.value = null
  const sb = getSupabase()
  const keys = extractPlaceholderKeys(draft.value.body)
  const { error, data } = await sb
    .from('contract_templates')
    .insert({
      name: draft.value.name.trim(),
      slug: draft.value.slug.trim().toLowerCase().replace(/\s+/g, '-'),
      body: draft.value.body,
      body_format: 'markdown',
      is_active: draft.value.is_active,
      placeholders_schema: { keys },
    })
    .select('id, name, slug, version, body, body_format, is_active, logo_storage_path')
    .maybeSingle()

  saving.value = false
  if (error) {
    err.value = error.message
    return
  }
  editingNew.value = false
  await load()
  if (data) {
    selected.value = (data as Row) ?? null
  }
}

async function saveExisting() {
  if (!selected.value) return
  const sid = selected.value.id
  saving.value = true
  err.value = null
  const sb = getSupabase()
  const keys = extractPlaceholderKeys(selected.value.body)
  const { error } = await sb
    .from('contract_templates')
    .update({
      name: selected.value.name.trim(),
      body: selected.value.body,
      is_active: selected.value.is_active,
      placeholders_schema: { keys },
    })
    .eq('id', sid)

  saving.value = false
  if (error) err.value = error.message
  else {
    await load()
    selected.value = rows.value.find((r) => r.id === sid) ?? null
  }
}

async function onLogoFile(ev: Event) {
  if (!selected.value) {
    err.value = 'Guarde o modelo primeiro (botão «Guardar modelo» ou «Guardar alterações») e volte aqui.'
    return
  }
  const inp = ev.target as HTMLInputElement
  const file = inp.files?.[0]
  inp.value = ''
  if (!file || !file.type.startsWith('image/')) {
    err.value = 'Seleccione um ficheiro de imagem.'
    return
  }

  const templateId = selected.value.id

  logoBusy.value = true
  err.value = null
  const oldPath = selected.value.logo_storage_path
  const up = await uploadContractTemplateLogo(templateId, file)
  if (!up.path) {
    err.value = up.message ?? 'Falha no upload'
    logoBusy.value = false
    return
  }
  if (oldPath) await deleteContractTemplateLogo(oldPath)

  const sb = getSupabase()
  const { error: e2 } = await sb
    .from('contract_templates')
    .update({ logo_storage_path: up.path })
    .eq('id', templateId)
  logoBusy.value = false
  if (e2) {
    err.value = e2.message
    return
  }
  if (selected.value) {
    selected.value.logo_storage_path = up.path
    logoPreviewUrl.value = await contractTemplateLogoSignedUrl(up.path)
  }
  await load()
  const fresh = rows.value.find((r) => r.id === templateId)
  if (fresh) selected.value = fresh
}

async function removeLogo() {
  if (!selected.value?.logo_storage_path) return
  logoBusy.value = true
  const path = selected.value.logo_storage_path
  await deleteContractTemplateLogo(path)
  const sb = getSupabase()
  await sb.from('contract_templates').update({ logo_storage_path: null }).eq('id', selected.value.id)
  logoBusy.value = false
  logoPreviewUrl.value = null
  if (selected.value) selected.value.logo_storage_path = null
  await load()
}

async function deleteSelectedTemplate() {
  if (!selected.value) return
  const row = selected.value
  const ok = window.confirm(
    `Eliminar o modelo «${row.name}» (v${row.version})?\n\nContratos que usavam este modelo ficam sem modelo associado (template_id anulado). Esta acção não pode ser desfeita.`,
  )
  if (!ok) return

  deleting.value = true
  err.value = null
  try {
    if (row.logo_storage_path) {
      await deleteContractTemplateLogo(row.logo_storage_path)
    }
    const sb = getSupabase()
    const { error } = await sb.from('contract_templates').delete().eq('id', row.id)
    if (error) {
      err.value =
        error.message +
        (error.message.includes('foreign key') || error.code === '23503'
          ? ' Aplique a migration `20260422150000_contracts_template_on_delete_set_null.sql` no Supabase se ainda não correu.'
          : '')
      return
    }
    cancelEdit()
    await load()
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Modelos de contrato</h1>
        <p class="mt-1 max-w-3xl text-sm text-slate-600">
          Defina o texto (Markdown suportado) com variáveis
          <code class="rounded bg-slate-100 px-1">&#123;&#123;razao_social&#125;&#125;</code>. Na ficha do cliente,
          ao criar um
          contrato, os valores vêm automaticamente do cadastro desse cliente. Opcionalmente, envie um logo por modelo.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          to="/admin/contracts/registros"
          class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Registos de contratos
        </RouterLink>
        <button
          type="button"
          class="rounded-lg bg-[#e7bb0e] px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c]"
          @click="startNew"
        >
          Novo modelo
        </button>
      </div>
    </div>

    <p v-if="err" class="mt-3 text-sm text-red-600">{{ err }}</p>

    <div class="mt-6 grid gap-6 lg:grid-cols-[1fr,minmax(20rem,24rem)] lg:items-start">
      <div>
        <h2 class="text-sm font-semibold text-slate-800">Modelos gravados</h2>
        <p v-if="loading" class="mt-2 text-sm text-slate-500">A carregar…</p>
        <ul v-else class="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          <li v-if="rows.length === 0" class="px-3 py-8 text-center text-sm text-slate-500">
            Nenhum modelo. Crie o primeiro ao lado ou com «Novo modelo».
          </li>
          <li
            v-for="r in rows"
            :key="r.id"
            class="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-slate-50"
            @click="openEdit(r)"
          >
            <span class="font-medium text-slate-900">{{ r.name }}</span>
            <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{{ r.slug }}</span>
            <span class="text-xs text-slate-500">v{{ r.version }}</span>
            <span
              class="text-xs font-medium"
              :class="r.is_active ? 'text-emerald-600' : 'text-slate-400'"
              >{{ r.is_active ? 'Activo' : 'Inactivo' }}</span
            >
          </li>
        </ul>
      </div>

      <aside
        class="rounded-xl border border-amber-100/90 bg-amber-50/50 p-4 text-xs lg:sticky lg:top-4 lg:z-[1] lg:max-h-[min(32rem,calc(100dvh-6rem))] lg:overflow-y-auto"
      >
        <p class="font-semibold text-slate-800">Variáveis disponíveis (cadastro cliente)</p>
        <ul class="mt-2 space-y-1 text-slate-700 lg:max-h-none">
          <li v-for="h in PLACEHOLDER_CHEATSHEET" :key="h.key">
            <code class="rounded bg-white px-1 py-px text-[11px]">{{ bracesKey(h.key) }}</code>
            <span class="text-slate-500"> · {{ h.label }} — {{ h.source }}</span>
          </li>
        </ul>
      </aside>
    </div>

    <!-- Novo modelo -->
    <div
      v-if="editingNew"
      class="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 class="text-sm font-semibold text-slate-800">Novo modelo</h2>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label class="text-xs font-medium text-slate-600">
          Nome
          <input
            v-model="draft.name"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="ex.: Prestação mensal vigência única"
          />
        </label>
        <label class="text-xs font-medium text-slate-600">
          Slug (único por versão)
          <input
            v-model="draft.slug"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            placeholder="ex.: midia-led-2026"
          />
        </label>
      </div>
      <label class="mt-3 block text-xs font-medium text-slate-600">
        Corpo (Markdown + placeholders)
        <textarea v-model="draft.body" rows="14" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" />
      </label>
      <label class="mt-3 flex items-center gap-2 text-xs text-slate-700">
        <input v-model="draft.is_active" type="checkbox" />
        Modelo disponível ao criar contrato na ficha cliente
      </label>
      <div class="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg bg-[#e7bb0e] px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c] disabled:opacity-50"
          :disabled="saving"
          @click="saveNew"
        >
          Guardar modelo
        </button>
        <button type="button" class="rounded-lg border border-slate-200 px-4 py-2 text-sm" @click="cancelEdit">
          Cancelar
        </button>
      </div>
      <p class="mt-3 text-[11px] text-slate-500">
        Depois de guardado, pode acrescentar o logo na vista de edição do modelo.
      </p>
    </div>

    <!-- Editar existente -->
    <div
      v-else-if="selected"
      class="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-800">Editar: {{ selected.name }}</h2>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            :disabled="deleting || saving || logoBusy"
            @click="deleteSelectedTemplate"
          >
            {{ deleting ? 'A eliminar…' : 'Eliminar modelo' }}
          </button>
          <button type="button" class="text-xs font-medium text-slate-600 hover:text-slate-900" @click="cancelEdit">
            Fechar
          </button>
        </div>
      </div>
      <label class="mt-3 block text-xs font-medium text-slate-600">
        Nome
        <input
          v-model="selected.name"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <p class="mt-2 text-[11px] text-slate-500">
        Slug: <span class="font-mono">{{ selected.slug }}</span> · não editável aqui para manter unicidade na base.
      </p>
      <label class="mt-3 block text-xs font-medium text-slate-600">
        Corpo
        <textarea v-model="selected.body" rows="14" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" />
      </label>
      <label class="mt-3 flex items-center gap-2 text-xs text-slate-700">
        <input v-model="selected.is_active" type="checkbox" />
        Disponível na ficha cliente
      </label>

      <div class="mt-4 rounded-lg border border-dashed border-slate-300 p-4">
        <p class="text-xs font-semibold text-slate-800">Logo do modelo</p>
        <p class="mt-1 text-[11px] text-slate-500">PNG/JPG/WebP. Aparecerá onde integrar pré-visualização ou PDF mais tarde.</p>
        <div v-if="logoPreviewUrl" class="mt-3">
          <img :src="logoPreviewUrl" alt="" class="max-h-28 max-w-full rounded border border-slate-200 bg-white object-contain p-2" />
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <label class="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50">
            <input type="file" accept="image/*" class="sr-only" :disabled="logoBusy" @change="onLogoFile" />
            {{ logoBusy ? 'A enviar…' : 'Carregar logo' }}
          </label>
          <button
            v-if="selected.logo_storage_path"
            type="button"
            class="text-xs font-medium text-red-600 hover:underline"
            :disabled="logoBusy"
            @click="removeLogo"
          >
            Remover logo
          </button>
        </div>
      </div>

      <button
        type="button"
        class="mt-4 rounded-lg bg-[#e7bb0e] px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c] disabled:opacity-50"
        :disabled="saving"
        @click="saveExisting"
      >
        Guardar alterações ao texto / estado
      </button>
    </div>
  </div>
</template>
