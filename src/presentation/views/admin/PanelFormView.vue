<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAdminPanelMap } from '@/composables/useAdminPanelMap'
import { useTargetAudienceTags } from '@/composables/useTargetAudienceTags'
import { getSupabase } from '@/infrastructure/supabaseClient'
import {
  buildPanelAddressQuery,
  nominatimForward,
  nominatimReverse,
} from '@/infrastructure/geocoding/nominatim'
import { buildPanelMediaPath, createPanelMediaSignedUrl } from '@/infrastructure/storage/panelMedia'

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
  target_audience_tags: [] as string[],
  panel_type: 'indoor_led',
  status: 'active',
  address_line1: '',
  city: '',
  state: '',
  postal_code: '',
  latitude: null as number | null,
  longitude: null as number | null,
  width_m: null as number | null,
  height_m: null as number | null,
  gallery_paths: [] as string[],
  total_ad_slots: 1,
  is_published: false,
})

const saving = ref(false)
const err = ref<string | null>(null)
const geocodingLoading = ref(false)
const geocodingError = ref<string | null>(null)
const reverseLabel = ref<string | null>(null)
const allowAutoGeocode = ref(false)
const mapEl = ref<HTMLElement | null>(null)

const mediaBusy = ref(false)
const mediaErr = ref<string | null>(null)
const galleryUrls = ref<Record<string, string>>({})
const fileInputEl = ref<HTMLInputElement | null>(null)

const deleting = ref(false)

const { tags: audienceCatalog, load: loadAudienceCatalog, ensureTagsExist } = useTargetAudienceTags()
const audienceInput = ref('')
const audienceSuggestions = computed(() => {
  const q = audienceInput.value.trim().toLowerCase()
  if (!q) return []
  const already = new Set(form.value.target_audience_tags.map((s) => s.toLowerCase()))
  return audienceCatalog.value
    .filter((t) => t.toLowerCase().includes(q) && !already.has(t.toLowerCase()))
    .slice(0, 8)
})

const advLatStr = ref('')
const advLngStr = ref('')

const pinLat = computed<number | null>({
  get() {
    const v = form.value.latitude
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  },
  set(v: number | null) {
    form.value.latitude = v
  },
})

const pinLng = computed<number | null>({
  get() {
    const v = form.value.longitude
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  },
  set(v: number | null) {
    form.value.longitude = v
  },
})

const { init: initMap } = useAdminPanelMap(mapEl, pinLat, pinLng)

const addressReady = computed(
  () =>
    !!form.value.address_line1.trim() &&
    !!form.value.city.trim() &&
    !!form.value.state.trim(),
)

function formatCoord(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—'
  return n.toFixed(6)
}

/** Aceita vírgula decimal (pt-BR). */
function parseCoord(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function syncAdvancedInputs() {
  advLatStr.value =
    form.value.latitude != null && Number.isFinite(form.value.latitude)
      ? String(form.value.latitude)
      : ''
  advLngStr.value =
    form.value.longitude != null && Number.isFinite(form.value.longitude)
      ? String(form.value.longitude)
      : ''
}

function onAdvancedToggle(ev: Event) {
  const el = ev.target as HTMLDetailsElement
  if (el.open) syncAdvancedInputs()
}

function applyAdvancedCoords() {
  const lat = parseCoord(advLatStr.value)
  const lng = parseCoord(advLngStr.value)
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    err.value = 'Coordenadas avançadas inválidas.'
    return
  }
  err.value = null
  form.value.latitude = lat
  form.value.longitude = lng
}

async function runForwardGeocode() {
  if (!addressReady.value) return
  const q = buildPanelAddressQuery({
    address_line1: form.value.address_line1,
    city: form.value.city,
    state: form.value.state,
    postal_code: form.value.postal_code,
  })
  geocodingLoading.value = true
  geocodingError.value = null
  try {
    const hit = await nominatimForward(q)
    if (!hit) {
      geocodingError.value =
        'Não encontramos esse endereço. Ajuste os campos ou posicione o pin no mapa (clique ou arraste).'
      return
    }
    form.value.latitude = hit.lat
    form.value.longitude = hit.lon
    reverseLabel.value =
      hit.displayName ?? (await nominatimReverse(hit.lat, hit.lon)) ?? null
  } catch (e) {
    console.error(e)
    geocodingError.value = 'Falha ao consultar o geocodificador. Tente de novo em instantes.'
  } finally {
    geocodingLoading.value = false
  }
}

let geocodeDebounce: ReturnType<typeof setTimeout> | null = null
watch(
  () => [
    form.value.address_line1,
    form.value.city,
    form.value.state,
    form.value.postal_code,
  ],
  () => {
    if (!allowAutoGeocode.value) return
    if (geocodeDebounce) {
      clearTimeout(geocodeDebounce)
      geocodeDebounce = null
    }
    geocodingError.value = null
    if (!addressReady.value) return
    geocodeDebounce = setTimeout(() => {
      geocodeDebounce = null
      runForwardGeocode()
    }, 900)
  },
)

let reverseDebounce: ReturnType<typeof setTimeout> | null = null
watch(
  () => [form.value.latitude, form.value.longitude] as const,
  () => {
    const lat = form.value.latitude
    const lng = form.value.longitude
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      reverseLabel.value = null
      return
    }
    if (reverseDebounce) clearTimeout(reverseDebounce)
    reverseDebounce = setTimeout(async () => {
      reverseDebounce = null
      const la = form.value.latitude
      const ln = form.value.longitude
      if (la === null || ln === null) return
      reverseLabel.value = await nominatimReverse(la, ln)
    }, 450)
  },
)

onMounted(async () => {
  loadAudienceCatalog()
  if (!isNew.value) {
    const sb = getSupabase()
    const { data, error } = await sb.from('panels').select('*').eq('id', id.value!).single()
    if (error) {
      err.value = error.message
    } else if (data) {
      form.value = {
        code: data.code,
        name: data.name,
        slug: data.slug,
        description: data.description ?? '',
        target_audience: data.target_audience ?? '',
        target_audience_tags: Array.isArray(data.target_audience_tags)
          ? (data.target_audience_tags as string[])
          : [],
        panel_type: data.panel_type,
        status: data.status,
        address_line1: data.address_line1 ?? '',
        city: data.city ?? '',
        state: data.state ?? '',
        postal_code: data.postal_code ?? '',
        latitude: typeof data.latitude === 'number' ? data.latitude : null,
        longitude: typeof data.longitude === 'number' ? data.longitude : null,
        width_m: typeof data.width_m === 'number' ? data.width_m : null,
        height_m: typeof data.height_m === 'number' ? data.height_m : null,
        gallery_paths: Array.isArray(data.gallery_paths) ? (data.gallery_paths as string[]) : [],
        total_ad_slots: data.total_ad_slots,
        is_published: data.is_published,
      }
      if (form.value.latitude != null && form.value.longitude != null) {
        const rev = await nominatimReverse(form.value.latitude, form.value.longitude)
        reverseLabel.value = rev
      }

      // Preload signed URLs for previews (best-effort)
      const urls: Record<string, string> = {}
      for (const p of form.value.gallery_paths) {
        const u = await createPanelMediaSignedUrl(p, 60 * 10)
        if (u) urls[p] = u
      }
      galleryUrls.value = urls
    }
  }
  await nextTick()
  initMap()
  allowAutoGeocode.value = true
})

function slugify(raw: string): string {
  return String(raw ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64)
}

watch(
  () => form.value.name,
  (name) => {
    if (!isNew.value) return
    const next = slugify(name)
    if (!next) return
    form.value.slug = next
  },
)

async function ensureUniqueSlug(sb: ReturnType<typeof getSupabase>, base: string): Promise<string> {
  const cleaned = slugify(base)
  if (!cleaned) return cleaned

  const { data: found } = await sb.from('panels').select('id').eq('slug', cleaned).limit(1)
  if (!found || found.length === 0) return cleaned

  for (let i = 2; i <= 9; i++) {
    const candidate = `${cleaned}-${i}`
    const { data } = await sb.from('panels').select('id').eq('slug', candidate).limit(1)
    if (!data || data.length === 0) return candidate
  }

  const suffix = String(Date.now()).slice(-4)
  return `${cleaned}-${suffix}`
}

function addAudienceTag(labelRaw: string) {
  const label = String(labelRaw ?? '').trim()
  if (!label) return
  const norm = label.toLowerCase()
  if (form.value.target_audience_tags.some((t) => t.toLowerCase() === norm)) return
  form.value.target_audience_tags = [...form.value.target_audience_tags, label]
  audienceInput.value = ''
}

function removeAudienceTag(label: string) {
  const norm = label.toLowerCase()
  form.value.target_audience_tags = form.value.target_audience_tags.filter(
    (t) => t.toLowerCase() !== norm,
  )
}

function onAudienceKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Enter' || ev.key === ',') {
    ev.preventDefault()
    addAudienceTag(audienceInput.value)
  }
  if (ev.key === 'Backspace' && !audienceInput.value) {
    const last = form.value.target_audience_tags.at(-1)
    if (last) removeAudienceTag(last)
  }
}

async function persistGalleryPaths(nextPaths: string[]) {
  const sb = getSupabase()
  const { error } = await sb.from('panels').update({ gallery_paths: nextPaths }).eq('id', id.value!)
  if (error) throw error
}

async function onPhotosSelected(ev: Event) {
  if (isNew.value || !id.value) return
  const input = ev.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return

  mediaBusy.value = true
  mediaErr.value = null
  try {
    const sb = getSupabase()
    const uploaded: string[] = []
    for (const f of files) {
      const path = buildPanelMediaPath(id.value, f.name)
      const { error } = await sb.storage.from('panel-media').upload(path, f, {
        cacheControl: '3600',
        upsert: false,
        contentType: f.type || undefined,
      })
      if (error) throw error
      uploaded.push(path)
      const u = await createPanelMediaSignedUrl(path, 60 * 10)
      if (u) galleryUrls.value = { ...galleryUrls.value, [path]: u }
    }
    const next = [...form.value.gallery_paths, ...uploaded]
    await persistGalleryPaths(next)
    form.value.gallery_paths = next
  } catch (e) {
    mediaErr.value = e instanceof Error ? e.message : 'Falha ao enviar fotos.'
    console.error(e)
  } finally {
    mediaBusy.value = false
    input.value = ''
  }
}

async function removePhoto(path: string) {
  if (isNew.value || !id.value) return
  mediaBusy.value = true
  mediaErr.value = null
  try {
    const sb = getSupabase()
    const { error } = await sb.storage.from('panel-media').remove([path])
    if (error) throw error
    const next = form.value.gallery_paths.filter((p) => p !== path)
    await persistGalleryPaths(next)
    form.value.gallery_paths = next
    const { [path]: _, ...rest } = galleryUrls.value
    galleryUrls.value = rest
  } catch (e) {
    mediaErr.value = e instanceof Error ? e.message : 'Falha ao remover foto.'
    console.error(e)
  } finally {
    mediaBusy.value = false
  }
}

async function movePhoto(path: string, dir: -1 | 1) {
  const arr = [...form.value.gallery_paths]
  const idx = arr.indexOf(path)
  const nextIdx = idx + dir
  if (idx < 0 || nextIdx < 0 || nextIdx >= arr.length) return
  ;[arr[idx], arr[nextIdx]] = [arr[nextIdx], arr[idx]]

  if (isNew.value || !id.value) {
    form.value.gallery_paths = arr
    return
  }

  mediaBusy.value = true
  mediaErr.value = null
  try {
    await persistGalleryPaths(arr)
    form.value.gallery_paths = arr
  } catch (e) {
    mediaErr.value = e instanceof Error ? e.message : 'Falha ao reordenar fotos.'
    console.error(e)
  } finally {
    mediaBusy.value = false
  }
}

async function save() {
  saving.value = true
  err.value = null
  try {
    const lat = form.value.latitude
    const lng = form.value.longitude
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      err.value =
        'Defina a localização no mapa: preencha endereço (logradouro, cidade e UF) e aguarde a busca, ou clique/arraste o pin.'
      return
    }
    const sb = getSupabase()
    await ensureTagsExist(form.value.target_audience_tags ?? [])
    const finalSlug = await ensureUniqueSlug(sb, form.value.slug || form.value.name)
    const payload = {
      ...form.value,
      latitude: lat,
      longitude: lng,
      target_audience_tags: form.value.target_audience_tags ?? [],
      gallery_paths: form.value.gallery_paths ?? [],
      slug: finalSlug,
    }
    if (isNew.value) {
      // code is generated by DB default; do not send it on insert
      const { code: _code, ...insertPayload } = payload
      const { data, error } = await sb.from('panels').insert(insertPayload).select('id')
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

async function deletePanel() {
  if (isNew.value || !id.value) return
  const ok = window.confirm(
    'Excluir este painel?\n\nEssa ação não pode ser desfeita e pode falhar se houver contratos vinculados.',
  )
  if (!ok) return

  deleting.value = true
  err.value = null
  try {
    const sb = getSupabase()

    // Best-effort cleanup of storage objects referenced by this panel
    const paths = form.value.gallery_paths ?? []
    if (paths.length > 0) {
      const { error: rmErr } = await sb.storage.from('panel-media').remove(paths)
      if (rmErr) {
        // keep going; DB deletion is more important than storage cleanup
        console.warn('[panel-media.remove]', rmErr)
      }
    }

    const { error } = await sb.from('panels').delete().eq('id', id.value)
    if (error) {
      err.value =
        error.message ||
        'Não foi possível excluir. Verifique se há contratos/vínculos com este painel.'
      return
    }
    await router.push('/admin/panels')
  } catch (e) {
    err.value = e instanceof Error ? e.message : 'Erro inesperado ao excluir.'
    console.error(e)
  } finally {
    deleting.value = false
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
      <label class="block text-xs font-medium text-slate-600">
        Nome
        <input v-model="form.name" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block text-xs font-medium text-slate-600">
        Público-alvo (tags)
        <div class="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-2">
          <div class="flex flex-wrap gap-2">
            <span
              v-for="t in form.target_audience_tags"
              :key="t"
              class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {{ t }}
              <button
                type="button"
                class="rounded-full px-1 text-slate-500 hover:text-slate-900"
                @click="removeAudienceTag(t)"
              >
                ×
              </button>
            </span>
            <input
              v-model="audienceInput"
              class="min-w-[140px] flex-1 border-0 bg-transparent px-2 py-1 text-sm outline-none"
              placeholder="Digite e pressione Enter…"
              @keydown="onAudienceKeydown"
            />
          </div>
        </div>
        <div v-if="audienceSuggestions.length > 0" class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="s in audienceSuggestions"
            :key="s"
            type="button"
            class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            @click="addAudienceTag(s)"
          >
            + {{ s }}
          </button>
        </div>
      </label>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-xs font-medium text-slate-600">
          Largura (m)
          <input
            v-model.number="form.width_m"
            type="number"
            min="0"
            step="0.01"
            placeholder="ex.: 4.00"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          Altura (m)
          <input
            v-model.number="form.height_m"
            type="number"
            min="0"
            step="0.01"
            placeholder="ex.: 2.00"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>
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

      <div class="border-t border-slate-200 pt-4">
        <h2 class="text-sm font-semibold text-slate-900">Fotos</h2>
        <p class="mt-1 text-xs text-slate-500">
          Envie fotos do painel. Você pode remover e reordenar. (Bucket: <span class="font-mono">panel-media</span>)
        </p>
        <p v-if="isNew" class="mt-2 text-xs text-slate-600">
          Salve o painel primeiro para habilitar o upload de fotos.
        </p>
        <div v-else class="mt-3 space-y-3">
          <input
            ref="fileInputEl"
            type="file"
            multiple
            accept="image/*"
            class="hidden"
            :disabled="mediaBusy"
            @change="onPhotosSelected"
          />
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-lg bg-[#e7bb0e] px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c] disabled:opacity-50"
            :disabled="mediaBusy"
            @click="fileInputEl?.click()"
          >
            {{ mediaBusy ? 'Enviando…' : 'Selecionar fotos' }}
          </button>
          <p v-if="mediaErr" class="text-xs text-red-600">{{ mediaErr }}</p>

          <div v-if="form.gallery_paths.length === 0" class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Sem fotos no momento.
          </div>

          <ul v-else class="grid gap-3 sm:grid-cols-2">
            <li
              v-for="p in form.gallery_paths"
              :key="p"
              class="overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <div class="aspect-[16/9] w-full bg-slate-100">
                <img
                  v-if="galleryUrls[p]"
                  :src="galleryUrls[p]"
                  alt=""
                  class="h-full w-full object-cover"
                />
              </div>
              <div class="flex items-center justify-between gap-2 p-2 text-xs">
                <div class="min-w-0 flex-1">
                  <p class="truncate font-mono text-[10px] text-slate-500">{{ p }}</p>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    class="rounded-md border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    :disabled="mediaBusy"
                    @click="movePhoto(p, -1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="rounded-md border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    :disabled="mediaBusy"
                    @click="movePhoto(p, 1)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class="rounded-md border border-red-200 bg-red-50 px-2 py-1 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    :disabled="mediaBusy"
                    @click="removePhoto(p)"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div class="border-t border-slate-200 pt-4">
        <h2 class="text-sm font-semibold text-slate-900">Endereço do painel</h2>
        <p class="mt-1 text-xs text-slate-500">
          Preencha o endereço; o sistema posiciona o pin automaticamente. Confira no mapa e arraste ou clique para ajustar.
        </p>
        <label class="mt-3 block text-xs font-medium text-slate-600">
          Logradouro e número
          <input
            v-model="form.address_line1"
            required
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          <label class="block text-xs font-medium text-slate-600">
            Cidade
            <input v-model="form.city" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label class="block text-xs font-medium text-slate-600">
            UF
            <input
              v-model="form.state"
              required
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
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            :disabled="geocodingLoading || !addressReady"
            @click="runForwardGeocode"
          >
            {{ geocodingLoading ? 'Buscando…' : 'Atualizar posição no mapa' }}
          </button>
          <span v-if="geocodingLoading" class="text-xs text-slate-500">Consultando Nominatim…</span>
        </div>
        <p v-if="geocodingError" class="mt-2 text-xs text-amber-800">{{ geocodingError }}</p>
      </div>

      <div class="border-t border-slate-200 pt-4">
        <h2 class="text-sm font-semibold text-slate-900">Mapa</h2>
        <p class="mt-1 text-xs text-slate-500">
          Confira se o pin está no local do painel. Arraste-o ou clique no mapa para corrigir.
        </p>
        <div
          ref="mapEl"
          class="admin-panel-map z-0 mt-3 h-[min(320px,55vh)] w-full min-h-[240px] overflow-hidden rounded-lg border border-slate-200"
        />
        <p class="mt-2 text-xs text-slate-600">
          Coordenadas atuais:
          <span class="font-mono text-slate-800">{{ formatCoord(form.latitude) }}</span>,
          <span class="font-mono text-slate-800">{{ formatCoord(form.longitude) }}</span>
        </p>
        <p v-if="reverseLabel" class="mt-1 text-xs text-slate-500">
          Ponto aproximado no mapa:
          <span class="text-slate-700">{{ reverseLabel }}</span>
        </p>
      </div>

      <details class="rounded-lg border border-slate-200 p-3 text-sm" @toggle="onAdvancedToggle">
        <summary class="cursor-pointer font-medium text-slate-700">Avançado — editar latitude/longitude manualmente</summary>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <label class="block text-xs font-medium text-slate-600">
            Latitude
            <input v-model="advLatStr" type="text" inputmode="decimal" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label class="block text-xs font-medium text-slate-600">
            Longitude
            <input v-model="advLngStr" type="text" inputmode="decimal" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>
        <button
          type="button"
          class="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200"
          @click="applyAdvancedCoords"
        >
          Aplicar coordenadas ao mapa
        </button>
      </details>

      <div class="border-t border-slate-200 pt-4">
        <h2 class="text-sm font-semibold text-slate-900">Identificação automática</h2>
        <p class="mt-1 text-xs text-slate-500">
          Código e slug são preenchidos pelo sistema (slug acompanha o nome após a primeira gravação).
        </p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <label class="block text-xs font-medium text-slate-600">
            Código
            <input
              v-model="form.code"
              readonly
              placeholder="Gerado ao salvar"
              class="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
            />
          </label>
          <label class="block text-xs font-medium text-slate-600">
            Slug
            <input
              v-model="form.slug"
              required
              readonly
              placeholder="Gerado pelo nome"
              class="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
            />
          </label>
        </div>
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
        <button
          v-if="!isNew"
          type="button"
          class="ml-auto rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          :disabled="saving || deleting"
          @click="deletePanel"
        >
          {{ deleting ? 'Excluindo…' : 'Excluir' }}
        </button>
      </div>
    </form>
  </div>
</template>
