<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePublicPanels } from '@/composables/usePublicPanels'
import { useLeafletPublicMap } from '@/composables/useLeafletPublicMap'
import { createPanelMediaSignedUrl } from '@/infrastructure/storage/panelMedia'

const { panels, slotsByPanel, loading, error, load } = usePublicPanels()
const auth = useAuthStore()

const adminEntry = computed(() =>
  auth.isAdmin ? { to: '/admin/panels' as const, label: 'Painel' } : { to: '/login' as const, label: 'Área restrita' },
)

/** Nome fixo no cabeçalho público (produto só MW). */
const orgDisplayName = 'MW Publicidade'

const mapEl = ref<HTMLElement | null>(null)
const asideEl = ref<HTMLElement | null>(null)

const selectedPanelId = ref<string | null>(null)
const selectedPanel = computed(() =>
  selectedPanelId.value ? panels.value.find((p) => p.id === selectedPanelId.value) ?? null : null,
)

const lightboxIndex = ref<number | null>(null)

const lightboxUrl = computed(() => {
  const i = lightboxIndex.value
  const list = mediaUrls.value
  if (i == null || i < 0 || i >= list.length) return null
  return list[i] ?? null
})

function closeLightbox() {
  lightboxIndex.value = null
}

function openLightbox(url: string) {
  const i = mediaUrls.value.indexOf(url)
  if (i >= 0) lightboxIndex.value = i
}

function lightboxPrev() {
  const i = lightboxIndex.value
  if (i == null || i <= 0) return
  lightboxIndex.value = i - 1
}

function lightboxNext() {
  const i = lightboxIndex.value
  const n = mediaUrls.value.length
  if (i == null || i >= n - 1) return
  lightboxIndex.value = i + 1
}

const lightboxHasPrev = computed(
  () => lightboxIndex.value != null && lightboxIndex.value > 0,
)
const lightboxHasNext = computed(() => {
  const i = lightboxIndex.value
  const n = mediaUrls.value.length
  return i != null && i < n - 1
})

let lightboxTouchStartX = 0
function onLightboxTouchStart(e: TouchEvent) {
  lightboxTouchStartX = e.changedTouches[0]?.clientX ?? 0
}
function onLightboxTouchEnd(e: TouchEvent) {
  if (mediaUrls.value.length < 2) return
  const x = e.changedTouches[0]?.clientX ?? 0
  const d = x - lightboxTouchStartX
  if (Math.abs(d) < 56) return
  if (d > 0) lightboxPrev()
  else lightboxNext()
}

/** Clique na coluna de detalhes (aside): só fecha o lightbox, mantém o ponto selecionado. */
function onAsideClick() {
  if (lightboxUrl.value) closeLightbox()
}

function onGlobalKeydown(ev: KeyboardEvent) {
  if (lightboxUrl.value == null) return
  if (ev.key === 'Escape') {
    closeLightbox()
    return
  }
  if (mediaUrls.value.length < 2) return
  if (ev.key === 'ArrowLeft') {
    ev.preventDefault()
    lightboxPrev()
  } else if (ev.key === 'ArrowRight') {
    ev.preventDefault()
    lightboxNext()
  }
}

function focusPanelOnMap(id: string) {
  selectedPanelId.value = id
  nextTick(() => {
    asideEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
    mapCtrl.flyToPanel(id)
  })
}

function clearSelection() {
  lightboxIndex.value = null
  selectedPanelId.value = null
  quoteMsg.value = null
  nextTick(() => mapCtrl.fitAllPanels())
}

const mapCtrl = useLeafletPublicMap(mapEl, panels, {
  selectedPanelId,
  onSelectPanel: focusPanelOnMap,
  onMapBackgroundClick: clearSelection,
})

const { init } = mapCtrl

function selectPanel(p: { id: string }) {
  focusPanelOnMap(p.id)
}

const quote = ref({
  name: '',
  email: '',
  phone: '',
  company: '',
  message: '',
  website: '' as string,
})
const quoteSending = ref(false)
const quoteMsg = ref<string | null>(null)

const mediaUrls = ref<string[]>([])
const mediaLoading = ref(false)

function mapsLink(p: { latitude: number; longitude: number }) {
  return `https://www.google.com/maps?q=${p.latitude},${p.longitude}`
}

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown)
  await nextTick()
  // Mapa antes do load() dos painéis — marcadores atualizam quando `panels` chega.
  init()
  await load()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})

watch(
  () => selectedPanel.value?.id,
  async () => {
    closeLightbox()
    mediaUrls.value = []
    const p = selectedPanel.value
    const paths = (p?.gallery_paths ?? []).filter(Boolean)
    if (!p || paths.length === 0) return
    mediaLoading.value = true
    try {
      const urls: string[] = []
      for (const path of paths.slice(0, 10)) {
        const u = await createPanelMediaSignedUrl(path, 60 * 10)
        if (u) urls.push(u)
      }
      mediaUrls.value = urls
    } finally {
      mediaLoading.value = false
    }
  },
  { immediate: true },
)

function formatMeters(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null
  return n.toFixed(2).replace('.', ',')
}

async function submitQuote() {
  quoteMsg.value = null
  const trap = quote.value.website?.trim()
  if (trap) {
    quoteMsg.value = 'Envio rejeitado.'
    return
  }
  quoteSending.value = true
  try {
    const { getSupabase } = await import('@/infrastructure/supabaseClient')
    const sb = getSupabase()
    const panelLine = selectedPanel.value
      ? `Ponto: ${selectedPanel.value.name} (${[selectedPanel.value.city, selectedPanel.value.state]
          .filter(Boolean)
          .join(' / ')})`
      : null
    const mergedMessage = [panelLine, quote.value.message?.trim() || null]
      .filter(Boolean)
      .join('\n')
      .trim()
    const { error: e } = await sb.from('quote_requests').insert({
      name: quote.value.name.trim(),
      email: quote.value.email.trim(),
      phone: quote.value.phone?.trim() || null,
      company: quote.value.company?.trim() || null,
      message: mergedMessage || null,
      panel_ids: selectedPanelId.value ? [selectedPanelId.value] : null,
      honeypot: null,
    })
    if (e) {
      quoteMsg.value = e.message || 'Não foi possível enviar. Tente de novo.'
      console.error('[quote_requests]', e)
    } else {
      quoteMsg.value = 'Enviado. Entraremos em contato.'
      quote.value = {
        name: '',
        email: '',
        phone: '',
        company: '',
        message: '',
        website: '',
      }
    }
  } catch (err) {
    quoteMsg.value = err instanceof Error ? err.message : 'Erro inesperado ao enviar.'
    console.error(err)
  } finally {
    quoteSending.value = false
  }
}
</script>

<template>
  <!-- h-full + min-h-0: flex filho com mapa recebe altura real; evita célula 0px em lg com filho só absolute -->
  <div class="flex h-full min-h-0 flex-col bg-white">
    <header
      class="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3"
    >
      <RouterLink to="/" class="flex items-center gap-3">
        <img
          src="/mw-logo.jpg"
          alt=""
          class="h-10 w-10 rounded-xl object-cover"
        />
        <span class="font-semibold text-slate-900">{{ orgDisplayName }}</span>
      </RouterLink>
      <div class="flex gap-4 text-sm">
        <RouterLink
          :to="adminEntry.to"
          class="font-medium text-slate-600 hover:text-slate-900"
        >
          {{ adminEntry.label }}
        </RouterLink>
      </div>
    </header>

    <div
      class="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)]"
    >
      <div
        class="relative isolate flex min-h-[420px] flex-col border-b border-slate-200 lg:min-h-0 lg:h-full lg:border-b-0 lg:border-r"
      >
        <div
          ref="mapEl"
          class="mw-media-kit-map relative z-0 h-[min(420px,50svh)] w-full min-h-[240px] lg:h-full lg:min-h-0"
        />
        <!-- Lightbox centralizado na área do mapa; navegação ←/→ e deslize -->
        <div
          v-if="lightboxUrl"
          class="absolute inset-0 z-[8000] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-[2px] sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Galeria de fotos do ponto"
          @click.self="clearSelection"
        >
          <div
            class="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            @click.stop
          >
            <div class="relative p-2 sm:p-3">
              <button
                type="button"
                class="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-xl font-semibold leading-none text-slate-600 shadow-sm hover:bg-slate-50 sm:right-4 sm:top-4"
                aria-label="Fechar"
                @click.stop="closeLightbox"
              >
                ×
              </button>
              <!-- Quadro fixo: imagem preenche com crop (object-cover), sem “cantos vazios” -->
              <div
                class="relative mx-auto aspect-[16/10] w-full max-h-[min(72vh,640px)] max-w-full overflow-hidden bg-slate-900 sm:max-h-[min(76vh,680px)]"
                @touchstart.passive="onLightboxTouchStart"
                @touchend="onLightboxTouchEnd"
              >
                <img
                  :src="lightboxUrl"
                  alt=""
                  class="h-full w-full object-cover object-center select-none"
                  draggable="false"
                />
                <template v-if="mediaUrls.length > 1">
                  <button
                    type="button"
                    class="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-900/55 text-lg font-bold text-white shadow-md backdrop-blur-sm transition hover:bg-slate-900/75 disabled:pointer-events-none disabled:opacity-25 sm:left-3 sm:h-12 sm:w-12"
                    aria-label="Foto anterior"
                    :disabled="!lightboxHasPrev"
                    @click.stop="lightboxPrev"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-900/55 text-lg font-bold text-white shadow-md backdrop-blur-sm transition hover:bg-slate-900/75 disabled:pointer-events-none disabled:opacity-25 sm:right-3 sm:h-12 sm:w-12"
                    aria-label="Próxima foto"
                    :disabled="!lightboxHasNext"
                    @click.stop="lightboxNext"
                  >
                    ›
                  </button>
                </template>
              </div>
              <p
                v-if="mediaUrls.length > 1 && lightboxIndex != null"
                class="mt-2 text-center text-xs text-slate-500"
              >
                {{ lightboxIndex + 1 }} / {{ mediaUrls.length }}
                <span class="text-slate-400"> · ← → </span>
                <span class="hidden sm:inline text-slate-400"> · deslize no celular</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <aside
        ref="asideEl"
        class="border-t border-slate-200 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0"
        @click="onAsideClick"
      >
        <div v-if="!selectedPanel" class="p-4">
          <h2 class="text-sm font-semibold text-slate-900">Pontos publicados</h2>
          <p v-if="loading" class="mt-2 text-sm text-slate-500">Carregando…</p>
          <p v-else-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
          <ul v-else class="mt-3 space-y-3">
            <li v-for="p in panels" :key="p.id">
              <button
                type="button"
                class="w-full rounded-lg border border-slate-200 p-3 text-left text-sm hover:border-slate-300 hover:bg-slate-50"
                @click.stop="selectPanel(p)"
              >
                <p class="font-medium text-slate-900">{{ p.name }}</p>
                <p class="text-slate-600">{{ p.address_line1 }}, {{ p.city }} / {{ p.state }}</p>
                <p v-if="p.target_audience" class="mt-1 text-slate-500">
                  Público: {{ p.target_audience }}
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  Vagas ocupadas:
                  <span class="font-semibold text-slate-800">{{
                    slotsByPanel[p.id] ?? 0
                  }}</span>
                  / {{ p.total_ad_slots }}
                </p>
              </button>
            </li>
          </ul>
        </div>

        <div v-else class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold text-slate-900">Detalhes do ponto</h2>
              <p class="mt-1 text-base font-semibold text-slate-900">{{ selectedPanel.name }}</p>
              <p class="mt-1 text-sm text-slate-600">
                {{ selectedPanel.address_line1 }}, {{ selectedPanel.city }} / {{ selectedPanel.state }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              @click.stop="clearSelection"
            >
              Voltar
            </button>
          </div>

          <div class="mt-4 grid gap-3">
            <div
              class="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              aria-label="Fotos do ponto"
            >
              <div class="flex items-center justify-between px-3 py-2">
                <p class="text-xs font-semibold text-slate-700">Fotos</p>
                <p v-if="mediaLoading" class="text-[10px] text-slate-500">Carregando…</p>
              </div>
              <div v-if="mediaUrls.length === 0" class="p-3 text-xs text-slate-600">
                Sem fotos disponíveis.
              </div>
              <div v-else class="flex snap-x snap-mandatory gap-2 overflow-x-auto p-3">
                <button
                  v-for="(u, idx) in mediaUrls"
                  :key="u"
                  type="button"
                  class="shrink-0 snap-start overflow-hidden rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e7bb0e]"
                  :class="
                    lightboxIndex === idx
                      ? 'border-[#e7bb0e] ring-2 ring-[#e7bb0e]/40'
                      : 'border-transparent hover:border-slate-300'
                  "
                  :aria-label="`Abrir foto ${idx + 1} em tamanho grande`"
                  @click.stop="openLightbox(u)"
                >
                  <img :src="u" alt="" class="h-40 w-auto max-w-[200px] object-cover" />
                </button>
              </div>
            </div>

            <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p v-if="selectedPanel.description" class="text-slate-700">
                {{ selectedPanel.description }}
              </p>
              <p v-else class="text-slate-500">Sem descrição publicada.</p>

              <div class="mt-3 grid gap-2 text-xs text-slate-600">
                <p v-if="selectedPanel.target_audience">
                  <span class="font-semibold text-slate-800">Público</span>:
                  {{ selectedPanel.target_audience }}
                </p>
                <p
                  v-if="
                    formatMeters(selectedPanel.width_m) && formatMeters(selectedPanel.height_m)
                  "
                >
                  <span class="font-semibold text-slate-800">Dimensões</span>:
                  {{ formatMeters(selectedPanel.width_m) }} ×
                  {{ formatMeters(selectedPanel.height_m) }} m
                </p>
                <p>
                  <span class="font-semibold text-slate-800">Vagas</span>:
                  {{ slotsByPanel[selectedPanel.id] ?? 0 }} / {{ selectedPanel.total_ad_slots }}
                </p>
                <p>
                  <a
                    :href="mapsLink(selectedPanel)"
                    class="font-semibold text-[#b89000] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir no Google Maps
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div class="mt-6 border-t border-slate-200 pt-4">
            <h3 class="text-sm font-semibold text-slate-900">Solicitar proposta</h3>
            <p class="mt-1 text-xs text-slate-500">
              Preços sob consulta. Envie seus dados e retornamos em breve.
            </p>
            <form class="mt-3 space-y-2" @submit.prevent="submitQuote">
              <input
                v-model="quote.website"
                class="hidden"
                tabindex="-1"
                autocomplete="off"
                aria-hidden="true"
                name="company_website_trap"
              />
              <input
                v-model="quote.name"
                required
                placeholder="Nome"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                v-model="quote.email"
                type="email"
                required
                placeholder="E-mail"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                v-model="quote.phone"
                placeholder="Telefone"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                v-model="quote.company"
                placeholder="Empresa"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <textarea
                v-model="quote.message"
                placeholder="Mensagem"
                rows="3"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                class="w-full rounded-lg bg-[#e7bb0e] px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c] disabled:opacity-50"
                :disabled="quoteSending"
              >
                Enviar
              </button>
              <p
                v-if="quoteMsg"
                role="alert"
                class="rounded-lg border px-2 py-2 text-xs"
                :class="
                  quoteMsg.startsWith('Enviado')
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-800'
                "
              >
                {{ quoteMsg }}
              </p>
            </form>
            <p class="mt-4 text-[10px] leading-relaxed text-slate-400">
              Ao enviar, você concorda com o tratamento dos dados conforme a política de
              privacidade da empresa (texto jurídico a publicar).
            </p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
