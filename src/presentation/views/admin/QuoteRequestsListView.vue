<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSupabase } from '@/infrastructure/supabaseClient'
import { requestErrorMessage, runPostgrestWithRetry } from '@/composables/retryRequest'
import { useAdminQuoteInboxMeta } from '@/composables/useAdminQuoteInboxMeta'

type Row = {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  message: string | null
  panel_ids: unknown
  read_at: string | null
  created_at: string
}

const rows = ref<Row[]>([])
const err = ref<string | null>(null)
const loading = ref(false)
const expandedId = ref<string | null>(null)
const panelNameById = ref<Map<string, string>>(new Map())
const { refreshUnread } = useAdminQuoteInboxMeta()

function isUnread(r: Row) {
  return r.read_at == null
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function messagePreview(m: string | null) {
  const t = m?.trim()
  if (!t) return '—'
  return t.length > 52 ? `${t.slice(0, 49)}…` : t
}

function panelLabels(panelIds: unknown) {
  if (!panelIds || !Array.isArray(panelIds) || panelIds.length === 0) return '—'
  return panelIds
    .map((id) => panelNameById.value.get(String(id)) ?? 'Painel (id)')
    .join(', ')
}

function collectPanelIds(list: Row[]) {
  const ids = new Set<string>()
  for (const r of list) {
    const p = r.panel_ids
    if (Array.isArray(p)) for (const x of p) ids.add(String(x))
  }
  return [...ids]
}

function isMissingReadAtError(msg: string) {
  const m = msg.toLowerCase()
  return (
    m.includes('read_at') ||
    m.includes('pgrst204') ||
    (m.includes('column') && m.includes('schema cache'))
  )
}

async function loadRows() {
  err.value = null
  loading.value = true
  panelNameById.value = new Map()
  try {
    const sb = getSupabase()
    const { data, error } = await runPostgrestWithRetry(() =>
      sb
        .from('quote_requests')
        .select('id, name, email, phone, company, message, panel_ids, read_at, created_at')
        .order('created_at', { ascending: false }),
    )
    if (error) {
      err.value = isMissingReadAtError(error.message)
        ? `${error.message} — Aplique a migration com read_at em quote_requests (supabase db push) e aguarde o schema recarregar.`
        : error.message
      rows.value = []
      return
    }
    rows.value = (data ?? []) as Row[]
  } catch (e) {
    err.value = requestErrorMessage(e)
    rows.value = []
  } finally {
    loading.value = false
  }

  // Resolução de nomes de painéis: não bloqueia o “Carregando” se esta query pendurar.
  try {
    const sb = getSupabase()
    const ids = collectPanelIds(rows.value)
    if (ids.length > 0) {
      const { data: pData, error: pe } = await runPostgrestWithRetry(() =>
        sb.from('panels').select('id, name').in('id', ids),
      )
      if (!pe && pData) {
        const m = new Map<string, string>()
        for (const p of pData as { id: string; name: string }[]) m.set(p.id, p.name)
        panelNameById.value = m
      }
    }
  } catch {
    /* nomes de painel são opcionais */
  }
  await refreshUnread()
}

async function markAsRead(r: Row) {
  if (r.read_at) return
  const sb = getSupabase()
  const readAt = new Date().toISOString()
  const { error } = await runPostgrestWithRetry(() =>
    sb.from('quote_requests').update({ read_at: readAt }).eq('id', r.id),
  )
  if (!error) {
    r.read_at = readAt
  }
  await refreshUnread()
}

async function onToggleRow(r: Row) {
  const opening = expandedId.value !== r.id
  if (opening) {
    await markAsRead(r)
    expandedId.value = r.id
  } else {
    expandedId.value = null
  }
}

onMounted(() => {
  void loadRows()
})
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-100/90 bg-amber-50/80"
          aria-hidden="true"
        >
          <svg
            class="h-6 w-6 text-[#e7bb0e]"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="5" cy="6" r="1.35" />
            <circle cx="5" cy="12" r="1.35" />
            <circle cx="5" cy="18" r="1.35" />
            <path
              d="M9 6h11M9 12h11M9 18h11"
              fill="none"
              stroke="currentColor"
              stroke-width="1.65"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <h1 class="text-xl font-semibold text-slate-900">Solicitações</h1>
      </div>
    </div>

    <div v-if="err" class="mt-2 flex flex-wrap items-center gap-2">
      <p class="text-sm text-red-600">{{ err }}</p>
      <button
        type="button"
        class="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        :disabled="loading"
        @click="loadRows"
      >
        Tentar novamente
      </button>
    </div>
    <p v-else-if="loading" class="mt-2 text-sm text-slate-500">Carregando…</p>

    <div
      v-else
      class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <p v-if="rows.length === 0" class="p-4 text-sm text-slate-500">Nenhuma solicitação ainda.</p>

      <template v-else>
        <div
          class="hidden border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600 sm:flex sm:items-stretch"
        >
          <div
            class="flex w-12 shrink-0 items-center justify-center self-stretch border-r border-amber-100/80 bg-amber-50/40"
            aria-hidden="true"
          >
            <svg
              class="h-4 w-4 text-[#e7bb0e]"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="5" cy="6" r="1.1" />
              <circle cx="5" cy="12" r="1.1" />
              <circle cx="5" cy="18" r="1.1" />
              <path
                d="M9 6h11M9 12h11M9 18h11"
                fill="none"
                stroke="currentColor"
                stroke-width="1.65"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <div
            class="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-4 pr-2 text-left"
          >
            <span class="w-[9.5rem] shrink-0 pl-0">Data</span>
            <span class="min-w-0 flex-1">Nome</span>
            <span class="hidden w-[11rem] shrink-0 min-w-0 lg:block">E-mail</span>
            <span class="w-24 shrink-0 sm:block">Telefone</span>
            <span class="hidden min-w-0 flex-1 md:block">Empresa</span>
            <span class="hidden min-w-0 flex-1 xl:block">Mensagem</span>
            <span class="w-5 shrink-0" aria-hidden="true" />
          </div>
        </div>

        <div role="list" class="divide-y divide-slate-100">
          <div v-for="r in rows" :key="r.id" role="listitem">
            <button
              type="button"
              class="group flex w-full min-h-[3.5rem] items-stretch text-left text-sm transition"
              :class="[
                isUnread(r)
                  ? 'bg-amber-50/50 ring-1 ring-inset ring-amber-200/70'
                  : 'bg-white hover:bg-amber-50/25',
              ]"
              :aria-expanded="expandedId === r.id"
              :aria-label="`Solicitação de ${r.name}, ${isUnread(r) ? 'não lida' : 'lida'}`"
              @click="onToggleRow(r)"
            >
              <div
                class="flex w-12 shrink-0 items-center justify-center self-stretch border-r"
                :class="
                  isUnread(r)
                    ? 'border-amber-200/90 bg-amber-100/50'
                    : 'border-amber-100/90 bg-amber-50/60'
                "
                aria-hidden="true"
              >
                <span v-if="isUnread(r)" class="relative flex h-8 w-8 items-center justify-center" title="Novo">
                  <span
                    class="absolute inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-100"
                  />
                  <svg
                    class="h-5 w-5 text-amber-800/90"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </span>
                <svg
                  v-else
                  class="h-5 w-5 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div
                class="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2.5 pl-3 pr-2 sm:flex-row sm:items-center sm:gap-2 sm:py-0 sm:pl-4"
              >
                <span
                  class="w-auto shrink-0 text-xs text-slate-600 sm:w-[9.5rem] sm:text-sm"
                >{{ formatWhen(r.created_at) }}</span>
                <div
                  class="min-w-0 sm:flex-1"
                  :class="isUnread(r) ? 'font-semibold text-slate-900' : 'text-slate-800'"
                >
                  <span class="line-clamp-2 sm:line-clamp-1 sm:truncate">{{ r.name }}</span>
                </div>
                <span
                  class="hidden min-w-0 text-xs text-slate-700 sm:text-sm lg:block lg:w-[11rem] lg:truncate"
                >{{ r.email }}</span>
                <span
                  class="w-auto shrink-0 text-xs text-slate-700 sm:w-24 sm:text-sm"
                >{{ r.phone?.trim() || '—' }}</span>
                <span
                  class="hidden min-w-0 text-slate-700 md:block md:min-w-0 md:flex-1 md:truncate"
                >{{ r.company?.trim() || '—' }}</span>
                <span
                  class="hidden min-w-0 text-slate-600 xl:block xl:min-w-0 xl:flex-1 xl:truncate"
                >{{ messagePreview(r.message) }}</span>
                <span
                  class="ml-auto w-5 shrink-0 pr-1 text-center text-slate-400"
                  aria-hidden="true"
                >{{ expandedId === r.id ? '▾' : '▸' }}</span>
              </div>
            </button>

            <div
              v-show="expandedId === r.id"
              class="border-t border-slate-100 bg-slate-50/80 px-3 py-3 pl-4 sm:pl-16"
            >
              <dl class="grid gap-3 text-sm sm:grid-cols-2 sm:gap-x-6">
                <div>
                  <dt class="text-xs font-medium text-slate-500">E-mail</dt>
                  <dd>
                    <a
                      :href="`mailto:${r.email}`"
                      class="text-[#b8930c] underline decoration-amber-200 hover:decoration-[#e7bb0e]"
                      @click.stop
                    >{{ r.email }}</a>
                  </dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-slate-500">Telefone</dt>
                  <dd class="text-slate-800">{{ r.phone?.trim() || '—' }}</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-xs font-medium text-slate-500">Empresa</dt>
                  <dd class="text-slate-800">{{ r.company?.trim() || '—' }}</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-xs font-medium text-slate-500">Painel(is) de interesse</dt>
                  <dd class="text-slate-800">{{ panelLabels(r.panel_ids) }}</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-xs font-medium text-slate-500">Mensagem completa</dt>
                  <dd class="whitespace-pre-wrap text-slate-800">{{ r.message?.trim() || '—' }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
