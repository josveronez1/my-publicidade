<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function signOutAndGoHome() {
  try {
    await auth.signOut()
  } finally {
    await router.replace({ name: 'media-kit' })
  }
}
</script>

<template>
  <div class="flex min-h-full bg-slate-50">
    <aside class="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div class="border-b border-slate-200 p-4">
        <RouterLink to="/" class="flex items-center gap-3">
          <img
            src="/mw-logo.jpg"
            alt="MW"
            class="h-10 w-10 rounded-xl object-cover"
          />
          <span class="text-sm font-semibold">Área do cliente</span>
        </RouterLink>
      </div>
      <nav class="p-2">
        <RouterLink
          to="/client"
          class="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          active-class="bg-amber-50 text-slate-900 ring-1 ring-[#e7bb0e]/50"
        >
          Início
        </RouterLink>
      </nav>
      <div class="mt-auto border-t border-slate-200 p-3">
        <button
          type="button"
          class="text-xs font-medium text-[#e7bb0e]"
          @click="signOutAndGoHome"
        >
          Sair
        </button>
      </div>
    </aside>
    <main class="flex-1 overflow-auto p-6">
      <RouterView />
    </main>
  </div>
</template>
