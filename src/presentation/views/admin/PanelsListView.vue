<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'

type Row = {
  id: string
  name: string
  is_published: boolean
  status: string
  city: string | null
}

const rows = ref<Row[]>([])
const err = ref<string | null>(null)

/** Valores de `public.panel_status` (schema). */
const PANEL_STATUS_LABEL: Record<string, string> = {
  planning: 'Planejamento',
  installation: 'Instalação',
  active: 'Ativo',
  maintenance: 'Manutenção',
  inactive: 'Inativo',
}

function statusLabel(status: string) {
  return PANEL_STATUS_LABEL[status] ?? status
}

onMounted(async () => {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('panels')
    .select('id, name, is_published, status, city')
    .order('name')
  err.value = error?.message ?? null
  rows.value = (data ?? []) as Row[]
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-100/90 bg-amber-50/80"
          aria-hidden="true"
        >
          <svg
            class="h-6 w-6 text-[#e7bb0e]"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="3"
              y="6"
              width="26"
              height="18"
              rx="2.5"
              stroke="currentColor"
              stroke-width="1.75"
            />
            <rect x="6" y="9" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.9" />
            <rect x="12" y="9" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.9" />
            <rect x="18" y="9" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.9" />
            <rect x="24" y="9" width="2" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
            <rect x="6" y="15" width="20" height="2.5" rx="0.5" fill="currentColor" opacity="0.45" />
            <rect x="6" y="19" width="14" height="2.5" rx="0.5" fill="currentColor" opacity="0.3" />
          </svg>
        </div>
        <h1 class="text-xl font-semibold text-slate-900">Painéis</h1>
      </div>
      <RouterLink
        to="/admin/panels/new"
        class="rounded-lg bg-[#e7bb0e] px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c]"
      >
        Novo painel
      </RouterLink>
    </div>
    <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>

    <div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <!-- Cabeçalho (alinhado às colunas do row) -->
      <div
        class="hidden border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600 sm:flex sm:items-center sm:gap-3 sm:pl-0 sm:pr-4"
      >
        <div
          class="flex w-12 shrink-0 items-center justify-center self-stretch border-r border-amber-100/80 bg-amber-50/40"
          aria-hidden="true"
        >
          <svg
            class="h-4 w-4 text-[#e7bb0e]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 21s7-5.2 7-10.3a7 7 0 1 0-14 0C5 15.8 12 21 12 21Z" />
            <circle cx="12" cy="10" r="2.2" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div class="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left sm:pl-4">
          <span class="min-w-0 flex-1">Nome</span>
          <span class="w-28 shrink-0">Cidade</span>
          <span class="w-36 shrink-0">Status</span>
          <span class="w-20 shrink-0 text-right sm:text-left">Publ.</span>
        </div>
      </div>

      <div role="list">
        <RouterLink
          v-for="r in rows"
          :key="r.id"
          :to="`/admin/panels/${r.id}/edit`"
          role="listitem"
          class="group flex min-h-[3.75rem] items-stretch border-b border-slate-100 text-sm text-slate-800 transition last:border-0 hover:bg-amber-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e7bb0e]"
        >
          <div
            class="flex w-12 shrink-0 items-center justify-center self-stretch border-r border-amber-100/90 bg-amber-50/60 group-hover:bg-amber-100/50"
            aria-hidden="true"
          >
            <svg
              class="h-7 w-7 text-[#e7bb0e]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 21s7-5.2 7-10.3a7 7 0 1 0-14 0C5 15.8 12 21 12 21Z" />
              <circle cx="12" cy="10" r="2.2" fill="currentColor" stroke="none" />
            </svg>
          </div>

          <div
            class="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-3 pl-4 pr-3 sm:flex-row sm:items-center sm:gap-3 sm:py-0 sm:pl-4 sm:pr-4"
          >
            <span
              class="min-w-0 text-base font-medium leading-snug text-slate-900 sm:flex-1 sm:text-sm"
              >{{ r.name }}</span
            >
            <span
              class="order-last text-slate-600 sm:order-none sm:w-28 sm:shrink-0 sm:truncate"
              ><span class="text-xs text-slate-500 sm:hidden">Cidade: </span>{{ r.city ?? '—' }}</span
            >
            <span
              class="order-3 text-slate-800 sm:order-none sm:w-36 sm:shrink-0"
              :title="r.status"
              >{{ statusLabel(r.status) }}</span
            >
            <div class="order-2 sm:order-none sm:ml-auto sm:w-20 sm:shrink-0 sm:text-left">
              <span
                class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
                :class="
                  r.is_published
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80'
                "
              >
                {{ r.is_published ? 'Sim' : 'Não' }}
              </span>
            </div>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
