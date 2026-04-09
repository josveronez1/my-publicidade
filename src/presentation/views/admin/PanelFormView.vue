<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id as string | undefined)
const isNew = computed(() => !id.value)

const form = ref({
  code: '',
  name: '',
  slug: '',
  description: '',
  target_audience: '',
  panel_type: 'indoor_led',
  status: 'active',
  address_line1: '',
  city: '',
  state: '',
  postal_code: '',
  /** string nos inputs (vírgula/ponto); parseCoord no save */
  latitude: '-22.5' as string | number,
  longitude: '-47' as string | number,
  total_ad_slots: 1,
  is_published: false,
})
const saving = ref(false)
const err = ref<string | null>(null)

/** Aceita vírgula decimal (pt-BR); evita NaN → null no JSON e insert quebrado. */
function parseCoord(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

onMounted(async () => {
  if (isNew.value) return
  const sb = getSupabase()
  const { data, error } = await sb.from('panels').select('*').eq('id', id.value!).single()
  if (error) {
    err.value = error.message
    return
  }
  if (data) {
    form.value = {
      code: data.code,
      name: data.name,
      slug: data.slug,
      description: data.description ?? '',
      target_audience: data.target_audience ?? '',
      panel_type: data.panel_type,
      status: data.status,
      address_line1: data.address_line1 ?? '',
      city: data.city ?? '',
      state: data.state ?? '',
      postal_code: data.postal_code ?? '',
      latitude: data.latitude,
      longitude: data.longitude,
      total_ad_slots: data.total_ad_slots,
      is_published: data.is_published,
    }
  }
})

async function save() {
  saving.value = true
  err.value = null
  try {
    const lat = parseCoord(form.value.latitude)
    const lng = parseCoord(form.value.longitude)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      err.value = 'Latitude e longitude devem ser números válidos (ex.: -29.68 ou -29,68).'
      return
    }
    const sb = getSupabase()
    const payload = { ...form.value, latitude: lat, longitude: lng }
    if (isNew.value) {
      const { data, error } = await sb.from('panels').insert(payload).select('id')
      if (error) {
        err.value = error.message
        return
      }
      const row = data?.[0]
      if (!row?.id) {
        err.value =
          'Nenhuma linha retornada ao salvar. Confira se sua conta é admin e se o RLS do projeto está aplicado.'
        return
      }
      await router.replace(`/admin/panels/${row.id}/edit`)
    } else {
      const { error } = await sb.from('panels').update(payload).eq('id', id.value!)
      if (error) {
        err.value = error.message
        return
      }
      await router.push('/admin/panels')
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
    <h1 class="text-xl font-semibold text-slate-900">
      {{ isNew ? 'Novo painel' : 'Editar painel' }}
    </h1>
    <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>
    <form class="mt-6 max-w-xl space-y-3" @submit.prevent="save">
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-xs font-medium text-slate-600">
          Código
          <input v-model="form.code" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Slug (identificador na URL, só letras, números e hífens)
          <input
            v-model="form.slug"
            required
            placeholder="ex.: espirito-santo-centro"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label class="block text-xs font-medium text-slate-600">
        Nome
        <input v-model="form.name" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block text-xs font-medium text-slate-600">
        Público-alvo
        <input v-model="form.target_audience" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block text-xs font-medium text-slate-600">
        Descrição
        <textarea v-model="form.description" rows="2" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-xs font-medium text-slate-600">
          Status operacional
          <select v-model="form.status" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="planning">Planejamento</option>
            <option value="installation">Instalação</option>
            <option value="active">Ativo</option>
            <option value="maintenance">Manutenção</option>
            <option value="inactive">Inativo</option>
          </select>
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Vagas (slots)
          <input v-model.number="form.total_ad_slots" type="number" min="1" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
      </div>
      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input v-model="form.is_published" type="checkbox" />
        Publicar no Media Kit
      </label>
      <label class="block text-xs font-medium text-slate-600">
        Endereço
        <input v-model="form.address_line1" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <div class="grid gap-3 sm:grid-cols-3">
        <label class="block text-xs font-medium text-slate-600">
          Cidade
          <input v-model="form.city" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          UF
          <input v-model="form.state" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          CEP
          <input v-model="form.postal_code" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-xs font-medium text-slate-600">
          Latitude
          <input
            v-model="form.latitude"
            type="text"
            inputmode="decimal"
            required
            placeholder="-29.684"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Longitude
          <input
            v-model="form.longitude"
            type="text"
            inputmode="decimal"
            required
            placeholder="-53.807"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div class="flex gap-2 pt-2">
        <button
          type="submit"
          class="rounded-lg bg-[#e7bb0e] px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c] disabled:opacity-50"
          :disabled="saving"
        >
          Salvar
        </button>
        <RouterLink to="/admin/panels" class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">
          Cancelar
        </RouterLink>
      </div>
    </form>
  </div>
</template>
