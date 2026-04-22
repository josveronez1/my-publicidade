<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

async function signOutAndGoHome() {
  try {
    await auth.signOut()
  } finally {
    await router.replace({ name: 'media-kit' })
  }
}

/** Itens ativos no menu. Para preview, contratos/propostas/modelos e o dashboard ficam fora. */
const links = [
  { to: '/admin/panels', label: 'Painéis', match: (p: string) => p.startsWith('/admin/panels') },
  { to: '/admin/clients', label: 'Clientes', match: (p: string) => p.startsWith('/admin/clients') },
  // { to: '/admin', label: 'Início', match: (p: string) => p === '/admin' || p === '/admin/' },
  // { to: '/admin/contracts', label: 'Contratos', match: (p: string) => p.startsWith('/admin/contracts') },
  // { to: '/admin/quotes', label: 'Propostas', match: (p: string) => p.startsWith('/admin/quotes') },
  // { to: '/admin/templates', label: 'Modelos', match: (p: string) => p.startsWith('/admin/templates') },
]

function activeClass(l: (typeof links)[0]) {
  return l.match(route.path)
    ? 'bg-amber-50 text-slate-900 ring-1 ring-[#e7bb0e]/50'
    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
}
</script>

<template>
  <div class="flex min-h-full bg-slate-50">
    <aside
      class="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white"
    >
      <div class="border-b border-slate-200 p-4">
        <RouterLink to="/" class="flex items-center gap-3">
          <img
            src="/mw-logo.jpg"
            alt="MW Publicidade"
            class="h-11 w-11 shrink-0 rounded-xl object-cover"
          />
          <span class="text-sm font-semibold text-slate-900">MW Publicidade</span>
        </RouterLink>
      </div>
      <nav class="flex flex-1 flex-col gap-0.5 p-2">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="block rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="activeClass(l)"
        >
          {{ l.label }}
        </RouterLink>
      </nav>
      <div class="border-t border-slate-200 p-3">
        <p class="truncate text-xs text-slate-500">
          {{ auth.profile?.full_name ?? auth.session?.user?.email }}
        </p>
        <button
          type="button"
          class="mt-2 text-xs font-medium text-[#e7bb0e] hover:text-[#d4a90c]"
          @click="signOutAndGoHome"
        >
          Sair
        </button>
      </div>
    </aside>
    <main class="min-w-0 flex-1 overflow-auto p-6">
      <RouterView />
    </main>
  </div>
</template>
