<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSupabase } from '@/infrastructure/supabaseClient'

type Row = {
  id: string
  legal_name: string
  trade_name: string | null
  document_number: string
  status: string
}

const rows = ref<Row[]>([])
const err = ref<string | null>(null)

/** `public.client_status` */
const CLIENT_STATUS_LABEL: Record<string, string> = {
  lead: 'Lead',
  active: 'Ativo',
  inactive: 'Inativo',
  churned: 'Encerrado',
}

function statusLabel(s: string) {
  return CLIENT_STATUS_LABEL[s] ?? s
}

onMounted(async () => {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('clients')
    .select('id, legal_name, trade_name, document_number, status')
    .order('legal_name')
  err.value = error?.message ?? null
  rows.value = (data ?? []) as Row[]
})
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-100/90 bg-amber-50/80"
        aria-hidden="true"
      >
        <svg
          class="h-6 w-6 text-[#e7bb0e]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="4" y="2" width="16" height="20" rx="1" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="10" x2="16" y2="10" />
          <line x1="8" y1="14" x2="12" y2="14" />
        </svg>
      </div>
      <h1 class="text-xl font-semibold text-slate-900">Clientes</h1>
    </div>
      <RouterLink
        to="/admin/clients/new"
        class="rounded-lg bg-[#e7bb0e] px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c]"
      >
        Novo cliente
      </RouterLink>
    </div>
    <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>

    <div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
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
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div
          class="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-4 text-left sm:pl-4"
        >
          <span class="min-w-0 flex-1">Razão social</span>
          <span class="w-40 shrink-0 font-mono">CNPJ / Doc</span>
          <span class="w-32 shrink-0">Status</span>
        </div>
      </div>

      <div role="list">
        <RouterLink
          v-for="r in rows"
          :key="r.id"
          :to="`/admin/clients/${r.id}`"
          role="listitem"
          class="group flex min-h-[3.5rem] items-stretch border-b border-slate-100 text-sm last:border-0 transition-colors hover:bg-amber-50/40"
        >
          <div
            class="flex w-12 shrink-0 items-center justify-center self-stretch border-r border-amber-100/90 bg-amber-50/60"
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div
            class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-3 pl-4 pr-3 sm:flex-row sm:items-center sm:gap-3 sm:py-0 sm:pr-4"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium text-slate-900">{{ r.legal_name }}</p>
              <p v-if="r.trade_name" class="mt-0.5 text-xs text-slate-500">
                {{ r.trade_name }}
              </p>
            </div>
            <span
              class="font-mono text-xs text-slate-700 sm:w-40 sm:shrink-0"
              >{{ r.document_number }}</span
            >
            <span class="text-slate-800 sm:w-32 sm:shrink-0">{{
              statusLabel(r.status)
            }}</span>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
