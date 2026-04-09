<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { usePublicPanels } from '@/composables/usePublicPanels'
import { useSiteSettings } from '@/composables/useSiteSettings'
import { useMapboxPublicMap } from '@/composables/useMapboxPublicMap'

const { panels, slotsByPanel, loading, error, load } = usePublicPanels()
const { orgName, load: loadSettings } = useSiteSettings()
const mapEl = ref<HTMLElement | null>(null)
const { init } = useMapboxPublicMap(mapEl, panels)

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
const hasMapboxToken = !!(
  import.meta.env.VITE_MAPBOX_TOKEN && String(import.meta.env.VITE_MAPBOX_TOKEN).trim()
)

function mapsLink(p: { latitude: number; longitude: number }) {
  return `https://www.google.com/maps?q=${p.latitude},${p.longitude}`
}

onMounted(async () => {
  await loadSettings()
  await nextTick()
  // Mapa antes do load() dos painéis — evita área branca longa; marcadores atualizam quando `panels` chega.
  if (hasMapboxToken) init()
  await load()
})

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
    const { error: e } = await sb.from('quote_requests').insert({
      name: quote.value.name.trim(),
      email: quote.value.email.trim(),
      phone: quote.value.phone?.trim() || null,
      company: quote.value.company?.trim() || null,
      message: quote.value.message?.trim() || null,
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
        class="relative flex min-h-[420px] flex-col border-b border-slate-200 lg:min-h-0 lg:h-full lg:border-b-0 lg:border-r"
      >
        <div
          v-if="hasMapboxToken"
          ref="mapEl"
          class="h-[min(420px,50svh)] w-full min-h-[240px] lg:h-full lg:min-h-0"
        />
        <div
          v-else
          class="flex min-h-[320px] flex-1 flex-col justify-center gap-4 bg-slate-50 p-8 lg:min-h-0"
        >
          <div class="mx-auto max-w-md text-center">
            <p class="text-sm font-medium text-slate-800">Mapa interativo indisponível</p>
            <p class="mt-2 text-sm text-slate-600">
              Sem token do Mapbox, o mapa não carrega. Você ainda pode ver endereços, vagas e
              abrir a localização de cada ponto no Google Maps pela lista ao lado.
            </p>
            <p class="mt-3 text-xs text-slate-500">
              Amanhã: crie a conta em
              <a
                href="https://account.mapbox.com/"
                class="font-medium text-[#e7bb0e] underline"
                target="_blank"
                rel="noopener noreferrer"
                >mapbox.com</a
              >
              e adicione
              <code class="rounded bg-white px-1 py-0.5 text-[11px]">VITE_MAPBOX_TOKEN</code>
              no <code class="rounded bg-white px-1 py-0.5 text-[11px]">.env</code> — reinicie o
              <code class="rounded bg-white px-1 py-0.5 text-[11px]">npm run dev</code>.
            </p>
          </div>
        </div>
      </div>

      <aside
        class="border-t border-slate-200 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0"
      >
        <div class="max-h-[50vh] overflow-auto border-b border-slate-200 p-4 lg:max-h-none">
          <h2 class="text-sm font-semibold text-slate-900">Pontos publicados</h2>
          <p v-if="loading" class="mt-2 text-sm text-slate-500">Carregando…</p>
          <p v-else-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
          <ul v-else class="mt-3 space-y-3">
            <li
              v-for="p in panels"
              :key="p.id"
              class="rounded-lg border border-slate-200 p-3 text-sm"
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
              <p class="mt-2">
                <a
                  :href="mapsLink(p)"
                  class="text-xs font-medium text-[#e7bb0e] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir no Google Maps
                </a>
                <span v-if="!hasMapboxToken" class="ml-1 text-[10px] text-slate-400">
                  (enquanto não há Mapbox)
                </span>
              </p>
            </li>
          </ul>
        </div>

        <div class="p-4">
          <h2 class="text-sm font-semibold text-slate-900">Solicitar proposta</h2>
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
      </aside>
    </div>
  </div>
</template>
