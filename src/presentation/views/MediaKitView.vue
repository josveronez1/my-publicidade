<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { usePublicPanels } from '@/composables/usePublicPanels'
import { useSiteSettings } from '@/composables/useSiteSettings'
import { useLeafletPublicMap } from '@/composables/useLeafletPublicMap'
import { createPanelMediaSignedUrl } from '@/infrastructure/storage/panelMedia'

const { panels, slotsByPanel, loading, error, load } = usePublicPanels()
const { orgName, load: loadSettings } = useSiteSettings()
const mapEl = ref<HTMLElement | null>(null)
const asideEl = ref<HTMLElement | null>(null)

const selectedPanelId = ref<string | null>(null)
const selectedPanel = computed(() =>
  selectedPanelId.value ? panels.value.find((p) => p.id === selectedPanelId.value) ?? null : null,
)

function selectPanel(p: { id: string }) {
  selectedPanelId.value = p.id
  nextTick(() => {
    asideEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

function clearSelection() {
  selectedPanelId.value = null
  quoteMsg.value = null
}

const { init } = useLeafletPublicMap(mapEl, panels, {
  onSelectPanel: (id) => selectPanel({ id }),
})

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
  await loadSettings()
  await nextTick()
  // Mapa antes do load() dos painéis — marcadores atualizam quando `panels` chega.
  init()
  await load()
})

watch(
  () => selectedPanel.value?.id,
  async () => {
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
        <span class="font-semibold text-slate-900">{{ orgName }}</span>
      </RouterLink>
      <div class="flex gap-4 text-sm">
        <RouterLink
          to="/login"
          class="font-medium text-slate-600 hover:text-slate-900"
        >
          Área restrita
        </RouterLink>
      </div>
    </header>

    <div
      class="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)]"
    >
      <div
        class="relative z-0 flex min-h-[420px] flex-col border-b border-slate-200 lg:min-h-0 lg:h-full lg:border-b-0 lg:border-r"
      >
        <div
          ref="mapEl"
          class="mw-media-kit-map h-[min(420px,50svh)] w-full min-h-[240px] lg:h-full lg:min-h-0"
        />
      </div>

      <aside
        ref="asideEl"
        class="border-t border-slate-200 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0"
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
                @click="selectPanel(p)"
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
              @click="clearSelection"
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
                <img
                  v-for="u in mediaUrls"
                  :key="u"
                  :src="u"
                  alt=""
                  class="h-40 w-auto shrink-0 snap-start rounded-lg object-cover"
                />
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
