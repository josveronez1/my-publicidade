<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminQuoteInboxMeta } from '@/composables/useAdminQuoteInboxMeta'
import { useRefetchWhenTabVisible } from '@/composables/useRefetchWhenTabVisible'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { unreadCount, refreshUnread } = useAdminQuoteInboxMeta()

const SIDEBAR_STORAGE_KEY = 'mw-admin-sidebar-collapsed'
const sidebarCollapsed = ref(false)

onMounted(() => {
  void refreshUnread()
  try {
    if (localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1') sidebarCollapsed.value = true
  } catch {
    /* ignore */
  }
})

watch(sidebarCollapsed, (c) => {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, c ? '1' : '0')
  } catch {
    /* ignore */
  }
})

useRefetchWhenTabVisible(refreshUnread)

async function signOutAndGoHome() {
  try {
    await auth.signOut()
  } finally {
    await router.replace({ name: 'media-kit' })
  }
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

/** Itens ativos no menu. Para preview, contratos/propostas/modelos e o dashboard ficam fora. */
const links: Array<{
  to: string
  label: string
  /** Abreviatura no menu recolhido (tooltip = label completo) */
  abbr: string
  match: (p: string) => boolean
  inboxBadge?: boolean
}> = [
  { to: '/admin/panels', label: 'Painéis', abbr: 'Pa', match: (p: string) => p.startsWith('/admin/panels') },
  {
    to: '/admin/clients',
    label: 'Clientes',
    abbr: 'Cl',
    match: (p: string) => p.startsWith('/admin/clients'),
  },
  {
    to: '/admin/contracts',
    label: 'Contratos',
    abbr: 'Co',
    match: (p: string) => p.startsWith('/admin/contracts'),
  },
  {
    to: '/admin/pagamentos',
    label: 'Pagamentos',
    abbr: 'Pg',
    match: (p: string) => p.startsWith('/admin/pagamentos'),
  },
  {
    to: '/admin/solicitacoes',
    label: 'Solicitações',
    abbr: 'So',
    match: (p: string) => p.startsWith('/admin/solicitacoes'),
    inboxBadge: true,
  },
]

function activeClass(l: (typeof links)[0]) {
  const base =
    sidebarCollapsed.value
      ? 'flex items-center justify-center px-2 py-2 font-semibold'
      : 'block px-3 py-2'

  const state = l.match(route.path)
    ? 'bg-amber-50 text-slate-900 ring-1 ring-[#e7bb0e]/50'
    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'

  return `${base} relative rounded-lg text-sm font-medium transition-colors ${state}`
}
</script>

<template>
  <div class="flex h-[100dvh] min-h-0 overflow-hidden bg-slate-50">
    <aside
      class="flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-out"
      :class="sidebarCollapsed ? 'w-14' : 'w-60'"
    >
      <div
        class="flex shrink-0 items-center gap-1 border-b border-slate-200"
        :class="sidebarCollapsed ? 'flex-col px-1 py-2' : 'px-2 py-3'"
      >
        <RouterLink
          v-if="!sidebarCollapsed"
          to="/"
          class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
        >
          <img
            src="/mw-logo.jpg"
            alt="MW Publicidade"
            class="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
          <span class="truncate text-sm font-semibold text-slate-900">MW Publicidade</span>
        </RouterLink>
        <RouterLink
          v-else
          to="/"
          class="flex justify-center rounded-lg p-1.5 hover:bg-slate-50"
          title="MW Publicidade — início"
        >
          <img
            src="/mw-logo.jpg"
            alt=""
            class="h-9 w-9 rounded-xl object-cover"
          />
        </RouterLink>
        <button
          type="button"
          class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          :title="sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'"
          :aria-expanded="!sidebarCollapsed"
          @click="toggleSidebar"
        >
          <span class="sr-only">{{ sidebarCollapsed ? 'Expandir menu' : 'Recolher menu' }}</span>
          <svg
            v-if="sidebarCollapsed"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <svg
            v-else
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <nav class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2">
        <RouterLink v-for="l in links" :key="l.to" :to="l.to" :class="activeClass(l)" :title="l.label">
          <template v-if="sidebarCollapsed">
            <span class="text-xs font-semibold">{{ l.abbr }}</span>
            <span
              v-if="l.inboxBadge && unreadCount > 0"
              class="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"
              :title="`${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}`"
            />
          </template>
          <span v-else class="flex w-full items-center justify-between gap-2">
            <span>{{ l.label }}</span>
            <span
              v-if="l.inboxBadge && unreadCount > 0"
              class="inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white"
              :title="`${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}`"
            >
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </span>
        </RouterLink>
      </nav>
      <div class="shrink-0 border-t border-slate-200 p-2">
        <p v-if="!sidebarCollapsed" class="truncate px-1 text-xs text-slate-500">
          {{ auth.profile?.full_name ?? auth.session?.user?.email }}
        </p>
        <button
          type="button"
          class="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-[#e7bb0e] hover:bg-amber-50 hover:text-[#d4a90c]"
          :class="sidebarCollapsed ? 'justify-center' : ''"
          :title="'Sair'"
          @click="signOutAndGoHome"
        >
          <svg
            class="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
            />
          </svg>
          <span v-if="!sidebarCollapsed">Sair</span>
        </button>
      </div>
    </aside>
    <main class="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6 overscroll-contain">
      <RouterView />
    </main>
  </div>
</template>
